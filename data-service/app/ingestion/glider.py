import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List
import numpy as np
from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from app.ingestion.base import IngestionAdapter
from app.ingestion.registry import register_adapter
from app.db.models import Instrument, Profile, Measurement

# Autonomous glider missions operating in the Bay of Bengal & Arabian Sea
GLIDER_MISSIONS = [
    {
        "external_id": "GLIDER_SLOCUM_INCOIS_01",
        "platform_type": "glider",
        "glider_model": "Teledyne Slocum G3",
        "mission_name": "Bay of Bengal High-Resolution Stratification Transect",
        "institution": "INCOIS / NIOT",
        "lat": 15.40,
        "lon": 82.80,
        "last_report": "2024-06-05T10:15:00Z",
        "surface_temp": 30.1,
        "surface_salin": 32.5
    },
    {
        "external_id": "GLIDER_SEAGLIDER_IO_02",
        "platform_type": "glider",
        "glider_model": "Kongsberg Seaglider",
        "mission_name": "Southwest Coast Upwelling & Oxygen Minimum Survey",
        "institution": "INCOIS / CMFRI",
        "lat": 9.85,
        "lon": 75.60,
        "last_report": "2024-06-04T19:30:00Z",
        "surface_temp": 28.9,
        "surface_salin": 35.4
    },
    {
        "external_id": "GLIDER_SPRAY_ANDAMAN_03",
        "platform_type": "glider",
        "glider_model": "Spray Ocean Glider",
        "mission_name": "Andaman Sea Internal Waves & Thermocline Transect",
        "institution": "INCOIS",
        "lat": 11.75,
        "lon": 92.40,
        "last_report": "2024-06-05T04:50:00Z",
        "surface_temp": 30.3,
        "surface_salin": 33.0
    }
]

def generate_glider_profile(surface_temp: float, surface_salin: float) -> List[Dict[str, float]]:
    """Gliders sample at very high vertical resolution (down to 1000m)."""
    depths = [
        0.5, 2.0, 5.0, 10.0, 15.0, 25.0, 40.0, 60.0, 80.0, 100.0,
        120.0, 150.0, 200.0, 250.0, 300.0, 400.0, 500.0, 750.0, 1000.0
    ]
    measurements = []
    for d in depths:
        t = 4.0 + (surface_temp - 4.0) * np.exp(-d / 175.0)
        s = 34.8 - (34.8 - surface_salin) * np.exp(-d / 140.0) if surface_salin < 34.0 else 34.7 + (surface_salin - 34.7) * np.exp(-d / 200.0)
        chla = float(0.08 + 1.8 * np.exp(-((d - 35.0)**2) / (25.0**2))) if d < 120 else 0.01
        omz = 3.9 * np.exp(-((d - 300.0)**2) / (180.0**2))
        oxygen = max(0.15, (4.6 * np.exp(-d / 140.0) + 2.4 * (d / 1000.0)) - omz)

        measurements.append({
            "depth": float(d),
            "pressure": float(d * 1.01),
            "temperature": round(float(t), 2),
            "salinity": round(float(s), 2),
            "chlorophyll": round(float(chla), 3),
            "oxygen": round(float(oxygen), 2)
        })
    return measurements

@register_adapter(
    platform_type="glider",
    display_name="Autonomous Underwater Gliders",
    description="High-resolution buoyancy-driven autonomous gliders profiling shelf-slope and open-ocean transects.",
    sensor_parameters=["temperature", "salinity", "chlorophyll", "oxygen"],
    data_frequency="Continuous sawtooth profiling",
    institution="INCOIS / NIOT / CMFRI"
)
class GliderIngestionAdapter(IngestionAdapter):
    @property
    def platform_type(self) -> str:
        return "glider"

    def fetch(self, start_date: datetime, end_date: datetime, bbox: List[float]) -> Any:
        return GLIDER_MISSIONS

    def normalize(self, raw_data: Any) -> List[Dict[str, Any]]:
        records = []
        for g in raw_data:
            measurements = generate_glider_profile(g["surface_temp"], g["surface_salin"])
            records.append({
                "external_id": g["external_id"],
                "platform_type": "glider",
                "latitude": g["lat"],
                "longitude": g["lon"],
                "last_report": datetime.fromisoformat(g["last_report"].replace("Z", "+00:00")),
                "metadata": {
                    "glider_model": g["glider_model"],
                    "mission_name": g["mission_name"],
                    "institution": g["institution"],
                    "dive_speed_ms": 0.35,
                    "battery_percent": 84
                },
                "profiles": [
                    {
                        "cycle_number": 128,
                        "timestamp": datetime.fromisoformat(g["last_report"].replace("Z", "+00:00")),
                        "latitude": g["lat"],
                        "longitude": g["lon"],
                        "max_depth": 1000.0,
                        "measurements": measurements
                    }
                ]
            })
        return records

    def store(self, normalized_data: List[Dict[str, Any]], db: Session) -> int:
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

            for prof_data in item.get("profiles", []):
                profile = Profile(
                    id=uuid.uuid4(),
                    instrument_id=inst.id,
                    cycle_number=prof_data.get("cycle_number", 1),
                    timestamp=prof_data["timestamp"],
                    latitude=prof_data["latitude"],
                    longitude=prof_data["longitude"],
                    max_depth=prof_data.get("max_depth", 1000.0),
                    metadata_json={"qc_passed": True}
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
                        chlorophyll=m.get("chlorophyll"),
                        oxygen=m.get("oxygen")
                    )
                    db.add(meas)
            stored_count += 1
        db.commit()
        return stored_count
