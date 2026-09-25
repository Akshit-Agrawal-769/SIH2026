import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from app import analytics_engine as ae
from app.ingestion.base import IngestionAdapter
from app.ingestion.registry import register_adapter

try:
    from sqlalchemy.orm import Session
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point
    from app.db.models import Instrument, Profile, Measurement
except Exception:
    Session = Any
    from_shape = None
    Point = None
    Instrument = None
    Profile = None
    Measurement = None


def _parse_time(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


@register_adapter(
    platform_type="argo",
    display_name="Argo Autonomous Profiling Floats",
    description="Latest QC-filtered ascending profile per float, built from Argo GDAC NetCDF by "
                "scripts/build_authentic_dataset.py (QC flags 1/2, adjusted values for A/D modes, "
                "TEOS-10 depth).",
    sensor_parameters=["temperature", "salinity", "pressure", "oxygen", "chlorophyll"],
    data_frequency="~10-day profiling cycle",
    institution="Argo GDAC (per-float data centre in metadata)"
)
class ArgoIngestionAdapter(IngestionAdapter):
    @property
    def platform_type(self) -> str:
        return "argo"

    def fetch(self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
              bbox: Optional[List[float]] = None) -> List[Dict[str, Any]]:
        """Catalogued float profiles filtered by time window and bbox (lon/lat order)."""
        instruments = ae.load_instruments() or {"features": []}
        out = []
        for f in instruments["features"]:
            prof = ae.load_profile(f["id"])
            if not prof:
                continue
            when = _parse_time(prof["timestamp"])
            if start_date and when < start_date:
                continue
            if end_date and when > end_date:
                continue
            if bbox and not (bbox[0] <= prof["longitude"] <= bbox[2] and bbox[1] <= prof["latitude"] <= bbox[3]):
                continue
            out.append(prof)
        return out

    def normalize(self, raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        records = []
        for prof in raw_data:
            when = _parse_time(prof["timestamp"])
            records.append({
                "external_id": prof["external_id"],
                "platform_type": "argo",
                "latitude": prof["latitude"],
                "longitude": prof["longitude"],
                "last_report": when,
                "metadata": prof.get("metadata", {}),
                "profiles": [{
                    "cycle_number": prof.get("cycle_number"),
                    "timestamp": when,
                    "latitude": prof["latitude"],
                    "longitude": prof["longitude"],
                    "max_depth": max((m["depth"] for m in prof["measurements"]), default=None),
                    "measurements": prof["measurements"],
                }],
            })
        return records

    def store(self, normalized_data: List[Dict[str, Any]], db: Session) -> int:
        """Upsert instruments and their latest profile into PostGIS."""
        stored_count = 0
        for item in normalized_data:
            geom = from_shape(Point(item["longitude"], item["latitude"]), srid=4326)
            inst = db.query(Instrument).filter(Instrument.external_id == item["external_id"]).first()
            if not inst:
                inst = Instrument(id=uuid.uuid4(), external_id=item["external_id"], platform_type="argo",
                                  location=geom, last_report=item["last_report"], metadata_json=item["metadata"])
                db.add(inst)
                db.flush()
            else:
                inst.location = geom
                inst.last_report = item["last_report"]
                inst.metadata_json = item["metadata"]

            for prof_data in item["profiles"]:
                exists = db.query(Profile).filter(Profile.instrument_id == inst.id,
                                                  Profile.cycle_number == prof_data["cycle_number"]).first()
                if exists:
                    continue
                profile = Profile(id=uuid.uuid4(), instrument_id=inst.id, cycle_number=prof_data["cycle_number"],
                                  timestamp=prof_data["timestamp"], latitude=prof_data["latitude"],
                                  longitude=prof_data["longitude"], max_depth=prof_data["max_depth"],
                                  metadata_json={"qc_policy": item["metadata"].get("qc_policy"),
                                                 "source_file": item["metadata"].get("source_file")})
                db.add(profile)
                db.flush()
                for m in prof_data["measurements"]:
                    db.add(Measurement(profile_id=profile.id, depth=m["depth"], pressure=m.get("pressure"),
                                       temperature=m.get("temperature"), salinity=m.get("salinity"),
                                       chlorophyll=m.get("chlorophyll"), oxygen=m.get("oxygen")))
            stored_count += 1
        db.commit()
        return stored_count
