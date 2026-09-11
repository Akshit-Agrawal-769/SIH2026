import os
import sys
import json
import struct
import numpy as np
import netCDF4 as nc
from datetime import datetime, timedelta, timezone
from scipy.interpolate import RegularGridInterpolator

WIDTH = 520
HEIGHT = 280
LON_MIN, LON_MAX = 35.0, 100.0
LAT_MIN, LAT_MAX = -10.0, 25.0

# 32-byte INCO binary tile header packer
def pack_inco_tile(var_code: int, width: int, height: int, data: np.ndarray) -> bytes:
    valid = data[~np.isnan(data)]
    if len(valid) == 0:
        min_val, max_val = 0.0, 1.0
    else:
        min_val, max_val = float(np.min(valid)), float(np.max(valid))

    magic = b"INCO"
    version = 1
    depth_count = 1
    data_type = 1 # Float32
    reserved = b"\x00" * 8

    header = struct.pack(
        "<4sHHHHHHff8s",
        magic,
        version,
        var_code,
        width,
        height,
        depth_count,
        data_type,
        min_val,
        max_val,
        reserved
    )
    return header + data.astype("<f4").tobytes()

LAND_POLYGONS = [
    # India Mainland
    [(68.0, 30.0), (91.0, 30.0), (91.0, 24.0), (89.8, 22.2), (88.5, 21.6),
     (87.0, 21.4), (85.0, 19.5), (83.3, 17.7), (80.3, 13.1), (79.8, 10.5),
     (78.2, 9.2), (77.5, 8.1), (76.5, 9.5), (75.0, 12.5), (74.0, 14.5),
     (73.5, 16.5), (72.8, 18.9), (72.8, 21.2), (70.0, 21.0), (69.0, 22.4),
     (68.2, 23.8), (68.0, 30.0)],
    # Sri Lanka
    [(79.6, 9.8), (81.9, 9.8), (81.9, 5.9), (79.6, 5.9)],
    # Arabian Peninsula & Iran/Pakistan
    [(45.0, 30.0), (68.2, 30.0), (68.2, 23.8), (66.5, 25.0), (61.5, 25.2),
     (57.0, 25.5), (56.3, 26.2), (58.5, 23.6), (59.8, 22.5), (58.0, 20.5),
     (54.0, 16.5), (51.0, 12.0), (45.0, 12.5)],
    # Horn of Africa / Somalia
    [(45.0, 11.5), (51.3, 12.0), (50.0, 8.0), (47.5, 4.0), (45.0, 1.5),
     (45.0, -15.0), (39.0, -15.0), (39.0, 11.5)],
    # Southeast Asia
    [(92.5, 30.0), (100.0, 30.0), (100.0, 1.0), (98.5, 3.0), (98.5, 8.0),
     (98.5, 12.0), (96.5, 16.5), (94.5, 16.0), (94.0, 18.0), (92.5, 21.0)],
    # Sumatra
    [(95.2, 5.6), (100.0, 1.5), (100.0, -6.0), (97.0, 1.0)]
]

def point_in_polygon(x: float, y: float, poly: list) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside

def get_land_mask(lons: np.ndarray, lats: np.ndarray) -> np.ndarray:
    mask = np.zeros((len(lats), len(lons)), dtype=bool)
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            if any(point_in_polygon(lon, lat, poly) for poly in LAND_POLYGONS):
                mask[i, j] = True
    return mask

