"""
Optional: load the catalogued (QC-filtered) Argo profiles into PostGIS and mirror
catalogued tiles into MinIO. The API works without either; this only populates
the optional storage backends from the same authentic build artefacts.
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import analytics_engine as ae  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.db.models import Base, Instrument, Profile, Measurement  # noqa: E402
from app.ingestion.argo import ArgoIngestionAdapter  # noqa: E402
from app.ingestion.copernicus import CopernicusIngestionAdapter  # noqa: E402


def seed_all():
    print("=== INCOIS Data Service: seeding optional storage from the data catalog ===")
    print(f"data root: {ae.get_data_root()}")
    if not ae.get_catalog():
        raise SystemExit("No data catalog found. Run scripts/build_authentic_dataset.py first.")
    if engine is None or SessionLocal is None:
        raise SystemExit("DATABASE_URL is not configured.")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        adapter = ArgoIngestionAdapter()
        raw = adapter.fetch(datetime(1997, 1, 1, tzinfo=timezone.utc), datetime.now(timezone.utc), None)
        count = adapter.store(adapter.normalize(raw), db)
        print(f"[1/2] Argo floats stored in PostGIS: {count}")

        if os.getenv("ENABLE_MINIO", "false").lower() == "true":
            stats = CopernicusIngestionAdapter().generate_and_store_tiles()
            print(f"[2/2] Tiles mirrored to MinIO: {stats}")
        else:
            print("[2/2] ENABLE_MINIO is not true; skipping MinIO mirror.")

        print(f"Instruments: {db.query(Instrument).count()}, profiles: {db.query(Profile).count()}, "
              f"measurements: {db.query(Measurement).count()}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
