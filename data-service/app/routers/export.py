import os
import tempfile
from datetime import datetime
import numpy as np
import netCDF4 as nc
from typing import Optional, List
from fastapi import APIRouter, Response, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse

from app.processing.voxelize import (
    get_grid_coordinates,
    STANDARD_DEPTH_LEVELS,
    LON_MIN, LON_MAX, LAT_MIN, LAT_MAX,
    GRID_WIDTH, GRID_HEIGHT, GRID_DEPTH
)
from app.config import DATE_RANGE_START
from app.processing.pack_texture import download_tile_from_minio

router = APIRouter(prefix="/export", tags=["export"])

VAR_SPECS = {
    "temperature": {
        "standard_name": "sea_water_potential_temperature",
        "long_name": "Potential Temperature of Sea Water",
        "units": "degree_Celsius",
    },
    "salinity": {
        "standard_name": "sea_water_practical_salinity",
        "long_name": "Practical Salinity of Sea Water",
        "units": "1",
    },
    "currents": {
        "standard_name": "sea_water_speed",
        "long_name": "Ocean Current Velocity Magnitude",
        "units": "m s-1",
    },
    "chlorophyll": {
        "standard_name": "mass_concentration_of_chlorophyll_a_in_sea_water",
        "long_name": "Concentration of Chlorophyll-a in Sea Water",
        "units": "mg m-3",
    }
}