def main():
    print("=== Generating Authentic Ocean Tiles and Instruments from NetCDF ===")

    # 1. Process ROMS model
    roms_path = "datasets/model/incois_roms_indian_ocean.nc"
    if not os.path.exists(roms_path):
        print(f"Error: {roms_path} not found!")
        sys.exit(1)

    ds = nc.Dataset(roms_path, "r")
    src_lats = ds.variables["lat"][:]
    src_lons = ds.variables["lon"][:]
    src_depths = ds.variables["depth"][:]
    times = ds.variables["time"][:]

    tgt_lons = np.linspace(LON_MIN, LON_MAX, WIDTH, dtype=np.float32)
    tgt_lats = np.linspace(LAT_MIN, LAT_MAX, HEIGHT, dtype=np.float32)
    land_mask = get_land_mask(tgt_lons, tgt_lats)

    grid_lats, grid_lons = np.meshgrid(tgt_lats, tgt_lons, indexing='ij')

    dates = [f"2024-06-{d:02d}" for d in range(1, len(times) + 1)]

    var_map = {
        "temperature": (1, "temp"),
        "salinity": (2, "salt"),
        "chlorophyll": (4, "chl")
    }

    # Prepare output directories
    target_dirs = [
        "tiles",
        "frontend/public/tiles",
        "api/tiles"
    ]

    for v_name, (v_code, nc_var) in var_map.items():
        print(f"\nProcessing variable '{v_name}' ({nc_var})...")
        nc_data = ds.variables[nc_var][:] # shape (time, depth, lat, lon)

        for t_idx, dt_str in enumerate(dates):
            for d_idx, d_val in enumerate(src_depths):
                slice_data = nc_data[t_idx, d_idx, :, :]
                
                # Interpolate to target grid
                interp = RegularGridInterpolator(
                    (src_lats, src_lons),
                    slice_data,
                    method="linear",
                    bounds_error=False,
                    fill_value=np.nan
                )

                resampled = interp((grid_lats, grid_lons)).astype(np.float32)
                resampled[land_mask] = np.nan

                tile_bytes = pack_inco_tile(v_code, WIDTH, HEIGHT, resampled)

                depth_key = f"{d_val:.1f}" if d_val > 0 else "0.5"

                for base_dir in target_dirs:
                    out_path = os.path.join(base_dir, v_name, dt_str, f"{depth_key}.bin")
                    os.makedirs(os.path.dirname(out_path), exist_ok=True)
                    with open(out_path, "wb") as f:
                        f.write(tile_bytes)

    # Process Currents (speed magnitude from u and v)
    print("\nProcessing variable 'currents' (speed magnitude from u and v)...")
    u_data = ds.variables["u"][:]
    v_data = ds.variables["v"][:]
    speed_data = np.sqrt(u_data**2 + v_data**2)

    for t_idx, dt_str in enumerate(dates):
        for d_idx, d_val in enumerate(src_depths):
            slice_data = speed_data[t_idx, d_idx, :, :]
            interp = RegularGridInterpolator(
                (src_lats, src_lons),
                slice_data,
                method="linear",
                bounds_error=False,
                fill_value=np.nan
            )
            resampled = interp((grid_lats, grid_lons)).astype(np.float32)
            resampled[land_mask] = np.nan

            tile_bytes = pack_inco_tile(3, WIDTH, HEIGHT, resampled)
            depth_key = f"{d_val:.1f}" if d_val > 0 else "0.5"

            for base_dir in target_dirs:
                out_path = os.path.join(base_dir, "currents", dt_str, f"{depth_key}.bin")
                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(tile_bytes)

    ds.close()
    print("-> Successfully exported all 3D ocean tiles!")

    # 2. Process Argo Float NetCDF profiles
    print("\nProcessing authentic Argo NetCDF profiles...")
    argo_dir = "datasets/argo"
    argo_files = [f for f in os.listdir(argo_dir) if f.endswith(".nc")]

    features = []
    profiles_dict = {}

    JULD_EPOCH = datetime(1950, 1, 1, tzinfo=timezone.utc)

    for f in argo_files:
        fpath = os.path.join(argo_dir, f)
        ads = nc.Dataset(fpath, "r")
        pn_raw = ads.variables["PLATFORM_NUMBER"][:]
        wmos = ["".join([c.decode("utf-8") if isinstance(c, bytes) else str(c) for c in row]).strip("- ") for row in pn_raw]
        wmo = wmos[0] if wmos else os.path.splitext(f)[0]

        n_prof = len(ads.dimensions["N_PROF"])
        cycles = ads.variables["CYCLE_NUMBER"][:]
        lats = ads.variables["LATITUDE"][:]
        lons = ads.variables["LONGITUDE"][:]
        julds = ads.variables["JULD"][:]
        temps = ads.variables["TEMP"][:]
        temp_qcs = ads.variables["TEMP_QC"][:]
        press = ads.variables["PRES"][:]
        psals = ads.variables["PSAL"][:]
        psal_qcs = ads.variables["PSAL_QC"][:]

        float_profiles = []
        for p_idx in range(n_prof):
            lat = float(lats[p_idx])
            lon = float(lons[p_idx])
            juld = float(julds[p_idx])
            if np.isnan(lat) or np.isnan(lon) or np.isnan(juld):
                continue
            p_time = (JULD_EPOCH + timedelta(days=juld)).isoformat()

            measurements = []
            n_levels = temps.shape[1]
            for lvl in range(n_levels):
                t = temps[p_idx, lvl]
                p = press[p_idx, lvl]
                s = psals[p_idx, lvl]
                t_qc = temp_qcs[p_idx, lvl]
                s_qc = psal_qcs[p_idx, lvl]

                t_qc_str = t_qc.decode("utf-8") if isinstance(t_qc, bytes) else str(t_qc)
                s_qc_str = s_qc.decode("utf-8") if isinstance(s_qc, bytes) else str(s_qc)

                if t_qc_str not in ("1", "2"):
                    continue
                if np.isnan(t) or getattr(t, "mask", False):
                    continue

                p_val = float(p) if not np.isnan(p) and not getattr(p, "mask", False) else 0.0
                depth_m = abs(p_val) * 0.993 # hydrostatic conversion

                meas = {
                    "depth": round(depth_m, 2),
                    "pressure": round(p_val, 2),
                    "temperature": round(float(t), 3),
                    "salinity": round(float(s), 3) if not np.isnan(s) and not getattr(s, "mask", False) and s_qc_str in ("1", "2") else None
                }
                measurements.append(meas)

            if measurements:
                float_profiles.append({
                    "cycle_number": int(cycles[p_idx]),
                    "timestamp": p_time,
                    "latitude": lat,
                    "longitude": lon,
                    "max_depth": max(m["depth"] for m in measurements),
                    "measurements": measurements
                })

        ads.close()

        if float_profiles:
            last_prof = float_profiles[-1]
            ext_id = f"INCOIS_ARGO_{wmo}"
            feature = {
                "type": "Feature",
                "id": ext_id,
                "geometry": {
                    "type": "Point",
                    "coordinates": [last_prof["longitude"], last_prof["latitude"]]
                },
                "properties": {
                    "id": ext_id,
                    "external_id": ext_id,
                    "platform_type": "argo",
                    "last_report": last_prof["timestamp"],
                    "metadata": {
                        "wmo": wmo,
                        "institution": "INCOIS",
                        "data_mode": "Authentic NetCDF (QC 1/2 verified)",
                        "profile_count": len(float_profiles)
                    }
                }
            }
            features.append(feature)

            profile_resp = {
                "instrument_id": ext_id,
                "external_id": ext_id,
                "platform_type": "argo",
                "profile_id": f"{ext_id}_prof_latest",
                "timestamp": last_prof["timestamp"],
                "latitude": last_prof["latitude"],
                "longitude": last_prof["longitude"],
                "metadata": {
                    "wmo": wmo,
                    "institution": "INCOIS",
                    "data_mode": "Authentic NetCDF (QC 1/2 verified)",
                    "qc_passed": True
                },
                "measurements": last_prof["measurements"]
            }
            profiles_dict[ext_id] = profile_resp
            profiles_dict[wmo] = profile_resp
            print(f"-> Ingested authentic Argo float WMO {wmo} with {len(float_profiles)} profiles!")

    feature_collection = {
        "type": "FeatureCollection",
        "features": features
    }

    # Save instruments and profiles to JSON
    json_targets = ["api/data", "frontend/public/api"]
    for jt in json_targets:
        os.makedirs(jt, exist_ok=True)
        with open(os.path.join(jt, "instruments.json"), "w") as f:
            json.dump(feature_collection, f, indent=2)

        prof_dir = os.path.join(jt, "profiles")
        os.makedirs(prof_dir, exist_ok=True)
        for key, p_data in profiles_dict.items():
            with open(os.path.join(prof_dir, f"{key}.json"), "w") as f:
                json.dump(p_data, f, indent=2)

    print("=== Real Data Generation & Tile Ingestion Completed Successfully! ===")

if __name__ == "__main__":
    main()
