"""
Mirror the rest of datasets/ to the Hugging Face dataset repo.

The raw Argo data-centre folders (aoml, coriolis, csiro, csio, incois, meds, bodc, jma) hold ~180,000
small files, beyond what a Hugging Face repo handles well (<100k files, <10k per folder), so each one is
packed into a single uncompressed tar (NetCDF is already compressed) under raw/argo_<centre>.tar.
scripts/fetch_hf_datasets.py --with-raw downloads and unpacks them back into datasets/<centre>/.

    HF_TOKEN=... python scripts/upload_raw_to_hf.py [--staging D:/hf_staging]

Also uploads datasets/ext -> ext_raw/ (staged as hard links), datasets/model/incois_roms_indian_ocean.nc and datasets/manifest.json.
Resumable: archives already built are reused and upload_large_folder skips files already uploaded.
"""
import argparse
import os
import sys
import tarfile
import time

from huggingface_hub import HfApi

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS = os.path.join(REPO_ROOT, "datasets")
CENTRES = ["aoml", "coriolis", "csiro", "csio", "incois", "meds", "bodc", "jma"]
SKIP = (".log", ".part", ".tmp")


def pack(centre: str, staging: str) -> str:
    src = os.path.join(DATASETS, centre)
    dest = os.path.join(staging, "raw", f"argo_{centre}.tar")
    if os.path.isfile(dest) and os.path.getsize(dest) > 0:
        print(f"= {os.path.basename(dest)} exists ({os.path.getsize(dest) / 1e9:.2f} GB)", flush=True)
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    t = time.time()
    tmp = dest + ".part"
    with tarfile.open(tmp, "w") as tar:
        tar.add(src, arcname=centre, filter=lambda ti: None if ti.name.endswith(SKIP) or "/.cache" in ti.name else ti)
    os.replace(tmp, dest)
    print(f"packed {centre} -> {os.path.getsize(dest) / 1e9:.2f} GB in {time.time() - t:.0f}s", flush=True)
    return dest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.getenv("HF_DATASET_REPO", "ScaryCobra/incois"))
    ap.add_argument("--staging", default="D:/hf_staging", help="folder for the tar archives (not under OneDrive)")
    ap.add_argument("--workers", type=int, default=2, help="parallel uploads (keep low on unstable links)")
    args = ap.parse_args()
    token = os.environ.get("HF_TOKEN")
    if not token:
        sys.exit("HF_TOKEN environment variable is not set")
    api = HfApi(token=token)

    # small, flat items first
    for local, remote in ((os.path.join(DATASETS, "manifest.json"), "manifest.json"),
                          (os.path.join(DATASETS, "model", "incois_roms_indian_ocean.nc"), "incois_roms_indian_ocean.nc")):
        if os.path.isfile(local):
            api.upload_file(path_or_fileobj=local, path_in_repo=remote, repo_id=args.repo, repo_type="dataset",
                            commit_message=f"Add {remote}")
            print(f"uploaded {remote}", flush=True)

    # external source subsets: staged (hard links, no copy) as ext_raw/ next to the archives
    ext = os.path.join(DATASETS, "ext")
    for root, _, files in os.walk(ext):
        for f in files:
            if not f.endswith((".nc", ".csv")):
                continue
            src = os.path.join(root, f)
            dst = os.path.join(args.staging, "ext_raw", os.path.relpath(src, ext))
            if not os.path.isfile(dst):
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                try:
                    os.link(src, dst)
                except OSError:
                    import shutil
                    shutil.copyfile(src, dst)

    # Argo centre archives
    for c in CENTRES:
        if os.path.isdir(os.path.join(DATASETS, c)):
            pack(c, args.staging)

    # upload_large_folder is resumable (state in <staging>/.cache) and retries failed files; loop over
    # dropped connections until everything is committed.
    for attempt in range(1, 31):
        try:
            api.upload_large_folder(folder_path=args.staging, repo_id=args.repo, repo_type="dataset",
                                    allow_patterns=["raw/*.tar", "ext_raw/**"], num_workers=args.workers,
                                    print_report_every=120)
            break
        except Exception as exc:
            print(f"upload attempt {attempt} interrupted: {type(exc).__name__}: {str(exc)[:200]}", flush=True)
            time.sleep(60)
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    main()
