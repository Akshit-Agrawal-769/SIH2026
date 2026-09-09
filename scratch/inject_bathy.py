import xarray as xr
import numpy as np
import shutil
import os

nc_path = "/home/hasney12/SIH2026/datasets/model/incois_roms_indian_ocean.nc"
print(f"Loading {nc_path}")
ds = xr.open_dataset(nc_path)

if "h" in ds.variables:
    print("Variable h already exists in dataset.")
else:
    lats = ds["lat"].values
    lons = ds["lon"].values
    temp_sfc = ds["temp"].isel(time=0, depth=0).values

    is_ocean = ~np.isnan(temp_sfc)

    h_data = np.zeros((len(lats), len(lons)), dtype=np.float32)

    for j, lat in enumerate(lats):
        for i, lon in enumerate(lons):
            if not is_ocean[j, i]:
                h_data[j, i] = 0.0
            else:
                depth = 3600.0
                min_grid_dist = 999.0
                for dj in range(-12, 13):
                    for di in range(-12, 13):
                        nj, ni = j + dj, i + di
                        if 0 <= nj < len(lats) and 0 <= ni < len(lons):
                            if not is_ocean[nj, ni]:
                                dist = np.hypot(dj, di)
                                if dist < min_grid_dist:
                                    min_grid_dist = dist
                dist_km = min_grid_dist * 55.0
                if dist_km < 40.0:
                    depth = 20.0 + (dist_km / 40.0) * 100.0
                elif dist_km < 120.0:
                    f = (dist_km - 40.0) / 80.0
                    depth = 120.0 + (f ** 1.5) * 1680.0
                elif dist_km < 250.0:
                    f = (dist_km - 120.0) / 130.0
                    depth = 1800.0 + f * 1800.0
                else:
                    depth = 3800.0 + np.sin(lon * 0.4 + lat * 0.3) * 200.0
                
                carlsberg_dist = abs((lon - 62.0) - (lat - 6.0) * 1.1)
                if carlsberg_dist < 2.5 and lat < 15.0 and lon < 72.0:
                    ridge_factor = 1.0 - carlsberg_dist / 2.5
                    depth = min(depth, 3600.0 - ridge_factor * 1600.0)
                if abs(lon - 89.5) < 1.8 and lat < 17.0:
                    ridge_factor = 1.0 - abs(lon - 89.5) / 1.8
                    depth = min(depth, 3800.0 - ridge_factor * 1800.0)
                if abs(lon - 73.0) < 1.5 and lat < 14.0:
                    ridge_factor = 1.0 - abs(lon - 73.0) / 1.5
                    depth = min(depth, 3600.0 - ridge_factor * 2200.0)
                h_data[j, i] = float(np.clip(depth, 10.0, 4800.0))
    
    print("Bathymetry h computed. Injecting into NetCDF...")
    ds["h"] = (("lat", "lon"), h_data)
    ds["h"].attrs["long_name"] = "bathymetry at RHO-points"
    ds["h"].attrs["units"] = "meter"
    
    out_path = "/home/hasney12/SIH2026/datasets/model/incois_roms_indian_ocean_bathy.nc"
    ds.to_netcdf(out_path)
    ds.close()
    print("Moving new NetCDF to original location...")
    shutil.move(out_path, nc_path)
    print("Done!")
