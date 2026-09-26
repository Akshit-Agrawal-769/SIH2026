"""
Download the project datasets from the Hugging Face dataset repo into datasets/,
in the layout scripts/build_authentic_dataset.py, scripts/build_ext_products.py and the data-service expect.

    python scripts/fetch_hf_datasets.py                 # flat files (except the 9.2 GB model) + ext_products/
    python scripts/fetch_hf_datasets.py --with-model    # also INCOIS-BIO-ROMS.nc
    python scripts/fetch_hf_datasets.py --with-ext-raw  # also the external source subsets (ext_raw/ -> datasets/ext/)
    python scripts/fetch_hf_datasets.py --with-raw      # also the raw Argo data-centre archives (raw/*.tar, ~16 GB)
    python scripts/fetch_hf_datasets.py --only cmems.nc ext_products/mhw_daily.nc

The data-service does NOT need this to serve volumes or the Disaster Early Warning products: without a
local copy it reads INCOIS-BIO-ROMS.nc from Hugging Face with byte-range requests and downloads
ext_products/<file> on first use. A local copy is faster and is required by the build scripts.

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
    """Map the HF repo layout onto datasets/."""
    if name.startswith("ext_products/"):
        return os.path.join(DATASETS, "ext_products", name.split("/", 1)[1])
    if name.startswith("raw/"):
        return os.path.join(DATASETS, "_archives", name.split("/", 1)[1])
    if name.startswith("incois_roms_"):
        return os.path.join(DATASETS, "model", name)
    if name.startswith("ext_raw/"):
        return os.path.join(DATASETS, "ext", *name.split("/")[1:])
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
    ap.add_argument("--with-ext-raw", action="store_true", help="also download ext_raw/ (external source subsets)")
    ap.add_argument("--with-raw", action="store_true", help="also download + unpack raw/argo_<centre>.tar")
    ap.add_argument("--only", nargs="*", help="download just these repo paths")
    ap.add_argument("--force", action="store_true", help="re-download files that already exist locally")
    args = ap.parse_args()
    token = os.getenv("HF_TOKEN") or None

    files = HfApi().list_repo_files(args.repo, repo_type="dataset", revision=args.revision, token=token)
    files = [f for f in files if not f.startswith(".") and f != "README.md"]
    if args.only:
        missing = set(args.only) - set(files)
        if missing:
            sys.exit(f"Not in {args.repo}: {', '.join(sorted(missing))}")
        files = args.only
    else:
        keep = []
        for f in files:
            if f.startswith("ext_products/"):
                keep.append(f)
            elif f.startswith("ext_raw/"):
                if args.with_ext_raw:
                    keep.append(f)
            elif f.startswith("raw/"):
                if args.with_raw:
                    keep.append(f)
            elif "/" not in f and (args.with_model or f != MODEL_FILE):
                keep.append(f)
        files = keep

    for name in files:
        dest = destination(name)
        if not args.force and os.path.isfile(dest) and os.path.getsize(dest) > 0:
            print(f"= {name} already at {os.path.relpath(dest, REPO_ROOT)}")
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        print(f"↓ {name}", flush=True)
        if "/" not in name:
            # local_dir writes straight to datasets/<sub>/<name> (resumable, no second copy in ~/.cache).
            hf_hub_download(args.repo, name, repo_type="dataset", revision=args.revision, token=token,
                            local_dir=os.path.dirname(dest))
        else:
            # sub-folder paths differ between the repo and datasets/: copy out of the HF cache
            import shutil
            path = hf_hub_download(args.repo, name, repo_type="dataset", revision=args.revision, token=token)
            shutil.copyfile(path, dest)
        print(f"  -> {os.path.relpath(dest, REPO_ROOT)} ({os.path.getsize(dest):,} bytes)")
        if name.startswith("raw/") and name.endswith(".tar"):
            import tarfile
            with tarfile.open(dest) as tar:  # archives hold one top-level folder: datasets/<centre>/
                tar.extractall(DATASETS, filter="data")
            print(f"  unpacked into datasets/{os.path.basename(name)[5:-4]}/")
    print("done")


if __name__ == "__main__":
    main()
