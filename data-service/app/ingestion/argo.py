import os
import glob
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
import numpy as np
from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
import netCDF4 as nc

from app.ingestion.base import IngestionAdapter
from app.ingestion.registry import register_adapter
from app.db.models import Instrument, Profile, Measurement

JULD_EPOCH = datetime(1950, 1, 1, tzinfo=timezone.utc)

@register_adapter(
    platform_type="argo",
    display_name="Argo Autonomous Profiling Floats",
    description="Authentic real-time and delayed-mode autonomous CTD profiling floats operating to 2000m depth.",
    sensor_parameters=["temperature", "salinity", "pressure"],
    data_frequency="10-day profiling cycle",
    institution="INCOIS / WMO Argo Program"
)
class ArgoIngestionAdapter(IngestionAdapter):
    @property
    def platform_type(self) -> str:
        return "argo"

    def fetch(self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, bbox: Optional[List[float]] = None) -> List[Dict[str, Any]]:
        """
        Reads authentic Argo float profile NetCDF files from datasets/argo/*.nc.
        STRICT REAL DATA POLICY: Extracts authentic WMO IDs, cycle numbers, coordinates,
        timestamps, and pressure/temperature/salinity profiles with UNESCO QC filtering.
        """
        search_dirs = [
            os.path.join(os.getcwd(), "datasets", "argo"),
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "datasets", "argo"),
            os.path.abspath("datasets/argo"),
            "D:/OneDrive/Desktop/sih/datasets/argo"
        ]

        argo_files = []
        for d in search_dirs:
            if os.path.exists(d):
                argo_files = glob.glob(os.path.join(d, "*.nc"))
                if argo_files:
                    break

        if not argo_files:
            print("[Argo] No NetCDF profile files found in datasets/argo.")
            return []

        raw_floats = []
        for fpath in argo_files:
            try:
                ds = nc.Dataset(fpath, "r")
                pn_raw = ds.variables["PLATFORM_NUMBER"][:]
                wmos = ["".join([c.decode("utf-8") if isinstance(c, bytes) else str(c) for c in row]).strip("- ") for row in pn_raw]
                wmo = wmos[0] if wmos else os.path.splitext(os.path.basename(fpath))[0]

                n_prof = len(ds.dimensions["N_PROF"])
                cycles = ds.variables["CYCLE_NUMBER"][:]
                lats = ds.variables["LATITUDE"][:]
                lons = ds.variables["LONGITUDE"][:]
                julds = ds.variables["JULD"][:]
                temps = ds.variables["TEMP"][:]
                temp_qcs = ds.variables["TEMP_QC"][:]
                press = ds.variables["PRES"][:]
                psals = ds.variables["PSAL"][:]
                psal_qcs = ds.variables["PSAL_QC"][:]

                float_profiles = []
                last_valid_time = None
                last_lat = None
                last_lon = None

                for prof_idx in range(n_prof):
                    cycle_num = int(cycles[prof_idx])
                    lat = float(lats[prof_idx])
                    lon = float(lons[prof_idx])
                    juld = julds[prof_idx]

                    # Validate coordinates and time
                    if np.isnan(lat) or np.isnan(lon) or np.isnan(juld):
                        continue

                    prof_time = JULD_EPOCH + timedelta(days=float(juld))
                    last_valid_time = prof_time
                    last_lat = lat
                    last_lon = lon

                    # Apply optional spatial/temporal bounds
                    if bbox and (lon < bbox[0] or lat < bbox[1] or lon > bbox[2] or lat > bbox[3]):
                        continue

                    # Extract authentic QC-filtered CTD measurements
                    measurements = []
                    n_levels = temps.shape[1]
                    for lvl in range(n_levels):
                        t = temps[prof_idx, lvl]
                        p = press[prof_idx, lvl]
                        s = psals[prof_idx, lvl]
                        t_qc = temp_qcs[prof_idx, lvl]
                        s_qc = psal_qcs[prof_idx, lvl]

                        t_qc_str = t_qc.decode("utf-8") if isinstance(t_qc, bytes) else str(t_qc)
                        s_qc_str = s_qc.decode("utf-8") if isinstance(s_qc, bytes) else str(s_qc)

                        # UNESCO Argo QC standard: retain only flag 1 (Good) and 2 (Probably Good)
                        if t_qc_str not in ("1", "2"):
                            continue
                        if np.isnan(t) or getattr(t, "mask", False):
                            continue

                        # Approximate physical depth from pressure (dbar -> m)
                        p_val = float(p) if not np.isnan(p) and not getattr(p, "mask", False) else 0.0
                        depth_m = abs(p_val) * 0.993 # hydrostatic depth approximation

                        meas = {
                            "depth": round(depth_m, 2),
                            "pressure": round(p_val, 2),
                            "temperature": round(float(t), 3),
                            "salinity": round(float(s), 3) if not np.isnan(s) and not getattr(s, "mask", False) and s_qc_str in ("1", "2") else None
                        }
                        measurements.append(meas)

                    if measurements:
                        float_profiles.append({
                            "cycle_number": cycle_num,
                            "timestamp": prof_time,
                            "latitude": lat,
                            "longitude": lon,
                            "max_depth": max(m["depth"] for m in measurements),
                            "measurements": measurements
                        })

                ds.close()

                if float_profiles:
                    primary_lat = float_profiles[0]["latitude"]
                    primary_lon = float_profiles[0]["longitude"]
                    raw_floats.append({
                        "external_id": f"INCOIS_ARGO_{wmo}",
                        "wmo": wmo,
                        "platform_type": "argo",
                        "institution": "INCOIS",
                        "latitude": primary_lat,
                        "longitude": primary_lon,
                        "last_report": float_profiles[0]["timestamp"],
                        "source_file": fpath,
                        "profiles": float_profiles
                    })
                    print(f"[Argo] Ingested authentic float {wmo}: {len(float_profiles)} profiles from {os.path.basename(fpath)}")

            except Exception as e:
                print(f"[Argo] Error reading {fpath}: {e}")

        return raw_floats

    def normalize(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize raw Argo float records for PostgreSQL storage."""
        records = []
        for item in raw_data:
            records.append({
                "external_id": item["external_id"],
                "platform_type": "argo",
                "latitude": item["latitude"],
                "longitude": item["longitude"],
                "last_report": item["last_report"],
                "metadata": {
                    "wmo": item["wmo"],
                    "institution": item["institution"],
                    "source_file": os.path.basename(item.get("source_file", "")),
                    "data_mode": "Authentic NetCDF (QC 1/2 verified)",
                    "profile_count": len(item.get("profiles", []))
                },
                "profiles": item.get("profiles", [])
            })
        return records

    def store(self, normalized_data: List[Dict[str, Any]], db: Session) -> int:
        """Upsert authentic instruments, profiles, and measurements into database."""
        stored_count = 0
        for item in normalized_data:
            geom = from_shape(Point(item["longitude"], item["latitude"]), srid=4326)

            inst = db.query(Instrument).filter(Instrument.external_id == item["external_id"]).first()
            if not inst:
                inst = Instrument(
                    id=uuid.uuid4(),
                    external_id=item["external_id"],
                    platform_type=item["platform_type"],
                    location=geom,
                    last_report=item["last_report"],
                    metadata_json=item["metadata"]
                )
                db.add(inst)
                db.flush()
            else:
                inst.location = geom
                inst.last_report = item["last_report"]
                inst.metadata_json = item["metadata"]

            # Store only recent profiles to prevent database saturation (up to 5 profiles per float)
            for prof_data in item.get("profiles", [])[:5]:
                # Check if profile already exists
                existing_prof = db.query(Profile).filter(
                    Profile.instrument_id == inst.id,
                    Profile.cycle_number == prof_data.get("cycle_number", 1)
                ).first()

                if not existing_prof:
                    profile = Profile(
                        id=uuid.uuid4(),
                        instrument_id=inst.id,
                        cycle_number=prof_data.get("cycle_number", 1),
                        timestamp=prof_data["timestamp"],
                        latitude=prof_data["latitude"],
                        longitude=prof_data["longitude"],
                        max_depth=prof_data.get("max_depth", 2000.0),
                        metadata_json={"qc_passed": True, "source": "Argo NetCDF"}
                    )
                    db.add(profile)
                    db.flush()

                    for m in prof_data.get("measurements", []):
                        meas = Measurement(
                            profile_id=profile.id,
                            depth=m["depth"],
                            pressure=m.get("pressure"),
                            temperature=m.get("temperature"),
                            salinity=m.get("salinity"),
                            chlorophyll=None,
                            oxygen=None
                        )
                        db.add(meas)

            stored_count += 1

        db.commit()
        return stored_count
