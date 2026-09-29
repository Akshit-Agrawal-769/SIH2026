"""
Build the Argo lookup files the data-service reads at runtime, from the uploaded GDAC
profile archives. Nothing about individual floats is hard-coded anywhere: the float list,
positions and profile files all come from these archives.

Inputs
  argo_index.json          platform summaries (datasets/ or --argo-index)
  raw/argo_<provider>.tar  one uncompressed tar per GDAC provider (--tar-dir)

Outputs (in --out, default datasets/)
  argo_platforms.json                   slim float list for the map: one entry per float
  argo_tar_index/<provider>.json        {wmo: [[file, byte_offset, size], ...]} so the
                                        service can fetch a single profile NetCDF from
                                        the tar on Hugging Face with one HTTP range read

  python scripts/build_argo_index.py --tar-dir D:/hf_staging/raw
  python scripts/build_argo_index.py --tar-dir D:/hf_staging/raw --upload   # also push to HF
"""
import argparse
import glob
import json
import os
import re
import sys
import tarfile
import time

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS = os.path.join(REPO_ROOT, "datasets")
PROFILE_RE = re.compile(r"^([A-Za-z0-9_]+)/(\d{5,8})/profiles/([^/]+\.nc)$")


def log(msg):
    print(msg, flush=True)


def scan_tar(path):
    """{wmo: [[file, offset, size], ...]} for every profile NetCDF in one provider tar."""
    out = {}
    with tarfile.open(path) as tf:
        for m in tf:
            if not m.isfile():
                continue
            hit = PROFILE_RE.match(m.name)
            if hit:
                out.setdefault(hit.group(2), []).append([hit.group(3), m.offset_data, m.size])
    for files in out.values():
        files.sort()
    return out


def slim_platform(p, tar_by_provider):
    pos = p.get("latest_position") or {}
    return {
        "wmo": str(p["platform_number"]),
        "provider": p.get("source"),
        "dac": p.get("dac"),
        "tar": tar_by_provider.get(p.get("source")),
        "lat": pos.get("latitude"),
        "lon": pos.get("longitude"),
        "latest_timestamp": p.get("latest_timestamp"),
        "latest_cycle": p.get("latest_cycle"),
        "profiles_count": p.get("profiles_count"),
        "has_temperature": bool(p.get("has_temperature")),
        "has_salinity": bool(p.get("has_salinity")),
        "latitude_range": p.get("latitude_range"),
        "longitude_range": p.get("longitude_range"),
    }


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tar-dir", required=True, help="folder with argo_<provider>.tar files")
    ap.add_argument("--argo-index", default=os.path.join(DATASETS, "argo_index.json"))
    ap.add_argument("--out", default=DATASETS)
    ap.add_argument("--upload", action="store_true", help="upload the outputs to the HF dataset repo")
    ap.add_argument("--repo", default=os.getenv("HF_DATASET_REPO", "ScaryCobra/incois"))
    args = ap.parse_args()

    tars = sorted(glob.glob(os.path.join(args.tar_dir, "argo_*.tar")))
    if not tars:
        sys.exit(f"no argo_*.tar in {args.tar_dir}")
    with open(args.argo_index, encoding="utf-8") as f:
        index = json.load(f)

    tar_by_provider = {}
    members = {}
    for path in tars:
        provider = os.path.basename(path)[len("argo_"):-len(".tar")]
        t0 = time.time()
        shard = scan_tar(path)
        tar_by_provider[provider] = f"raw/{os.path.basename(path)}"
        members[provider] = shard
        write_json(os.path.join(args.out, "argo_tar_index", f"{provider}.json"), shard)
        log(f"[tar] {provider}: {len(shard)} floats, {sum(len(v) for v in shard.values())} profile files "
            f"({time.time() - t0:.0f}s)")

    by_wmo = {}
    for p in index["platforms"]:
        sp = slim_platform(p, tar_by_provider)
        if sp["lat"] is None or sp["lon"] is None:
            continue
        if sp["wmo"] not in members.get(sp["provider"], {}):
            sp["tar"] = None  # listed in the index but no profile files in the archive
        # A float can be listed under two providers (e.g. a GDAC copy and a multi-profile
        # file): keep the entry whose profiles are in an archive, then the one with more.
        prev = by_wmo.get(sp["wmo"])
        if prev is None or (bool(sp["tar"]), sp["profiles_count"] or 0) > (bool(prev["tar"]), prev["profiles_count"] or 0):
            by_wmo[sp["wmo"]] = sp
    platforms = sorted(by_wmo.values(), key=lambda x: x["wmo"])
    missing = sum(1 for p in platforms if not p["tar"])
    write_json(os.path.join(args.out, "argo_platforms.json"), {
        "source": "Argo GDAC profile archives (argo_index.json + raw/argo_<provider>.tar)",
        "index_generated_at": index.get("generated_at"),
        "total_profiles": index.get("total_profiles"),
        "providers": sorted(tar_by_provider),
        "platforms": platforms,
    })
    log(f"[done] {len(platforms)} floats with a position ({missing} without profile files in the archives)")

    if args.upload:
        from huggingface_hub import HfApi
        api = HfApi(token=os.getenv("HF_TOKEN") or None)
        api.upload_file(path_or_fileobj=os.path.join(args.out, "argo_platforms.json"),
                        path_in_repo="argo_platforms.json", repo_id=args.repo, repo_type="dataset",
                        commit_message="Argo float list derived from argo_index.json")
        api.upload_folder(folder_path=os.path.join(args.out, "argo_tar_index"), path_in_repo="argo_tar_index",
                          repo_id=args.repo, repo_type="dataset",
                          commit_message="Byte offsets of Argo profile files inside raw/argo_*.tar")
        log(f"[upload] pushed argo_platforms.json and argo_tar_index/ to {args.repo}")


if __name__ == "__main__":
    main()
