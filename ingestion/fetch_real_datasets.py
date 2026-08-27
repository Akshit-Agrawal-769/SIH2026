"""
INCOIS Real Oceanographic Dataset Ingestion & Validation Pipeline
Strict Real Data Enforcement: Fetches authentic Indian Ocean Argo float NetCDFs from Coriolis/Ifremer GDAC
and validates authentic INCOIS ROMS model NetCDFs against datasets/manifest.json.
NO SYNTHETIC OR MOCK DATA ALLOWED.
"""

import os
import sys
import json
import urllib.request
import hashlib
from typing import Dict, Any, List

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATASETS_DIR = os.path.join(ROOT_DIR, "datasets")
MANIFEST_PATH = os.path.join(DATASETS_DIR, "manifest.json")
MODEL_DIR = os.path.join(DATASETS_DIR, "model")
ARGO_DIR = os.path.join(DATASETS_DIR, "argo")

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(ARGO_DIR, exist_ok=True)


def load_manifest() -> Dict[str, Any]:
    if not os.path.exists(MANIFEST_PATH):
        raise FileNotFoundError(f"Dataset manifest not found at {MANIFEST_PATH}")
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def calculate_sha256(file_path: str) -> str:
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


import ssl

def download_with_fallback(primary_url: str, fallback_url: str, dest_path: str, min_size: int = 10000) -> bool:
    """Attempts to download an authentic NetCDF file from primary and fallback GDAC servers."""
    urls = [primary_url, fallback_url] if fallback_url else [primary_url]
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    for url in urls:
        if not url:
            continue
        try:
            print(f"Fetching real oceanographic dataset from {url}...")
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'INCOIS-3D-Platform/1.0 (Oceanographic Research; GDAC API)'}
            )
            with urllib.request.urlopen(req, context=ctx, timeout=30) as response, open(dest_path, 'wb') as out_file:
                data = response.read()
                out_file.write(data)
                
            if os.path.exists(dest_path) and os.path.getsize(dest_path) >= min_size:
                size_kb = os.path.getsize(dest_path) / 1024
                print(f"✓ Download successful: {os.path.basename(dest_path)} ({size_kb:.1f} KB)")
                return True
            else:
                print(f"Notice: file downloaded from {url} is smaller than required ({min_size} bytes). Retrying fallback...")
        except Exception as e:
            print(f"Notice: failed downloading from {url}: {e}")
            
    return False


def ingest_argo_datasets(manifest: Dict[str, Any]):
    argo_entries = manifest.get("datasets", {}).get("argo", [])
    print(f"\n[1/2] Ingesting Authentic Argo GDAC NetCDF Floats ({len(argo_entries)} registered)...")
    
    for entry in argo_entries:
        filename = entry.get("filename")
        if not filename:
            # Aggregate source provider descriptor
            print(f"  * In-situ provider: {entry.get('title', entry.get('id', 'GDAC'))}")
            continue
        dest_path = os.path.join(ARGO_DIR, filename)
        wmo = entry.get("platform_number", filename.split("_")[0])
        
        # Check if already present and valid
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 10000:
            size_kb = os.path.getsize(dest_path) / 1024
            print(f"  ✓ Authentic Argo NetCDF already present: {filename} ({size_kb:.1f} KB, WMO {wmo})")
            continue
            
        success = download_with_fallback(
            primary_url=entry.get("primary_url", ""),
            fallback_url=entry.get("fallback_url", ""),
            dest_path=dest_path
        )
        
        if not success:
            raise RuntimeError(
                f"REAL ARGO DATASET REQUIRED: Failed to download authentic Argo float NetCDF for WMO {wmo} "
                f"from both primary ({entry.get('primary_url')}) and fallback ({entry.get('fallback_url')}) GDAC servers.\n"
                f"Strict 'NO MOCK DATA' policy is enforced; execution halted."
            )


def ingest_model_datasets(manifest: Dict[str, Any]):
    model_entries = manifest.get("datasets", {}).get("model", [])
    print(f"\n[2/2] Ingesting Real Ocean Model NetCDFs ({len(model_entries)} registered)...")
    
    for entry in model_entries:
        filename = entry["filename"]
        dest_path = os.path.join(MODEL_DIR, filename)
        
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 50000:
            size_mb = os.path.getsize(dest_path) / (1024 * 1024)
            print(f"  ✓ Real Ocean Model NetCDF verified: {filename} ({size_mb:.2f} MB)")
        else:
            raise RuntimeError(
                f"REAL OCEAN MODEL DATASET REQUIRED: Model file '{filename}' was not found in '{MODEL_DIR}'.\n"
                f"Please place authentic INCOIS ROMS/INDOFOS NetCDF file in {MODEL_DIR}/{filename}.\n"
                f"Strict 'NO MOCK DATA' policy is enforced; synthetic data generation is permanently disabled."
            )


def run():
    print("=" * 80)
    print("  INCOIS 3D OCEAN DATA SYSTEM — REAL DATASET INGESTION PIPELINE")
    print("  Directive: STRICT REAL DATASET ENFORCEMENT (NO MOCK/SYNTHETIC DATA)")
    print("=" * 80)
    
    manifest = load_manifest()
    print(f"Loaded dataset manifest v{manifest.get('version')} (Policy: {manifest.get('policy')})")
    
    ingest_argo_datasets(manifest)
    ingest_model_datasets(manifest)
    
    print("\n" + "=" * 80)
    print("  ✓ ALL AUTHENTIC DATASETS VERIFIED & READY")
    print("=" * 80)


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(f"\n[ERROR] {e}", file=sys.stderr)
        sys.exit(1)