def remove_temp_file(path: str):
    """Background task to safely clean up temporary NetCDF file after streaming."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        print(f"[Export] Cleanup warning for {path}: {e}")

@router.get("/netcdf")
def export_netcdf(
    background_tasks: BackgroundTasks,
    variable: str = Query("temperature", description="Ocean variable: temperature, salinity, currents, chlorophyll, or all"),
    date: str = Query(DATE_RANGE_START, description="Simulation date (YYYY-MM-DD)"),
    min_lon: float = Query(LON_MIN, description="Western boundary longitude"),
    max_lon: float = Query(LON_MAX, description="Eastern boundary longitude"),
    min_lat: float = Query(LAT_MIN, description="Southern boundary latitude"),
    max_lat: float = Query(LAT_MAX, description="Northern boundary latitude"),
    min_depth: float = Query(0.0, description="Minimum depth (m)"),
    max_depth: float = Query(2000.0, description="Maximum depth (m)")
):
    """
    Generate and stream on-demand Climate & Forecast (CF-1.8) compliant NetCDF-4 file.
    Compatible with Python xarray, Ferret, Panoply, and GIS desktop suites.
    """
    target_vars = ["temperature", "salinity", "currents", "chlorophyll"] if variable == "all" else [variable]
    for v in target_vars:
        if v not in VAR_SPECS:
            raise HTTPException(status_code=400, detail=f"Unknown variable '{v}'. Supported: temperature, salinity, currents, chlorophyll, all")

    # 1. Coordinate grids
    full_lons, full_lats, full_depths = get_grid_coordinates()

    lon_mask = (full_lons >= min_lon) & (full_lons <= max_lon)
    lat_mask = (full_lats >= min_lat) & (full_lats <= max_lat)
    depth_mask = (full_depths >= min_depth) & (full_depths <= max_depth)

    sub_lons = full_lons[lon_mask]
    sub_lats = full_lats[lat_mask]
    sub_depths = full_depths[depth_mask]

    if len(sub_lons) == 0 or len(sub_lats) == 0 or len(sub_depths) == 0:
        raise HTTPException(status_code=400, detail="Bounding box / depth range selects 0 grid cells.")

    # Calculate day index relative to base date 2024-06-01
    try:
        d_obj = datetime.strptime(date, "%Y-%m-%d")
        base_obj = datetime.strptime(DATE_RANGE_START, "%Y-%m-%d")
        day_val = float((d_obj - base_obj).days)
    except Exception:
        day_val = 0.0

    # 2. Create NetCDF-4 file
    temp_file = tempfile.NamedTemporaryFile(suffix=".nc", delete=False)
    temp_path = temp_file.name
    temp_file.close()

    try:
        with nc.Dataset(temp_path, "w", format="NETCDF4") as ds:
            # Global Attributes (CF-1.8 Standard)
            ds.title = "INCOIS 3D High-Resolution Numerical Ocean Model Output"
            ds.institution = "Indian National Centre for Ocean Information Services (INCOIS), MoES, Govt of India"
            ds.source = "INCOIS Regional Ocean Modeling System (ROMS) with in-situ Argo/Moored Buoy assimilation"
            ds.references = "https://incois.gov.in"
            ds.Conventions = "CF-1.8"
            ds.history = f"Exported on {datetime.utcnow().isoformat()}Z via INCOIS 3D Web Visualization Platform"
            ds.geospatial_lat_min = float(sub_lats.min())
            ds.geospatial_lat_max = float(sub_lats.max())
            ds.geospatial_lon_min = float(sub_lons.min())
            ds.geospatial_lon_max = float(sub_lons.max())
            ds.geospatial_vertical_min = float(sub_depths.min())
            ds.geospatial_vertical_max = float(sub_depths.max())

            # Dimensions
            ds.createDimension("time", 1)
            ds.createDimension("depth", len(sub_depths))
            ds.createDimension("latitude", len(sub_lats))
            ds.createDimension("longitude", len(sub_lons))

            # Coordinate Variables
            v_time = ds.createVariable("time", "f8", ("time",))
            v_time.standard_name = "time"
            v_time.long_name = "Time"
            v_time.units = f"days since {DATE_RANGE_START} 00:00:00"
            v_time.calendar = "standard"
            v_time.axis = "T"
            v_time[:] = [day_val]

            v_depth = ds.createVariable("depth", "f4", ("depth",))
            v_depth.standard_name = "depth"
            v_depth.long_name = "Depth Below Sea Surface"
            v_depth.units = "m"
            v_depth.positive = "down"
            v_depth.axis = "Z"
            v_depth[:] = sub_depths

            v_lat = ds.createVariable("latitude", "f4", ("latitude",))
            v_lat.standard_name = "latitude"
            v_lat.long_name = "Latitude"
            v_lat.units = "degrees_north"
            v_lat.axis = "Y"
            v_lat[:] = sub_lats

            v_lon = ds.createVariable("longitude", "f4", ("longitude",))
            v_lon.standard_name = "longitude"
            v_lon.long_name = "Longitude"
            v_lon.units = "degrees_east"
            v_lon.axis = "X"
            v_lon[:] = sub_lons

            # Data Variables
            fill_value = -9999.0
            for v_name in target_vars:
                spec = VAR_SPECS[v_name]
                dvar = ds.createVariable(
                    v_name,
                    "f4",
                    ("time", "depth", "latitude", "longitude"),
                    fill_value=fill_value,
                    zlib=True,
                    complevel=4
                )
                # Retrieve authentic binary tile produced by C++ ocean_core
                tile_bytes = download_tile_from_minio(v_name, date, 0.5)
                if not tile_bytes:
                    raise HTTPException(
                        status_code=404,
                        detail=f"No authentic data tile found for '{v_name}' at {date}. Strictly NO synthetic generation permitted."
                    )

                # Unpack 32-byte header + Float32 array
                import struct
                header = struct.unpack("<4sHHHHHHff8s", tile_bytes[:32])
                w, h = header[3], header[4]
                raw_slice = np.frombuffer(tile_bytes[32:], dtype=np.float32).reshape((h, w))

                # Broadcast or subset across selected depths
                sub_vol = np.zeros((len(sub_depths), len(sub_lats), len(sub_lons)), dtype=np.float32)
                # Resample or assign authentic slice to surface level (depth = 0.5m)
                from scipy.ndimage import zoom
                zoom_factors = (len(sub_lats) / float(h), len(sub_lons) / float(w))
                resampled = zoom(np.nan_to_num(raw_slice, nan=fill_value), zoom_factors, order=0)
                sub_vol[0, :, :] = resampled
                for d_i in range(1, len(sub_depths)):
                    sub_vol[d_i, :, :] = fill_value

                # Assign to (time=0, depth, lat, lon)
                dvar[0, :, :, :] = sub_vol

        # Queue file cleanup after response is delivered
        background_tasks.add_task(remove_temp_file, temp_path)

        filename = f"INCOIS_{variable}_{date}.nc"
        return FileResponse(
            path=temp_path,
            filename=filename,
            media_type="application/x-netcdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-CF-Conventions": "CF-1.8"
            }
        )

    except Exception as e:
        remove_temp_file(temp_path)
        raise HTTPException(status_code=500, detail=f"Failed to generate NetCDF: {str(e)}")
