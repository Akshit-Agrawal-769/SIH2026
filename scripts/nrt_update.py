"""
Near-real-time update of the Disaster Early Warning products (run daily by
.github/workflows/nrt-ingest.yml, or by hand):

  1. fetch the static products it builds on from Hugging Face (oisst_clim.nc, gpi_monthly.nc, ...)
  2. download the latest OISST months, HYCOM surface currents + 3-D temperature, GFS 10 m wind and IBTrACS
  3. rebuild mhw_daily.nc (daily MHW + DHW), drift_ops.nc, eddy_nrt.nc, tchp.nc, IBTrACS tracks, validation
  4. with --upload and HF_TOKEN set: publish ext_products/ to the Hugging Face dataset repo, where the
     data-service picks the new files up within EXT_PRODUCTS_REFRESH_HOURS

    python scripts/nrt_update.py [--days 7] [--upload]

Every step uses only public, no-login sources. A step whose source is down is reported and skipped; the
previous product stays in place (nothing is filled in).
"""
import argparse
import datetime as dt
import os
import subprocess
import sys
import traceback

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable
PROD = os.path.join(REPO, "datasets", "ext_products")


def run(*args, check=True):
    print("$", " ".join(args), flush=True)
    r = subprocess.run([PY, *args], cwd=REPO)
    if check and r.returncode != 0:
        raise RuntimeError(f"{' '.join(args)} exited {r.returncode}")
    return r.returncode == 0


def step(name, fn):
    try:
        fn()
        print(f"[nrt] {name}: ok", flush=True)
        return True
    except Exception:
        print(f"[nrt] {name}: FAILED - previous product kept\n{traceback.format_exc()}", flush=True)
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7, help="days of HYCOM / GFS to fetch for the drift window")
    ap.add_argument("--upload", action="store_true", help="publish ext_products/ to Hugging Face (needs HF_TOKEN)")
    args = ap.parse_args()
    today = dt.datetime.now(dt.timezone.utc).date()
    start = (today - dt.timedelta(days=args.days)).isoformat()
    end = today.isoformat()
    os.makedirs(PROD, exist_ok=True)

    # 1. products this run builds on (never rebuilt daily: full-record climatologies)
    need = [f"ext_products/{n}" for n in ("oisst_clim.nc", "gpi_monthly.nc", "drift_skill.json", "ibtracs_tracks.json")
            if not os.path.isfile(os.path.join(PROD, n))]
    if need:
        step("fetch base products", lambda: run("scripts/fetch_hf_datasets.py", "--only", *need))

    # 2. sources
    this_year = today.year
    years = [str(this_year - 1), str(this_year)]
    ok = {
        "oisst": step("OISST", lambda: run("scripts/download_external.py", "oisst", "--years", *years)),
        "hycom": step("HYCOM currents", lambda: run("scripts/download_external.py", "hycom", "--start", start, "--end", end,
                                                    check=False)),
        "gfs": step("GFS wind", lambda: run("scripts/download_external.py", "gfs", "--start", start, "--end", end)),
        "t3z": step("HYCOM 3-D temperature", lambda: run("scripts/download_external.py", "hycom-t", "--start",
                                                         (today - dt.timedelta(days=3)).isoformat(), "--end", end)),
        "ibtracs": step("IBTrACS", lambda: run("scripts/download_external.py", "ibtracs")),
    }

    # 3. products
    b = "scripts/build_ext_products.py"
    if ok["oisst"]:
        step("daily MHW + DHW", lambda: run("-c", "import sys; sys.argv=['x']; sys.path.insert(0,'scripts'); "
                                                  "import build_ext_products as b; b.build_oisst_window()"))
    if ok["hycom"] and ok["gfs"]:
        step("drift fields + eddy NRT", lambda: run(b, "currents"))
    if ok["t3z"]:
        step("TCHP", lambda: run(b, "tchp"))
    if ok["ibtracs"]:
        step("IBTrACS tracks", lambda: run(b, "ibtracs"))
    step("validation", lambda: run(b, "validate"))

    # 4. publish
    if args.upload:
        if not os.getenv("HF_TOKEN"):
            print("[nrt] HF_TOKEN not set: products built locally, not uploaded", flush=True)
        else:
            step("upload", lambda: run("scripts/upload_to_hf.py", "--ext-products",
                                       "--message", f"NRT update {dt.datetime.now(dt.timezone.utc):%Y-%m-%dT%H:%MZ}"))


if __name__ == "__main__":
    main()
