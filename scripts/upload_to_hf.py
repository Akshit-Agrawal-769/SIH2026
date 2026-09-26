"""
Upload datasets to the Hugging Face dataset repository.

  HF_TOKEN=<token> python scripts/upload_to_hf.py --repo <user>/<dataset>                # datasets/ (flat files)
  HF_TOKEN=<token> python scripts/upload_to_hf.py --repo <user>/<dataset> --ext-products  # datasets/ext_products -> ext_products/
  HF_TOKEN=<token> python scripts/upload_to_hf.py --repo <user>/<dataset> --ext-raw       # datasets/ext -> ext_raw/

ext_products/ holds the compact Disaster Early Warning products the data-service reads (it downloads them
from here on first use and re-checks them every few hours). ext_raw/ holds the external source subsets
(OISST, HYCOM, GFS, NCEP, IBTrACS, GDP drifters) so the build is reproducible without re-downloading.

The token is read from the environment only; never commit it.
"""
import argparse
import os
import sys

from huggingface_hub import HfApi

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS = os.path.join(REPO_ROOT, "datasets")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.getenv("HF_DATASET_REPO", "ScaryCobra/incois"),
                    help="dataset repo id, e.g. user/incois")
    ap.add_argument("--folder", default=None, help="upload this folder to the repo root (legacy mode)")
    ap.add_argument("--ext-products", action="store_true", help="upload datasets/ext_products -> ext_products/")
    ap.add_argument("--ext-raw", action="store_true", help="upload datasets/ext -> ext_raw/")
    ap.add_argument("--message", default=None, help="commit message")
    args = ap.parse_args()
    token = os.environ.get("HF_TOKEN")
    if not token:
        sys.exit("HF_TOKEN environment variable is not set")
    api = HfApi(token=token)
    api.create_repo(repo_id=args.repo, repo_type="dataset", exist_ok=True)
    jobs = []
    if args.ext_products:
        jobs.append((os.path.join(DATASETS, "ext_products"), "ext_products", ["*.nc", "*.json"], ["*.tmp", "*.part"]))
    if args.ext_raw:
        jobs.append((os.path.join(DATASETS, "ext"), "ext_raw", ["**/*.nc", "**/*.csv"], ["*.tmp", "*.part", "*.log"]))
    if not jobs:
        jobs.append((args.folder or DATASETS, None, None, ["ext/**", "ext_products/**", "*.part", "*.log"]))
    for folder, prefix, allow, ignore in jobs:
        if not os.path.isdir(folder):
            sys.exit(f"Missing folder {folder}")
        print(f"Uploading {folder} -> {args.repo}/{prefix or ''}", flush=True)
        api.upload_folder(folder_path=folder, path_in_repo=prefix, repo_id=args.repo, repo_type="dataset",
                          allow_patterns=allow, ignore_patterns=ignore,
                          commit_message=args.message or f"Upload {prefix or 'datasets'}")
    print("Upload completed")


if __name__ == "__main__":
    main()
