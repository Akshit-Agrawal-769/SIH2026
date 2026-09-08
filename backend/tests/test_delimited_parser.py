import pytest
from app.services.delimited_parser import DelimitedOceanParser


def test_csv_ingestion_standard():
    parser = DelimitedOceanParser()
    csv_content = """# Cruise INCOIS-2026-CTD-01
latitude,longitude,depth,temperature,salinity,datetime,platform_id
15.5,68.2,0.0,28.45,35.21,2026-08-01T12:00:00Z,CTD_CAST_01
15.5,68.2,10.0,28.10,35.25,2026-08-01T12:00:00Z,CTD_CAST_01
15.5,68.2,50.0,24.30,35.80,2026-08-01T12:00:00Z,CTD_CAST_01
15.5,68.2,100.0,18.90,36.10,2026-08-01T12:00:00Z,CTD_CAST_01
15.5,68.2,500.0,10.20,35.40,2026-08-01T12:00:00Z,CTD_CAST_01
"""
    res = parser.parse_content(csv_content, filename="test_cast.csv")
    assert res["platform_id"] == "CTD_CAST_01"
    assert res["latitude"] == 15.5
    assert res["longitude"] == 68.2
    assert res["levels_count"] == 5
    assert res["depths"] == [0.0, 10.0, 50.0, 100.0, 500.0]
    assert res["temperatures"][0] == 28.45
    assert res["salinities"][0] == 35.21


def test_tsv_and_sentinel_filtering():
    parser = DelimitedOceanParser()
    tsv_content = """lat\tlon\tz\ttemp\tsal
10.0\t75.0\t5.0\t29.1\t34.8
10.0\t75.0\t20.0\t-999.0\t35.0
10.0\t75.0\t100.0\t20.5\t-9999.0
"""
    res = parser.parse_content(tsv_content, filename="glider_transect.tsv")
    assert res["levels_count"] == 3
    assert res["temperatures"][1] is None  # sentinel -999.0 converted to None
    assert res["salinities"][2] is None    # sentinel -9999.0 converted to None
    assert res["temperatures"][0] == 29.1
