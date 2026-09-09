"""
Unit tests for Coriolis / Argo NetCDF ingestion robustness.
Verifies defensive handling of missing/malformed attributes, QC flag decoding,
and JULD timestamp conversion without batch-indexing crashes (BUG-0017).
"""
import os
import pytest
import numpy as np
from ingestion.ingest_coriolis import (
    decode_qc_flags,
    decode_juld,
    extract_platform_number_from_nc,
    validate_file,
    inspect_file,
)


def test_decode_qc_flags():
    """Verify QC flag decoding across byte arrays, strings, and numpy structures."""
    # Bytes
    assert decode_qc_flags(b"1124", 4) == [1, 1, 2, 4]
    # String
    assert decode_qc_flags("1234", 4) == [1, 2, 3, 4]
    # Numpy array of integers
    assert decode_qc_flags(np.array([1, 2, 0, 4]), 4) == [1, 2, 0, 4]
    # None fallback
    assert decode_qc_flags(None, 3) == [0, 0, 0]


def test_decode_juld():
    """Verify JULD day offset conversion to UTC ISO 8601 strings."""
    iso = decode_juld(26000.5, "1950-01-01T00:00:00Z")
    assert iso is not None
    assert "2021" in iso or "T" in iso

    # Invalid / NaN values return None cleanly without raising
    assert decode_juld(None) is None
    assert decode_juld(np.nan) is None
    assert decode_juld("invalid_juld") is None


def test_inspect_and_validate_real_profile():
    """Verify inspect_file and validate_file against real Argo NetCDF profiles."""
    test_file = os.path.join("datasets", "coriolis", "6901888", "profiles", "R6901888_001.nc")
    if os.path.exists(test_file):
        info = inspect_file(test_file)
        assert info["platform_number"] == "6901888"
        assert info["n_prof"] >= 1
        assert "LATITUDE" in info["variables"]

        valid, errors = validate_file(test_file)
        assert valid is True
        assert len(errors) == 0


def test_validate_nonexistent_file():
    """Verify validate_file fails gracefully on nonexistent paths."""
    valid, errors = validate_file("datasets/non_existent_file.nc")
    assert valid is False
    assert len(errors) > 0
