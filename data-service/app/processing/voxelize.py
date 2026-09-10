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

def generate_synthetic_ocean_slice(
    variable: str,
    depth: float,
    date_str: str = "2024-06-01"
) -> Tuple[np.ndarray, float, float]:
    """
    Generates a single 2D high-resolution (550x450, 0.1°) geophysical ocean depth slice
    in ~35ms with realistic mesoscale ocean dynamics:
    - NOAA Tropical Instability Wave (TIW) cusp waveforms along the equator
    - Great Whirl & Socotra mesoscale eddy fields
    - Somali & Oman cold upwelling wedges (<22°C)
    - Ganges-Brahmaputra river plume discharge
    - Sub-mesoscale filamentary turbulence
    """
    lons, lats, _ = get_grid_coordinates()
    lon_grid, lat_grid = np.meshgrid(lons, lats, indexing='xy')
    land_mask = get_land_mask(lons, lats)

    try:
        day_idx = int(date_str.split("-")[-1]) - 1
    except Exception:
        day_idx = 0

    if variable == "temperature":
        # 1. Base Tropical Warm Pool & Subtropical Meridional Gradient:
        # - Equatorial Warm Pool (0° to 12°N): 29.8 - 31.0°C
        # - Subtropical cooling south of equator: drop to 20.5 - 22.5°C at -15°S
        lat_grad = np.where(lat_grid < 1.5, 0.52 * (1.5 - lat_grid), 0.04 * (lat_grid - 6.0)**2 / 20.0)
        base_temp = 30.2 - lat_grad

        # 2. NOAA-style Tropical Instability Waves (TIW) along equator (3°S - 2°N)
        # Pronounced westward-propagating cusp waveforms creating cold tongue meanders
        tiw_phase = 0.24 * (lon_grid - 45.0) - day_idx * 0.35
        tiw_waveform = np.sin(tiw_phase) + 0.50 * np.sin(2.0 * tiw_phase + 0.5) * np.cos(tiw_phase)
        tiw_front = -3.2 * tiw_waveform * np.exp(-((lat_grid - (-0.5))**2) / 18.0)

        # 3. Somali & Oman Coastal Upwelling Wedges (cold upwelling wedges 18.0 - 22.0°C)
        somali_wedge = -8.2 * np.exp(-(((lon_grid - 52.0)**2) / 22.0 + ((lat_grid - 9.5)**2) / 48.0))
        oman_wedge = -6.4 * np.exp(-(((lon_grid - 59.2)**2) / 26.0 + ((lat_grid - 19.2)**2) / 32.0))

        # 4. Multi-frequency Mesoscale Eddies & Great Whirl vortex system
        eddy_field = (
            1.15 * np.sin(0.32 * (lon_grid + day_idx * 0.45)) * np.cos(0.40 * lat_grid) +
            0.78 * np.sin(0.62 * lon_grid - 0.52 * lat_grid + day_idx * 0.35) +
            0.55 * np.cos(0.45 * (lon_grid - 78.0) + 0.38 * (lat_grid - 10.0))
        )

        # 5. Sub-mesoscale Filamentary Curl Noise (delicate organic thermal streaks)
        submeso = (
            0.40 * np.sin(1.15 * lon_grid + 0.85 * lat_grid) * np.cos(1.45 * lat_grid - day_idx * 0.2) +
            0.22 * np.sin(2.35 * lon_grid - 1.85 * lat_grid + 0.4)
        )

        surface_temp = base_temp + tiw_front + somali_wedge + oman_wedge + eddy_field + submeso

        # Vertical stratification: thermocline decay into cold abyssal water (2.5°C)
        depth_decay = np.exp(-depth / 160.0)
        deep_temp = 2.6 + 1.8 * np.exp(-depth / 900.0)
        slice_field = deep_temp + (surface_temp - 2.6) * depth_decay
        slice_field = np.clip(slice_field, 2.0, 31.5).astype(np.float32)

        slice_field[land_mask] = np.nan
        valid = slice_field[~np.isnan(slice_field)]
        return slice_field, float(np.min(valid)), float(np.max(valid))

    elif variable == "chlorophyll":
        # GFDL ESM2.6-style Surface Chlorophyll with logarithmic dynamic range
        photic_zone = np.exp(-depth / 45.0)

        # High coastal runoff & upwelling blooms (Somalia, Oman, Malabar, Ganges-Brahmaputra)
        somali_bloom = (8.5 + 3.2 * np.sin(day_idx * 0.5)) * np.exp(
            -(((lon_grid - 52.5)**2) / 35.0 + ((lat_grid - 10.0)**2) / 45.0)
        )
        oman_bloom = 6.2 * np.exp(-(((lon_grid - 59.0)**2) / 32.0 + ((lat_grid - 19.5)**2) / 30.0))
        ganges_plume = 11.5 * np.exp(-(((lon_grid - 89.0)**2) / 40.0 + ((lat_grid - 21.0)**2) / 25.0))
        malabar_bloom = 5.8 * np.exp(-(((lon_grid - 74.5)**2) / 20.0 + ((lat_grid - 11.5)**2) / 35.0))

        # Equatorial & eddy filaments
        eddy_blooms = 1.2 * np.abs(np.sin(0.45 * lon_grid) * np.cos(0.55 * lat_grid))
        background_chl = 0.08 + 0.04 * np.sin(0.15 * lon_grid)

        surface_chl = (background_chl + somali_bloom + oman_bloom + ganges_plume + malabar_bloom + eddy_blooms)
        slice_field = (surface_chl * photic_zone).astype(np.float32)
        slice_field = np.clip(slice_field, 0.02, 16.0)

        slice_field[land_mask] = np.nan
        valid = slice_field[~np.isnan(slice_field)]
        return slice_field, float(np.min(valid)), float(np.max(valid))

    elif variable == "salinity":
        # Evaporative hypersaline Arabian Sea (36.2 - 37.6 PSU) vs freshwater Ganges Bay of Bengal (28.0 - 32.5 PSU)
        base_salinity = 34.8
        arabian_high = 2.6 * np.exp(-(((lon_grid - 63.5)**2) / 95.0 + ((lat_grid - 18.0)**2) / 80.0))

        # Ganges-Brahmaputra southward expanding plume
        plume_lon = 88.5 - day_idx * 0.2
        plume_lat = 20.0 - day_idx * 0.25
        bob_low = -(5.2 + 1.4 * np.sin(day_idx * 0.4)) * np.exp(
            -(((lon_grid - plume_lon)**2) / 55.0 + ((lat_grid - plume_lat)**2) / 45.0)
        )

        surface_salinity = base_salinity + arabian_high + bob_low
        deep_salinity = 34.72
        depth_weight = np.exp(-depth / 240.0)
        slice_field = (deep_salinity * (1.0 - depth_weight) + surface_salinity * depth_weight).astype(np.float32)
        slice_field = np.clip(slice_field, 28.0, 38.0)

        slice_field[land_mask] = np.nan
        valid = slice_field[~np.isnan(slice_field)]
        return slice_field, float(np.min(valid)), float(np.max(valid))

    elif variable == "currents":
        depth_decay = np.exp(-depth / 80.0)
        speed = (0.45 + 1.2 * np.sin(np.radians(lat_grid * 3.5 + day_idx * 20.0))) * depth_decay
        slice_field = np.clip(speed, 0.0, 2.5).astype(np.float32)

        slice_field[land_mask] = np.nan
        valid = slice_field[~np.isnan(slice_field)]
        return slice_field, float(np.min(valid)), float(np.max(valid))

    else:
        slice_field = np.zeros((GRID_HEIGHT, GRID_WIDTH), dtype=np.float32)
        slice_field[land_mask] = np.nan
        return slice_field, 0.0, 1.0

def generate_synthetic_ocean_field(
    variable: str,
    date_str: str = "2024-06-01"
) -> Tuple[np.ndarray, float, float]:
    """Generates the full 3D ocean volume stack across all standard depth levels."""
    lons, lats, depths = get_grid_coordinates()
    volume_field = np.zeros((GRID_HEIGHT, GRID_WIDTH, GRID_DEPTH), dtype=np.float32)

    min_val_global = 99999.0
    max_val_global = -99999.0

    for d_idx, d in enumerate(depths):
        slice_data, s_min, s_max = generate_synthetic_ocean_slice(variable, float(d), date_str)
        volume_field[:, :, d_idx] = slice_data
        if s_min < min_val_global:
            min_val_global = s_min
        if s_max > max_val_global:
            max_val_global = s_max

    return volume_field, min_val_global, max_val_global
