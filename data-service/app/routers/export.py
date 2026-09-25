import os
import tempfile
from datetime import datetime, timezone
from typing import Optional

import netCDF4 as nc
import numpy as np
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse

from app import analytics_engine as ae

router = APIRouter(prefix="/export", tags=["export"])

CF_NAMES = {
    "temperature": ("sea_surface_temperature", "degree_Celsius"),
    "salinity": ("sea_surface_salinity", "1e-3"),
    "chlorophyll": ("mass_concentration_of_chlorophyll_a_in_sea_water", "mg m-3"),
    "currents": ("sea_water_speed", "m s-1"),
    "mld": ("ocean_mixed_layer_thickness", "m"),
}


def remove_temp_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError as e:
        print(f"[Export] Cleanup warning for {path}: {e}")


@router.get("/netcdf")
def export_netcdf(
    background_tasks: BackgroundTasks,
    variable: str = Query("temperature", description="Catalog variable, or 'all' for every variable at this date"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD; defaults to the latest timestep of the variable"),
    min_lon: float = Query(35.0), max_lon: float = Query(100.0),
    min_lat: float = Query(-10.0), max_lat: float = Query(25.0),
):
    """
    CF-1.8 NetCDF-4 subset of catalogued tiles. Coordinates are the exact cell
    centres of the served grid; values are copied unchanged (NaN -> _FillValue).
    Only real depth levels and the real timestep are written.
    """
    cat = ae.get_catalog()
    if not cat:
        raise HTTPException(status_code=503, detail="Data catalog missing")
    if variable == "all":
        ref_date = ae.normalize_date(date) or ae.latest_timestep("temperature")
        targets = [v for v, m in cat["variables"].items() if ref_date in m["timesteps"]]
        d = ref_date
    else:
        if variable not in cat["variables"]:
            raise HTTPException(status_code=400, detail=f"Unknown variable '{variable}'")
        d, err = ae.resolve_date(variable, date)
        if err:
            raise HTTPException(status_code=404, detail=err)
        targets = [variable]
    if not targets:
        raise HTTPException(status_code=404, detail=f"No variables have data at {date}")

    g = cat["grid"]
    lats = g["lat0"] + g["dlat"] * np.arange(g["height"])
    lons = g["lon0"] + g["dlon"] * np.arange(g["width"])
    jj = np.where((lats >= min_lat) & (lats <= max_lat))[0]
    ii = np.where((lons >= min_lon) & (lons <= max_lon))[0]
    if len(jj) == 0 or len(ii) == 0:
        raise HTTPException(status_code=400, detail="Bounding box selects 0 grid cells.")
    depths = sorted({float(z) for v in targets for z in cat["variables"][v]["depths"]})

    tmp = tempfile.NamedTemporaryFile(suffix=".nc", delete=False)
    tmp_path = tmp.name
    tmp.close()
    try:
        with nc.Dataset(tmp_path, "w", format="NETCDF4") as ds:
            sources = sorted({cat["variables"][v]["source_id"] for v in targets})
            ds.Conventions = "CF-1.8"
            ds.title = "INCOIS 3D Ocean Platform gridded subset"
            ds.source = "; ".join(cat["sources"][s]["title"] for s in sources)
            ds.references = "; ".join(cat["sources"][s].get("doi_url") or cat["sources"][s].get("product_id", "")
                                      for s in sources)
            ds.institution = "; ".join(cat["sources"][s].get("institution", "") for s in sources)
            ds.processing = ("Regridded to 0.125 deg cell centres by scripts/build_authentic_dataset.py; "
                             "values copied unchanged from the served tiles.")
            ds.history = f"{datetime.now(timezone.utc).isoformat()} exported by INCOIS 3D Ocean data-service"
            ds.geospatial_lat_min, ds.geospatial_lat_max = float(lats[jj].min()), float(lats[jj].max())
            ds.geospatial_lon_min, ds.geospatial_lon_max = float(lons[ii].min()), float(lons[ii].max())

            ds.createDimension("time", 1)
            ds.createDimension("depth", len(depths))
            ds.createDimension("latitude", len(jj))
            ds.createDimension("longitude", len(ii))
            vt = ds.createVariable("time", "f8", ("time",))
            vt.standard_name, vt.units, vt.calendar, vt.axis = "time", "days since 1970-01-01 00:00:00", "standard", "T"
            vt[:] = [(datetime.strptime(d, "%Y-%m-%d") - datetime(1970, 1, 1)).days]
            vz = ds.createVariable("depth", "f4", ("depth",))
            vz.standard_name, vz.units, vz.positive, vz.axis = "depth", "m", "down", "Z"
            vz[:] = depths
            vy = ds.createVariable("latitude", "f8", ("latitude",))
            vy.standard_name, vy.units, vy.axis = "latitude", "degrees_north", "Y"
            vy[:] = lats[jj]
            vx = ds.createVariable("longitude", "f8", ("longitude",))
            vx.standard_name, vx.units, vx.axis = "longitude", "degrees_east", "X"
            vx[:] = lons[ii]
            fill = np.float32(-9999.0)
            for v in targets:
                meta = cat["variables"][v]
                std, cf_units = CF_NAMES.get(v, (meta["standard_name"], meta["units"]))
                dv = ds.createVariable(v, "f4", ("time", "depth", "latitude", "longitude"), fill_value=fill,
                                       zlib=True, complevel=4)
                dv.standard_name, dv.long_name, dv.units = std, meta["long_name"], cf_units
                dv.source = cat["sources"][meta["source_id"]]["title"]
                block = np.full((len(depths), len(jj), len(ii)), np.nan, dtype=np.float32)
                for k, z in enumerate(depths):
                    arr = ae.load_tile(v, d, z)
                    if arr is not None:
                        block[k] = arr[np.ix_(jj, ii)]
                dv[0] = np.ma.masked_invalid(block)
        background_tasks.add_task(remove_temp_file, tmp_path)
        filename = f"INCOIS_{variable}_{d}.nc"
        return FileResponse(path=tmp_path, filename=filename, media_type="application/x-netcdf",
                            headers={"X-CF-Conventions": "CF-1.8"})
    except HTTPException:
        remove_temp_file(tmp_path)
        raise
    except Exception as e:
        remove_temp_file(tmp_path)
        raise HTTPException(status_code=500, detail=f"Failed to generate NetCDF: {e}")
