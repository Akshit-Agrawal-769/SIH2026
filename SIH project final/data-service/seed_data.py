import sys
import os
from datetime import datetime, timezone

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal, engine
from app.db.models import Base, Instrument, Profile, Measurement
from app.ingestion.argo import ArgoIngestionAdapter
from app.ingestion.glider import GliderIngestionAdapter
from app.ingestion.copernicus import CopernicusIngestionAdapter

def seed_all():
    print("=== INCOIS Data Service: Ingestion & Seeding ===")

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Ingest Real Argo Floats
        print("\n[1/3] Running Argo Float Ingestion...")
        argo_adapter = ArgoIngestionAdapter()
        raw_argo = argo_adapter.fetch(
            start_date=datetime(2024, 6, 1, tzinfo=timezone.utc),
            end_date=datetime(2024, 6, 5, tzinfo=timezone.utc),
            bbox=[65.0, 5.0, 95.0, 22.0]
        )
        norm_argo = argo_adapter.normalize(raw_argo)
        argo_count = argo_adapter.store(norm_argo, db)
        print(f"-> Ingested {argo_count} Argo float stations into PostGIS!")

        # 2. Ingest Autonomous Gliders
        print("\n[2/3] Running Autonomous Glider Ingestion...")
        glider_adapter = GliderIngestionAdapter()
        raw_gliders = glider_adapter.fetch(
            start_date=datetime(2024, 6, 1, tzinfo=timezone.utc),
            end_date=datetime(2024, 6, 5, tzinfo=timezone.utc),
            bbox=[65.0, 5.0, 95.0, 22.0]
        )
        norm_gliders = glider_adapter.normalize(raw_gliders)
        glider_count = glider_adapter.store(norm_gliders, db)
        print(f"-> Ingested {glider_count} Glider transect missions into PostGIS!")

        # 3. Model Voxelization & Binary Tile Storage (MinIO)
        print("\n[3/3] Running Model Voxelization & MinIO Texture Upload...")
        model_adapter = CopernicusIngestionAdapter()
        tile_stats = model_adapter.generate_and_store_tiles(["temperature", "salinity", "chlorophyll", "currents"])
        for var, count in tile_stats.items():
            print(f"-> Variable '{var}': {count} binary tiles uploaded to MinIO!")

        # Summary verification
        total_instruments = db.query(Instrument).count()
        total_profiles = db.query(Profile).count()
        total_measurements = db.query(Measurement).count()
        print("\n=== Ingestion Completed Successfully ===")
        print(f"Total Instruments in PostGIS: {total_instruments}")
        print(f"Total Profiles in PostGIS:    {total_profiles}")
        print(f"Total Depth Measurements:    {total_measurements}")
        print("MinIO Binary Voxel Store:     Populated with temperature, salinity, currents, chlorophyll!")

    except Exception as e:
        print(f"\n[Error] Ingestion failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_all()
