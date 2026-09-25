import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import cast, String

from app import analytics_engine as ae
from app.security import require_admin_token
from app.db.session import get_db
from app.db.models import Instrument, Profile, Measurement
from geoalchemy2.functions import ST_AsGeoJSON, ST_MakeEnvelope, ST_Intersects

import app.ingestion  # Ensures all adapters register themselves
from app.ingestion.registry import AdapterRegistry

router = APIRouter(prefix="/instruments", tags=["instruments"])


def _parse_bbox(bbox: Optional[str]):
    if not bbox:
        return None
    try:
        parts = [float(p) for p in bbox.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="bbox must be minLon,minLat,maxLon,maxLat")
    if len(parts) != 4 or parts[0] >= parts[2] or parts[1] >= parts[3]:
        raise HTTPException(status_code=400, detail="bbox must be minLon,minLat,maxLon,maxLat")
    return parts


@router.get("/adapters")
def list_adapters():
    """Metadata for the registered ingestion adapters."""
    return {
        "status": "success",
        "count": len(AdapterRegistry.list_adapters()),
        "adapters": AdapterRegistry.list_adapters()
    }


def _db_features(db, platform_type, bbox):
    if db is None:
        return []
    try:
        query = db.query(Instrument)
        if platform_type:
            query = query.filter(Instrument.platform_type == platform_type)
        if bbox:
            query = query.filter(ST_Intersects(Instrument.location, ST_MakeEnvelope(*bbox, 4326)))
        features = []
        for inst in query.limit(500).all():
            geom_json = db.scalar(ST_AsGeoJSON(inst.location))
            features.append({
                "type": "Feature",
                "id": inst.external_id,
                "geometry": json.loads(geom_json) if geom_json else None,
                "properties": {
                    "id": inst.external_id,
                    "external_id": inst.external_id,
                    "platform_type": inst.platform_type,
                    "last_report": inst.last_report.isoformat() if inst.last_report else None,
                    "metadata": inst.metadata_json or {}
                }
            })
        return features
    except Exception as e:
        print(f"[Instruments] DB query unavailable: {str(e)[:120]}")
        return []


@router.get("")
def list_instruments(
    bbox: Optional[str] = Query(None, description="minLon,minLat,maxLon,maxLat"),
    platform_type: Optional[str] = Query(None, description="argo"),
    db: Session = Depends(get_db)
):
    """
    GeoJSON FeatureCollection of observation platforms. PostGIS is used when it is
    populated; otherwise the catalogued Argo floats built from GDAC NetCDF files.
    """
    box = _parse_bbox(bbox)
    features = _db_features(db, platform_type, box)
    source = "postgis"
    if not features:
        source = "catalog"
        static = ae.load_instruments() or {"features": []}
        for f in static["features"]:
            lon, lat = f["geometry"]["coordinates"]
            if platform_type and f["properties"]["platform_type"] != platform_type:
                continue
            if box and not (box[0] <= lon <= box[2] and box[1] <= lat <= box[3]):
                continue
            features.append(f)
    return {"type": "FeatureCollection", "source": source, "features": features}


@router.get("/{instrument_id}/profile")
def get_instrument_profile(instrument_id: str, db: Session = Depends(get_db)):
    """Latest QC-filtered vertical profile of an instrument (plus observed MLD/thermocline)."""
    if db is not None:
        try:
            inst = db.query(Instrument).filter(
                (Instrument.external_id == instrument_id) | (cast(Instrument.id, String) == instrument_id)
            ).first()
            if inst:
                profile = db.query(Profile).filter(Profile.instrument_id == inst.id) \
                    .order_by(Profile.timestamp.desc()).first()
                if profile:
                    ms = db.query(Measurement).filter(Measurement.profile_id == profile.id) \
                        .order_by(Measurement.depth.asc()).all()
                    out = {
                        "instrument_id": inst.external_id,
                        "external_id": inst.external_id,
                        "platform_type": inst.platform_type,
                        "profile_id": str(profile.id),
                        "cycle_number": profile.cycle_number,
                        "timestamp": profile.timestamp.isoformat(),
                        "latitude": profile.latitude,
                        "longitude": profile.longitude,
                        "metadata": inst.metadata_json,
                        "measurements": [
                            {"depth": m.depth, "pressure": m.pressure, "temperature": m.temperature,
                             "salinity": m.salinity, "chlorophyll": m.chlorophyll, "oxygen": m.oxygen}
                            for m in ms
                        ],
                    }
                    out["analysis"] = ae.compute_observed_profile_analysis(out)
                    return out
        except Exception as e:
            print(f"[Instruments] DB profile lookup unavailable: {str(e)[:120]}")

    prof = ae.load_profile(instrument_id)
    if prof is None:
        raise HTTPException(status_code=404, detail=f"Instrument '{instrument_id}' not found or has no QC-good profile")
    if "analysis" not in prof:
        prof["analysis"] = ae.compute_observed_profile_analysis(prof)
    return prof


@router.post("/ingest", dependencies=[Depends(require_admin_token)])
def trigger_ingest(db: Session = Depends(get_db)):
    """Run every registered ingestion adapter against the local datasets and store into PostGIS."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    ingestion_results = {}
    for meta in AdapterRegistry.list_adapters():
        p_type = meta["platform_type"]
        adapter = AdapterRegistry.get_adapter(p_type)
        if adapter:
            try:
                raw_data = adapter.fetch(
                    start_date=datetime(1997, 1, 1, tzinfo=timezone.utc),
                    end_date=datetime.now(timezone.utc),
                    bbox=[35.0, -10.0, 100.0, 25.0]
                )
                norm_data = adapter.normalize(raw_data)
                ingestion_results[p_type] = adapter.store(norm_data, db)
            except Exception as e:
                ingestion_results[p_type] = f"Error: {str(e)}"

    return {
        "status": "success",
        "adapters_executed": len(ingestion_results),
        "details": ingestion_results,
        "total_instruments": db.query(Instrument).count()
    }
