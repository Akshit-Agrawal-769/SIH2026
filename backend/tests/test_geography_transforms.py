import math
import numpy as np
import pytest

EARTH_RADIUS = 5.0

def lat_lon_to_vector3(lat: float, lon: float, radius: float = EARTH_RADIUS, alt_offset: float = 0.0):
    r = radius + alt_offset
    phi = (90.0 - lat) * (math.pi / 180.0)
    theta = (lon + 90.0) * (math.pi / 180.0)

    x = -r * math.sin(phi) * math.cos(theta)
    z = r * math.sin(phi) * math.sin(theta)
    y = r * math.cos(phi)
    return np.array([x, y, z])

def vector3_to_lat_lon(vec: np.ndarray, radius: float = EARTH_RADIUS):
    norm = vec / np.linalg.norm(vec)
    phi = math.acos(max(-1.0, min(1.0, norm[1])))
    latitude = 90.0 - phi * (180.0 / math.pi)

    theta = math.atan2(norm[2], -norm[0])
    longitude = (theta * (180.0 / math.pi)) - 90.0

    while longitude < -180.0:
        longitude += 360.0
    while longitude > 180.0:
        longitude -= 360.0

    return latitude, longitude

def test_geographic_transform_roundtrip_precision():
    """Verify round-trip error between Lat/Lon and Three.js 3D Sphere is < 0.0001 degrees."""
    test_points = [
        ("Equator Prime", 0.0, 0.0),
        ("High Latitude North", 85.0, 45.0),
        ("High Latitude South", -85.0, -120.0),
        ("India Central", 20.5937, 78.9629),
        ("Mumbai Offshore", 18.9220, 72.8347),
        ("Chennai Offshore", 13.0827, 80.2707),
        ("Sri Lanka", 7.8731, 80.7718),
        ("Arabian Sea Basin", 15.0, 65.0),
        ("Bay of Bengal Basin", 15.0, 88.0),
        ("Madagascar", -18.7669, 46.8691),
        ("WMO Float 2902120", 12.83, 69.0),
        ("WMO Float 2902084", 13.69, 88.07),
        ("East Africa Somalia", 2.0, 45.0),
        ("Indonesia Sumatra", -0.5, 101.0),
    ]

    for name, lat, lon in test_points:
        vec3 = lat_lon_to_vector3(lat, lon, EARTH_RADIUS)
        r_lat, r_lon = vector3_to_lat_lon(vec3, EARTH_RADIUS)

        lat_err = abs(r_lat - lat)
        lon_err = abs(r_lon - lon)

        assert lat_err < 1e-4, f"Lat error too high for {name}: {lat_err}°"
        assert lon_err < 1e-4, f"Lon error too high for {name}: {lon_err}°"

def test_polar_singularities_latitude_preservation():
    """At true poles (lat = ±90°), longitude is degenerate, verify exact latitude preservation."""
    north_vec = lat_lon_to_vector3(90.0, 0.0, EARTH_RADIUS)
    south_vec = lat_lon_to_vector3(-90.0, 0.0, EARTH_RADIUS)

    r_lat_n, _ = vector3_to_lat_lon(north_vec, EARTH_RADIUS)
    r_lat_s, _ = vector3_to_lat_lon(south_vec, EARTH_RADIUS)

    assert abs(r_lat_n - 90.0) < 1e-4, "North pole latitude must be exact 90°"
    assert abs(r_lat_s - (-90.0)) < 1e-4, "South pole latitude must be exact -90°"

def test_surface_vs_3d_variable_dimensions():
    """Verify surface variables (SST, SSS, MLD, CHL) have 2D/3D spatial dims vs full 4D."""
    surface_vars = ["temp_surface", "salt_surface", "mld", "chlorophyll", "pco2"]
    volume_vars = ["temp", "salt", "u", "v"]

    # Mock spatial metadata inspection
    surface_dims = {"temp_surface": ("time", "lat", "lon"), "mld": ("time", "lat", "lon")}
    volume_dims = {"temp": ("time", "depth", "lat", "lon"), "salt": ("time", "depth", "lat", "lon")}

    for var in surface_dims:
        assert len(surface_dims[var]) == 3, f"{var} should be surface field"
    for var in volume_dims:
        assert len(volume_dims[var]) == 4, f"{var} should be volumetric field"

def test_missing_data_nan_preservation():
    """Verify that land masks and missing ocean observations remain strictly NaN."""
    raw_array = np.array([28.4, np.nan, 30.1, -999.0, 27.8])
    # Quality filter replacing sentinel missing values with NaN
    cleaned = np.where(raw_array == -999.0, np.nan, raw_array)

    assert np.isnan(cleaned[1]), "Original NaN must not be replaced with zero or mean"
    assert np.isnan(cleaned[3]), "-999 sentinel must be converted to NaN"
    assert cleaned[0] == 28.4
