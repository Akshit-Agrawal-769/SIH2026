import os
import numpy as np
from typing import Tuple, List, Dict, Any

# Standard 20 oceanographic depth levels from surface to 2000 meters
STANDARD_DEPTH_LEVELS = [
    0.5, 5.0, 15.0, 30.0, 50.0, 75.0, 100.0, 125.0, 150.0, 200.0,
    250.0, 300.0, 400.0, 500.0, 600.0, 800.0, 1000.0, 1250.0, 1500.0, 2000.0
]

# Indian Ocean / EEZ Bounding Box (45°E to 100°E, -15°S to 30°N)
LON_MIN, LON_MAX = 45.0, 100.0
LAT_MIN, LAT_MAX = -15.0, 30.0

# 0.10° High-Definition Nominal Resolution (matching GFDL ESM2.6 reference specification)
GRID_WIDTH = 550  # 0.1° resolution
GRID_HEIGHT = 450 # 0.1° resolution
GRID_DEPTH = len(STANDARD_DEPTH_LEVELS)

LAND_POLYGONS = [
    # India Mainland & North
    [
        (68.0, 30.0), (91.0, 30.0), (91.0, 24.0), (89.8, 22.2), (88.5, 21.6),
        (87.0, 21.4), (85.0, 19.5), (83.3, 17.7), (80.3, 13.1), (79.8, 10.5),
        (78.2, 9.2), (77.5, 8.1), (76.5, 9.5), (75.0, 12.5), (74.0, 14.5),
        (73.5, 16.5), (72.8, 18.9), (72.8, 21.2), (70.0, 21.0), (69.0, 22.4),
        (68.2, 23.8), (68.0, 30.0)
    ],
    # Sri Lanka
    [(79.6, 9.8), (81.9, 9.8), (81.9, 5.9), (79.6, 5.9)],
    # Arabian Peninsula & Iran/Pakistan
    [
        (45.0, 30.0), (68.2, 30.0), (68.2, 23.8), (66.5, 25.0), (61.5, 25.2),
        (57.0, 25.5), (56.3, 26.2), (58.5, 23.6), (59.8, 22.5), (58.0, 20.5),
        (54.0, 16.5), (51.0, 12.0), (45.0, 12.5)
    ],
    # Horn of Africa / Somalia
    [
        (45.0, 11.5), (51.3, 12.0), (50.0, 8.0), (47.5, 4.0), (45.0, 1.5),
        (45.0, -15.0), (39.0, -15.0), (39.0, 11.5)
    ],
    # Southeast Asia (Myanmar, Thailand, Malaysia)
    [
        (92.5, 30.0), (100.0, 30.0), (100.0, 1.0), (98.5, 3.0), (98.5, 8.0),
        (98.5, 12.0), (96.5, 16.5), (94.5, 16.0), (94.0, 18.0), (92.5, 21.0)
    ],
    # Sumatra
    [(95.2, 5.6), (100.0, 1.5), (100.0, -6.0), (97.0, 1.0)]
]

def point_in_polygon(x: float, y: float, poly: list) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside

_CACHED_LAND_MASK: np.ndarray = None

def get_land_mask(lons: np.ndarray, lats: np.ndarray) -> np.ndarray:
    """Retrieves or precomputes the 2D boolean land mask (True = land, False = ocean)."""
    global _CACHED_LAND_MASK
    if _CACHED_LAND_MASK is not None and _CACHED_LAND_MASK.shape == (len(lats), len(lons)):
        return _CACHED_LAND_MASK

    # Try loading precomputed numpy array from disk for instant startup
    mask_file = os.path.join(os.path.dirname(__file__), "land_mask_550x450.npy")
    if os.path.exists(mask_file):
        try:
            loaded = np.load(mask_file)
            if loaded.shape == (len(lats), len(lons)):
                _CACHED_LAND_MASK = loaded
                return _CACHED_LAND_MASK
        except Exception:
            pass

    mask = np.zeros((len(lats), len(lons)), dtype=bool)
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            if any(point_in_polygon(lon, lat, poly) for poly in LAND_POLYGONS):
                mask[i, j] = True
    _CACHED_LAND_MASK = mask
    return _CACHED_LAND_MASK

compute_land_mask = get_land_mask

def get_grid_coordinates() -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns the target 1D coordinate arrays for lon, lat, and depth."""
    lons = np.linspace(LON_MIN, LON_MAX, GRID_WIDTH, dtype=np.float32)
    lats = np.linspace(LAT_MIN, LAT_MAX, GRID_HEIGHT, dtype=np.float32)
    depths = np.array(STANDARD_DEPTH_LEVELS, dtype=np.float32)
    return lons, lats, depths

