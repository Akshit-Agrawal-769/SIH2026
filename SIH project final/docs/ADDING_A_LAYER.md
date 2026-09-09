# Developer Guide: Adding a New Ocean Sensor or Data Layer

The INCOIS 3D Ocean Data Visualization Platform is engineered with a **zero-touch plugin architecture**. Adding a new in-situ sensor stream (e.g., Moored Buoy, Wave Glider, High-Frequency Radar station, Animal-borne CTD tag) or numerical model variable requires:
1. **One new backend adapter file** (`data-service/app/ingestion/<sensor_name>.py`) implementing the `IngestionAdapter` ABC.
2. **One new frontend layer definition** in `frontend/src/layers/registry.ts` calling `registerLayer()`.

**Zero modifications to shared core code are required.** This document walks through adding a new sensor end-to-end in under 15 minutes.

---

## Architecture Overview

```
[External Sensor Telemetry] (FTP / ERDDAP / REST / NetCDF / CSV)
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ Backend: IngestionAdapter Plugin                       │
│ - Decorated with @register_adapter("sensor_type")      │
│ - Implements fetch(), normalize(), store()             │
└───────────────────────────┬────────────────────────────┘
                            │ Persists GeoJSON & Depth Profiles
                            ▼
┌────────────────────────────────────────────────────────┐
│ PostgreSQL 15 + PostGIS Spatial Storage                │
│ (Automatically served via /api/instruments)            │
└───────────────────────────┬────────────────────────────┘
                            │ REST / WebSocket
                            ▼
┌────────────────────────────────────────────────────────┐
│ Frontend: LayerRegistry Plugin                         │
│ - registerLayer({ id: "sensor_type", category: ... })  │
│ - Automatically rendered in LeftPanel layer catalog    │
│ - Automatically rendered as 3D Cesium globe billboard  │
└────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Backend Ingestion Adapter

Create a new file `data-service/app/ingestion/wave_rider.py`:

```python
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

# Example real or simulated stations
WAVE_RIDER_STATIONS = [
    {
        "external_id": "INCOIS_WR_GOPALPUR",
        "wmo": "WR_23041",
        "platform_type": "wave_rider",
        "institution": "INCOIS Coastal Observatories",
        "lat": 19.28,
        "lon": 85.02,
        "location_name": "Gopalpur Offshore (Odisha Coast)",
        "last_report": "2024-06-05T12:00:00Z",
        "wave_height": 1.85, # Significant wave height (m)
        "wave_period": 8.4,  # Peak wave period (s)
        "sea_temp": 30.1
    }
]

@register_adapter(
    platform_type="wave_rider",
    display_name="Directional Wave Rider Buoys",
    description="Coastal moored wave rider buoys measuring directional ocean wave spectra and surface temperature.",
    sensor_parameters=["wave_height", "wave_period", "sea_temp"],
    data_frequency="30-minute spectral transmission",
    institution="INCOIS Coastal Observation Network"
)
class WaveRiderIngestionAdapter(IngestionAdapter):
    """Zero-touch plugin adapter for coastal directional wave rider buoys."""

    @property
    def platform_type(self) -> str:
        return "wave_rider"

    def fetch(self, start_date: datetime, end_date: datetime, bbox: List[float]) -> Any:
        # Connect to INCOIS LAS, ERDDAP, or internal API
        return WAVE_RIDER_STATIONS

    def normalize(self, raw_data: Any) -> List[Dict[str, Any]]:
        records = []
        for station in raw_data:
            records.append({
                "external_id": station["external_id"],
                "platform_type": "wave_rider",
                "latitude": station["lat"],
                "longitude": station["lon"],
                "last_report": datetime.fromisoformat(station["last_report"].replace("Z", "+00:00")),
                "metadata": {
                    "wmo": station["wmo"],
                    "institution": station["institution"],
                    "location_name": station["location_name"],
                    "wave_height_m": station["wave_height"],
                    "wave_period_s": station["wave_period"],
                    "surface_temp_c": station["sea_temp"]
                },
                "profiles": [
                    {
                        "cycle_number": 1,
                        "timestamp": datetime.fromisoformat(station["last_report"].replace("Z", "+00:00")),
                        "latitude": station["lat"],
                        "longitude": station["lon"],
                        "max_depth": 5.0,
                        "measurements": [
                            {"depth": 0.5, "temperature": station["sea_temp"], "salinity": 32.5}
                        ]
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
            else:
                inst.location = geom
                inst.last_report = item["last_report"]
                inst.metadata_json = item["metadata"]
            db.commit()
            stored_count += 1
        return stored_count
```

---

## Step 2: Register in Backend Registry

Add one line to `data-service/app/ingestion/__init__.py`:

```python
from app.ingestion import wave_rider
```

### Verify Backend Introspection:
Query `GET /api/instruments/adapters`:
```bash
curl http://localhost:4000/api/instruments/adapters
```
The new adapter `wave_rider` will automatically appear in the registered driver list!

---

## Step 3: Register Frontend Layer

In `frontend/src/layers/registry.ts`, call `registerLayer()`:

```typescript
registerLayer({
  id: 'wave_rider',
  name: 'Wave Rider Buoys',
  category: 'observation',
  description: 'Coastal directional waverider buoys monitoring wave spectra and sea state',
  defaultVisible: true,
  color: '#00e5ff',
  badge: 'Wave Spectra',
  iconName: 'waves'
});
```

---

## Step 4: Result & Verification

1. **Left Panel Layer Catalog**:
   - Open `http://localhost:3000`.
   - Look at the **In-Situ Observation Platforms** section in the Left Panel.
   - The new **Wave Rider Buoys** toggle appears automatically with its badge and icon.
2. **3D Globe Visualization**:
   - The waverider buoys appear at their georeferenced coordinates with glowing radar halo markers and telemetry badges.
3. **Interactive Telemetry**:
   - Clicking the buoy triggers smooth camera flight to the station and opens the sensor telemetry HUD and depth chart modal.

**Zero changes were made to existing render loops, shader pipelines, or UI layout code.**
