"""
Unit tests for OceanModel memory-bounded LRU cache and Prometheus metrics (BUG-0018).
"""
import pytest
import numpy as np
import xarray as xr
from backend.app.services.ocean_model import OceanModel


@pytest.fixture
def synthetic_ds():
    """Create a minimal 3D xarray dataset for cache testing."""
    lon = np.linspace(60, 70, 8)
    lat = np.linspace(10, 20, 8)
    depth = np.linspace(0, 100, 4)
    time = [np.datetime64("2023-01-01"), np.datetime64("2023-01-02")]
    data = np.ones((2, 4, 8, 8), dtype=np.float32)
    ds = xr.Dataset(
        {"temp": (["time", "depth", "lat", "lon"], data)},
        coords={"time": time, "depth": depth, "lat": lat, "lon": lon},
    )
    return ds


def test_ocean_model_cache_byte_bounds(synthetic_ds):
    """Verify that OceanModel enforces both entry count and byte bounds."""
    model = OceanModel(synthetic_ds)
    assert model._max_cache_bytes == 256 * 1024 * 1024
    assert model._current_cache_bytes == 0

    # Extract first volume at time_idx 0
    res1 = model.extract_volume_buffer(variable="temp", time_idx=0, target_shape=(8, 8, 4))
    assert res1 is not None
    buf1, meta1 = res1
    buf1_size = len(buf1)
    assert model._current_cache_bytes == buf1_size
    assert len(model._volume_cache) == 1

    # Extract same volume -> cache hit
    res1_hit = model.extract_volume_buffer(variable="temp", time_idx=0, target_shape=(8, 8, 4))
    assert res1_hit is res1
    assert model._current_cache_bytes == buf1_size

    # Set byte limit to 1.5x of single buffer size (can hold 1 buffer, but not 2)
    model._max_cache_bytes = int(buf1_size * 1.5)

    # Extract second volume at time_idx 1 (same shape/size = buf1_size)
    res2 = model.extract_volume_buffer(variable="temp", time_idx=1, target_shape=(8, 8, 4))
    assert res2 is not None
    buf2, _ = res2
    assert len(buf2) == buf1_size

    # Since buf1_size + len(buf2) > _max_cache_bytes, res1 must have been evicted and res2 stored
    assert len(model._volume_cache) == 1
    assert model._current_cache_bytes == len(buf2)
    assert (("temp", 1, (8, 8, 4), None)) in model._volume_cache
    assert (("temp", 0, (8, 8, 4), None)) not in model._volume_cache

    # Clean close resets cache
    model.close()
    assert len(model._volume_cache) == 0
    assert model._current_cache_bytes == 0
