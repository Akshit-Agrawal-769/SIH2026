"""
Download the project datasets from the Hugging Face dataset repo into datasets/,
in the layout scripts/build_authentic_dataset.py and the data-service expect.

    python scripts/fetch_hf_datasets.py                 # everything except the 9.2 GB model
    python scripts/fetch_hf_datasets.py --with-model    # also INCOIS-BIO-ROMS.nc
    python scripts/fetch_hf_datasets.py --only cmems.nc

The data-service does NOT need this to serve volumes: without a local copy it reads
INCOIS-BIO-ROMS.nc from Hugging Face with byte-range requests. A local copy is faster
and is required by build_authentic_dataset.py.

Env: HF_DATASET_REPO (default ScaryCobra/incois), HF_DATASET_REVISION (main), HF_TOKEN (private repos only).
"""
import argparse
import os
import sys

from huggingface_hub import HfApi, hf_hub_download

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS = os.path.join(REPO_ROOT, "datasets")
MODEL_FILE = "INCOIS-BIO-ROMS.nc"


def destination(name: str) -> str:
    """Map the flat HF repo layout onto datasets/."""
    if name == MODEL_FILE:
        return os.path.join(DATASETS, "model", name)
    if name.endswith("_prof.nc") or name == "indian_argo.nc":
        return os.path.join(DATASETS, "argo", name)
    if name.startswith("ne_10m_") or name.endswith(".geojson"):
        return os.path.join(DATASETS, "geography", name)
    return os.path.join(DATASETS, name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.getenv("HF_DATASET_REPO", "ScaryCobra/incois"))
    ap.add_argument("--revision", default=os.getenv("HF_DATASET_REVISION", "main"))
    ap.add_argument("--with-model", action="store_true", help=f"also download {MODEL_FILE} (9.2 GB)")
    ap.add_argument("--only", nargs="*", help="download just these filenames")
    args = ap.parse_args()
    token = os.getenv("HF_TOKEN") or None

    files = HfApi().list_repo_files(args.repo, repo_type="dataset", revision=args.revision, token=token)
    files = [f for f in files if "/" not in f and not f.startswith(".") and f != "README.md"]
    if args.only:
        missing = set(args.only) - set(files)
        if missing:
            sys.exit(f"Not in {args.repo}: {', '.join(sorted(missing))}")
        files = args.only
    elif not args.with_model:
        files = [f for f in files if f != MODEL_FILE]

    for name in files:
        dest = destination(name)
        if os.path.isfile(dest) and os.path.getsize(dest) > 0:
            print(f"= {name} already at {os.path.relpath(dest, REPO_ROOT)}")
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        print(f"↓ {name}", flush=True)
        # local_dir writes straight to datasets/<sub>/<name> (resumable, no second copy in ~/.cache).
        hf_hub_download(args.repo, name, repo_type="dataset", revision=args.revision, token=token,
                        local_dir=os.path.dirname(dest))
        print(f"  -> {os.path.relpath(dest, REPO_ROOT)} ({os.path.getsize(dest):,} bytes)")
    print("done")


if __name__ == "__main__":
    main()
