import json
import os
import struct
import sys

import numpy as np
import pytest

SERVICE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO_ROOT = os.path.abspath(os.path.join(SERVICE_DIR, ".."))
REAL_DATA_ROOT = os.path.join(REPO_ROOT, "frontend", "public")
if SERVICE_DIR not in sys.path:
    sys.path.insert(0, SERVICE_DIR)

from app import analytics_engine as ae  # noqa: E402


def write_tile(path, var_code, arr):
    arr = np.asarray(arr, dtype="<f4")
    h, w = arr.shape
    os.makedirs(os.path.dirname(path), exist_ok=True)
    header = struct.pack("<4sHHHHHHff8s", b"INCO", 1, var_code, w, h, 1, 1,
                         float(np.nanmin(arr)), float(np.nanmax(arr)), b"\x00" * 8)
    with open(path, "wb") as f:
        f.write(header + arr.tobytes())


@pytest.fixture
def tiny_root(tmp_path):
    """
    Minimal catalog for unit tests of the engine maths: a 4x5 grid, 1-degree
    cells centred on integer degrees, two variables. Test-only fixture values.
    """
    grid = {"width": 5, "height": 4, "lon0": 60.0, "lat0": 10.0, "dlon": 1.0, "dlat": 1.0,
            "bbox": [59.5, 9.5, 64.5, 13.5], "registration": "cell_center", "row_order": "south_to_north"}
    dates = ["2019-01-29", "2019-02-28", "2019-04-29"]  # deliberate gap (no March)
    cat = {"grid": grid, "sources": {"ibr": {"title": "fixture"}}, "instruments": [],
           "variables": {
               "temperature": {"var_code": 1, "units": "°C", "long_name": "t", "standard_name": "t",
                               "source_id": "ibr", "depths": [0.0], "timesteps": dates,
                               "value_range": [0, 1], "display_range": [0, 1]},
               "salinity": {"var_code": 2, "units": "PSU", "long_name": "s", "standard_name": "s",
                            "source_id": "ibr", "depths": [0.0], "timesteps": dates[:1],
                            "value_range": [0, 1], "display_range": [0, 1]},
           }}
    root = tmp_path / "data"
    (root / "api").mkdir(parents=True)
    (root / "api" / "catalog.json").write_text(json.dumps(cat), encoding="utf-8")
    base = np.arange(20, dtype=float).reshape(4, 5)
    base[0, 0] = np.nan  # land cell
    for k, d in enumerate(dates):
        write_tile(str(root / "tiles" / "temperature" / d / "0.0.bin"), 1, base + 10.0 * k)
    write_tile(str(root / "tiles" / "salinity" / dates[0] / "0.0.bin"), 2, 35.0 + base / 100.0)
    ae.set_data_root(str(root))
    yield root
    ae.set_data_root(REAL_DATA_ROOT)


@pytest.fixture
def real_root():
    if not os.path.exists(os.path.join(REAL_DATA_ROOT, "api", "catalog.json")):
        pytest.skip("real data catalog not built")
    ae.set_data_root(REAL_DATA_ROOT)
    return REAL_DATA_ROOT
