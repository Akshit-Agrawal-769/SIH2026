import numpy as np
from typing import Tuple, List, Dict, Any

# Standard 20 oceanographic depth levels from surface to 2000 meters
STANDARD_DEPTH_LEVELS = [
    0.5, 5.0, 15.0, 30.0, 50.0, 75.0, 100.0, 125.0, 150.0, 200.0,
    250.0, 300.0, 400.0, 500.0, 600.0, 800.0, 1000.0, 1250.0, 1500.0, 2000.0
]

# Indian Ocean / EEZ Bounding Box
LON_MIN, LON_MAX = 45.0, 100.0
LAT_MIN, LAT_MAX = -15.0, 30.0
GRID_WIDTH = 220  # 0.25° resolution
GRID_HEIGHT = 180 # 0.25° resolution
GRID_DEPTH = len(STANDARD_DEPTH_LEVELS)

def get_grid_coordinates() -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns the target 1D coordinate arrays for lon, lat, and depth."""
    lons = np.linspace(LON_MIN, LON_MAX, GRID_WIDTH)
    lats = np.linspace(LAT_MIN, LAT_MAX, GRID_HEIGHT)
    depths = np.array(STANDARD_DEPTH_LEVELS, dtype=np.float32)
    return lons, lats, depths

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

def compute_land_mask(lons: np.ndarray, lats: np.ndarray) -> np.ndarray:
    """Computes a 2D boolean mask where True = land, False = ocean."""
    mask = np.zeros((len(lats), len(lons)), dtype=bool)
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            if any(point_in_polygon(lon, lat, poly) for poly in LAND_POLYGONS):
                mask[i, j] = True
    return mask

def generate_synthetic_ocean_field(variable: str, date_str: str = "2024-06-01") -> Tuple[np.ndarray, float, float]:
    """
    Generates realistic 3D oceanographic field physics for the Indian Ocean
    (Thermocline, Halocline, mesoscale eddy advection, coastal upwelling along Somali & Malabar coasts,
    Bay of Bengal low-salinity river discharge plume from Ganges-Brahmaputra).
    Day-over-day physical advection is parameterized via date_str.
    Landmasses are automatically masked out as NaN.
    """
    lons, lats, depths = get_grid_coordinates()
    lon_grid, lat_grid, depth_grid = np.meshgrid(lons, lats, depths, indexing='xy')
    land_mask = compute_land_mask(lons, lats)

    try:
        day_idx = int(date_str.split("-")[-1]) - 1
    except Exception:
        day_idx = 0

    if variable == "temperature":
        # Surface temp: 28°C - 31°C background in tropical Indian Ocean warm pool
        surface_temp = 29.8 - 0.12 * np.abs(lat_grid - 8.0)

        # 1. Intense Somali & Socotra coastal upwelling cold wedge (<22°C)
        # Pulsates and billows eastward into the Arabian Sea with monsoonal wind stress bursts
        somali_extent = 53.0 + day_idx * 0.45
        somali_surge = (5.5 + 2.2 * np.sin(day_idx * 0.45)) * np.exp(
            -((lon_grid - somali_extent)**2 + (lat_grid - 11.0)**2) / 55.0
        )
        oman_surge = (4.2 + 1.6 * np.cos(day_idx * 0.38)) * np.exp(
            -((lon_grid - (59.0 + day_idx * 0.25))**2 + (lat_grid - 19.5)**2) / 40.0
        )
        surface_temp -= (somali_surge + oman_surge)

        # 2. Pronounced westward-propagating mesoscale Rossby eddies & Great Whirl
        # Swirling cyclonic (cold core) and anticyclonic (warm core) vortices drifting ~0.6° lon per day
        eddy_arabian = 3.6 * np.sin(0.18 * (lon_grid + day_idx * 0.55) - 0.28 * lat_grid)
        eddy_bob = 3.0 * np.cos(0.16 * (lon_grid + day_idx * 0.45) + 0.22 * lat_grid)
        # Equatorial thermal wave
        eq_wave = 2.0 * np.sin(0.12 * lon_grid - day_idx * 0.48) * np.exp(-(lat_grid**2) / 35.0)
        surface_temp += (eddy_arabian + eddy_bob + eq_wave)

        depth_decay = np.exp(-depth_grid / 180.0)
        deep_temp = 3.0 + 2.0 * np.exp(-depth_grid / 800.0)
        field = deep_temp + (surface_temp - 3.0) * depth_decay
        field = np.clip(field, 2.0, 32.5).astype(np.float32)

        # Apply land mask across all depth levels
        field[land_mask, :] = np.nan
        valid = field[~np.isnan(field)]
        return field, float(np.min(valid)), float(np.max(valid))

    elif variable == "salinity":
        # High salinity in Arabian Sea (36-37.5 psu) due to excess evaporation
        base_salinity = 34.8
        arabian_sea_high = 2.8 * np.exp(-((lon_grid - (64.0 - day_idx * 0.25))**2 + (lat_grid - 18.0)**2) / 100.0)
        
        # Ganges-Brahmaputra plume: fresh water (<30 PSU) visibly surges and expands southward
        plume_lon = 88.5 - day_idx * 0.25
        plume_lat = 19.5 - day_idx * 0.35
        plume_radius = 50.0 + day_idx * 5.0
        bay_of_bengal_low = -(4.8 + 1.5 * np.sin(day_idx * 0.4)) * np.exp(
            -((lon_grid - plume_lon)**2 + (lat_grid - plume_lat)**2) / plume_radius
        )

        surface_salinity = base_salinity + arabian_sea_high + bay_of_bengal_low
        deep_salinity = 34.7
        depth_weight = np.exp(-depth_grid / 250.0)
        field = deep_salinity * (1.0 - depth_weight) + surface_salinity * depth_weight
        field = np.clip(field, 28.5, 38.0).astype(np.float32)

        field[land_mask, :] = np.nan
        valid = field[~np.isnan(field)]
        return field, float(np.min(valid)), float(np.max(valid))

    elif variable == "chlorophyll":
        # High chlorophyll along coasts & upwelling zones, concentrated in photic zone (0-100m)
        photic_zone = np.exp(-depth_grid / 45.0)
        coastal_bloom = 5.0 * np.exp(-((lon_grid - (72.0 + day_idx * 0.15))**2 + (lat_grid - 14.0)**2) / 30.0)
        somali_bloom = (7.5 + 3.0 * np.sin(day_idx * 0.5)) * np.exp(
            -((lon_grid - (52.0 + day_idx * 0.3))**2 + (lat_grid - 10.0)**2) / 50.0
        )
        field = (0.1 + coastal_bloom + somali_bloom) * photic_zone
        field = np.clip(field, 0.02, 14.0).astype(np.float32)

        field[land_mask, :] = np.nan
        valid = field[~np.isnan(field)]
        return field, float(np.min(valid)), float(np.max(valid))

    elif variable == "currents":
        # Southwest Monsoon drift currents with temporal surge in upper 100m
        depth_decay = np.exp(-depth_grid / 80.0)
        speed = (0.45 + 1.1 * np.sin(np.radians(lat_grid * 3.0 + day_idx * 22.0))) * depth_decay
        field = np.clip(speed, 0.0, 2.5).astype(np.float32)

        field[land_mask, :] = np.nan
        valid = field[~np.isnan(field)]
        return field, float(np.min(valid)), float(np.max(valid))

    else:
        field = np.zeros((GRID_HEIGHT, GRID_WIDTH, GRID_DEPTH), dtype=np.float32)
        field[land_mask, :] = np.nan
        return field, 0.0, 1.0
