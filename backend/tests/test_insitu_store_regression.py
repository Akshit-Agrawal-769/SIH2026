import os
import tempfile
import pytest
from app.services.insitu_store import insitu_store, InSituStore


def test_resolve_platform_target_cycle_none():
    """Verify target_cycle=None resolves without raising TypeError."""
    insitu_store._ensure_indexed()
    assert len(insitu_store._platforms_index) > 0

    first_wmo = next(iter(insitu_store._platforms_index))
    plat_meta = insitu_store._platforms_index[first_wmo]

    resolved_path = insitu_store._resolve_platform_file_path(first_wmo, None, plat_meta)
    if plat_meta.get("has_local_data") or first_wmo in insitu_store._local_wmos:
        assert resolved_path is not None
        assert os.path.exists(resolved_path)


def test_resolve_platform_valid_target_cycle():
    """Verify resolving platform with valid integer target_cycle."""
    insitu_store._ensure_indexed()
    for wmo, plat in insitu_store._platforms_index.items():
        cycle_files = plat.get("cycle_files", {})
        if cycle_files:
            target_cycle = int(next(iter(cycle_files.keys())))
            path = insitu_store._resolve_platform_file_path(wmo, target_cycle, plat)
            if path:
                assert os.path.exists(path)
            break


def test_resolve_platform_missing_path():
    """Verify non-existent platform returns None safely without error."""
    insitu_store._ensure_indexed()
    path = insitu_store._resolve_platform_file_path("NONEXISTENT_WMO_9999999", 1, None)
    assert path is None


def test_resolve_platform_multiple_candidates():
    """Verify resolving from a directory with multiple cycle files."""
    store = InSituStore()
    with tempfile.TemporaryDirectory() as tmp_dir:
        # Create multiple NetCDF dummy files
        f1 = os.path.join(tmp_dir, "D1900816_001.nc")
        f2 = os.path.join(tmp_dir, "D1900816_002.nc")
        open(f1, "wb").write(b"")
        open(f2, "wb").write(b"")

        mock_plat = {
            "platform_number": "1900816",
            "files_dir": tmp_dir,
            "cycle_files": {},
            "trajectory": []
        }

        # 1. target_cycle=None should resolve any .nc file
        res_none = store._resolve_platform_file_path("1900816", None, mock_plat)
        assert res_none in (f1, f2)

        # 2. target_cycle=2 should specifically resolve f2
        res_c2 = store._resolve_platform_file_path("1900816", 2, mock_plat)
        assert res_c2 == f2

        # 3. target_cycle=1 should specifically resolve f1
        res_c1 = store._resolve_platform_file_path("1900816", 1, mock_plat)
        assert res_c1 == f1


def test_resolve_platform_malformed_unavailable_path():
    """Verify malformed or unresolvable path returns None gracefully."""
    store = InSituStore()
    mock_plat = {
        "platform_number": "9999999",
        "files_dir": "/dev/null/nonexistent/directory/or/path",
        "cycle_files": {"1": "invalid/path/that/does/not/exist.nc"},
        "trajectory": [{"cycle_number": 1, "file_rel_path": "another/fake/path.nc"}]
    }

    res_none = store._resolve_platform_file_path("9999999", None, mock_plat)
    assert res_none is None

    res_c1 = store._resolve_platform_file_path("9999999", 1, mock_plat)
    assert res_c1 is None
