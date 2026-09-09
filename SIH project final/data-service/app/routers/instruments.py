import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import cast, String

from app.db.session import get_db
from app.db.models import Instrument, Profile, Measurement
from geoalchemy2.functions import ST_AsGeoJSON, ST_MakeEnvelope, ST_Intersects

import app.ingestion  # Ensures all adapters register themselves
from app.ingestion.registry import AdapterRegistry

router = APIRouter(prefix="/instruments", tags=["instruments"])

@router.get("/adapters")
def list_adapters():
    """
    Introspection endpoint returning metadata for all registered IngestionAdapter plugins.
    Demonstrates zero-touch plug-and-play extensibility.
    """
    return {
        "status": "success",
        "count": len(AdapterRegistry.list_adapters()),
        "adapters": AdapterRegistry.list_adapters()
    }

@router.get("")
def list_instruments(
    bbox: Optional[str] = Query(None, description="minLon,minLat,maxLon,maxLat"),
    platform_type: Optional[str] = Query(None, description="argo, glider, moored_buoy, ctd, bgc"),
    db: Session = Depends(get_db)
):
    """Retrieve GeoJSON FeatureCollection of observation platforms."""
    # Ensure database is seeded with registered platforms if empty
    try:
        if db.query(Instrument).count() == 0:
            for meta in AdapterRegistry.list_adapters():
                adapter = AdapterRegistry.get_adapter(meta["platform_type"])
                if adapter:
                    raw = adapter.fetch(
                        start_date=datetime(2024, 6, 1, tzinfo=timezone.utc),
                        end_date=datetime(2024, 6, 5, tzinfo=timezone.utc),
                        bbox=[45.0, -15.0, 100.0, 30.0]
                    )
                    norm = adapter.normalize(raw)
                    adapter.store(norm, db)
    except Exception as e:
        print(f"[Instruments] Auto-seed note: {e}")

    features = []
    try:
        query = db.query(Instrument)
        if platform_type:
            query = query.filter(Instrument.platform_type == platform_type)

        # Apply spatial bbox if provided
        if bbox:
            try:
                min_lon, min_lat, max_lon, max_lat = map(float, bbox.split(","))
                envelope = ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
                query = query.filter(ST_Intersects(Instrument.location, envelope))
            except Exception:
                pass

        instruments = query.limit(500).all()

        for inst in instruments:
            geom_json = db.scalar(ST_AsGeoJSON(inst.location))
            geom = json.loads(geom_json) if geom_json else None

            features.append({
                "type": "Feature",
                "id": str(inst.id),
                "geometry": geom,
                "properties": {
                    "id": str(inst.id),
                    "external_id": inst.external_id,
                    "platform_type": inst.platform_type,
                    "last_report": inst.last_report.isoformat() if inst.last_report else None,
                    "metadata": inst.metadata_json or {}
                }
            })
    except Exception as e:
        print(f"[Instruments] DB query warning: {e}")

    return {
        "type": "FeatureCollection",
        "features": features
    }

@router.get("/{instrument_id}/profile")
def get_instrument_profile(instrument_id: str, db: Session = Depends(get_db)):
    """Retrieve the vertical CTD / sensor depth profile for a given instrument."""
    try:
        # Match by external_id (e.g. INCOIS_ARGO_2902123) or UUID
        inst = db.query(Instrument).filter(
            (Instrument.external_id == instrument_id) |
            (cast(Instrument.id, String) == instrument_id)
        ).first()

        if not inst:
            raise HTTPException(status_code=404, detail=f"Instrument '{instrument_id}' not found")

        profile = db.query(Profile).filter(
            Profile.instrument_id == inst.id
        ).order_by(Profile.timestamp.desc()).first()

        if not profile:
            raise HTTPException(status_code=404, detail="No profile observations available for instrument")

        measurements = db.query(Measurement).filter(
            Measurement.profile_id == profile.id
        ).order_by(Measurement.depth.asc()).all()

        return {
            "instrument_id": str(inst.id),
            "external_id": inst.external_id,
            "platform_type": inst.platform_type,
            "profile_id": str(profile.id),
            "timestamp": profile.timestamp.isoformat(),
            "latitude": profile.latitude,
            "longitude": profile.longitude,
            "metadata": inst.metadata_json,
            "measurements": [
                {
                    "depth": m.depth,
                    "pressure": m.pressure,
                    "temperature": m.temperature,
                    "salinity": m.salinity,
                    "chlorophyll": m.chlorophyll,
                    "oxygen": m.oxygen
                }
                for m in measurements
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest")
def trigger_ingest(db: Session = Depends(get_db)):
    """
    Trigger on-demand ingestion dynamically across all registered IngestionAdapter plugins.
    Zero hardcoded platform types — completely extensible.
    """
    ingestion_results = {}
    for meta in AdapterRegistry.list_adapters():
        p_type = meta["platform_type"]
        adapter = AdapterRegistry.get_adapter(p_type)
        if adapter:
            try:
                raw_data = adapter.fetch(
                    start_date=datetime(2024, 6, 1, tzinfo=timezone.utc),
                    end_date=datetime(2024, 6, 5, tzinfo=timezone.utc),
                    bbox=[45.0, -15.0, 100.0, 30.0]
                )
                norm_data = adapter.normalize(raw_data)
                count = adapter.store(norm_data, db)
                ingestion_results[p_type] = count
            except Exception as e:
                ingestion_results[p_type] = f"Error: {str(e)}"

    return {
        "status": "success",
        "adapters_executed": len(ingestion_results),
        "details": ingestion_results,
        "total_instruments": db.query(Instrument).count()
    }
