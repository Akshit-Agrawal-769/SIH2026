"""
Backend test suite verifying Natural Earth geographic data structure and GeoJSON specifications.
"""
import os
import json
import pytest

def test_natural_earth_canonical_structure():
    """Verify Phase 3 canonical directory structure for Natural Earth 10m shapefiles and processed GeoJSONs."""
    source_coastline_dir = "datasets/geography/natural-earth/10m/source/coastline"
    source_land_dir = "datasets/geography/natural-earth/10m/source/land"
    processed_dir = "datasets/geography/natural-earth/10m/processed"
    frontend_geo_dir = "frontend/public/geography"

    assert os.path.isdir(source_coastline_dir), f"Missing {source_coastline_dir}"
    assert os.path.isdir(source_land_dir), f"Missing {source_land_dir}"
    assert os.path.isdir(processed_dir), f"Missing {processed_dir}"
    assert os.path.isdir(frontend_geo_dir), f"Missing {frontend_geo_dir}"

    # Verify complete shapefile component sets (.shp, .shx, .dbf, .prj)
    for ext in [".shp", ".shx", ".dbf", ".prj"]:
        coast_file = os.path.join(source_coastline_dir, f"ne_10m_coastline{ext}")
        land_file = os.path.join(source_land_dir, f"ne_10m_land{ext}")
        assert os.path.isfile(coast_file), f"Missing coastline source component {coast_file}"
        assert os.path.isfile(land_file), f"Missing land source component {land_file}"

def test_natural_earth_geojson_integrity():
    """Verify Phase 6 & Phase 23 GeoJSON validation gates."""
    for base_dir in ["datasets/geography/natural-earth/10m/processed", "frontend/public/geography"]:
        coastline_json_path = os.path.join(base_dir, "coastline.geojson")
        land_json_path = os.path.join(base_dir, "land.geojson")

        assert os.path.isfile(coastline_json_path), f"Missing {coastline_json_path}"
        assert os.path.isfile(land_json_path), f"Missing {land_json_path}"

        # 1. Coastline validation
        with open(coastline_json_path, "r", encoding="utf-8") as f:
            coast_data = json.load(f)
        assert coast_data.get("type") == "FeatureCollection"
        assert len(coast_data.get("features", [])) > 500
        for feat in coast_data["features"]:
            geom = feat.get("geometry", {})
            assert geom.get("type") in ["LineString", "MultiLineString"]
            assert len(geom.get("coordinates", [])) > 0

        # 2. Land validation
        with open(land_json_path, "r", encoding="utf-8") as f:
            land_data = json.load(f)
        assert land_data.get("type") == "FeatureCollection"
        assert len(land_data.get("features", [])) > 0
        for feat in land_data["features"]:
            geom = feat.get("geometry", {})
            assert geom.get("type") in ["Polygon", "MultiPolygon"]
            assert len(geom.get("coordinates", [])) > 0
