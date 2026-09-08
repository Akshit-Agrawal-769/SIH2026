import pytest
from app.services.sensors import sensor_registry
from app.services.sensors.adapters import GliderSensorAdapter, MooringBuoyAdapter


def test_sensor_registry_defaults():
    sensors = sensor_registry.list_sensors()
    sensor_types = [s["sensor_type"] for s in sensors]
    assert "argo" in sensor_types
    assert "glider" in sensor_types
    assert "mooring" in sensor_types


def test_mooring_buoy_adapter():
    adapter = sensor_registry.get("mooring")
    assert adapter is not None
    platforms = adapter.get_platforms()
    assert len(platforms) >= 2
    
    # Check OMNI buoy BD08
    bd08_profile = adapter.get_profile("INCOIS_BD08")
    assert bd08_profile is not None
    assert bd08_profile["platform_number"] == "INCOIS_BD08"
    assert len(bd08_profile["depths"]) > 5
    assert bd08_profile["temperatures"][0] == 29.15

    telemetry = adapter.get_telemetry("INCOIS_BD08")
    assert telemetry is not None
    assert "sea_surface_temp" in telemetry


def test_custom_glider_registration():
    glider_adapter: GliderSensorAdapter = sensor_registry.get("glider")
    assert glider_adapter is not None

    glider_adapter.register_glider(
        platform_id="GLIDER_INCOIS_SEAL_01",
        metadata={
            "source": "INCOIS Bay of Bengal Mission",
            "latest_position": {"latitude": 13.2, "longitude": 85.4},
            "status": "active_sampling",
            "deployment_date": "2026-08-15T00:00:00Z",
            "profiles_count": 88
        },
        profile_data={
            "platform_number": "GLIDER_INCOIS_SEAL_01",
            "depths": [0, 50, 100, 200, 500, 1000],
            "temperatures": [28.8, 26.5, 20.1, 14.3, 8.9, 5.2],
            "salinities": [33.1, 34.2, 34.9, 35.1, 35.0, 34.8]
        }
    )

    platforms = glider_adapter.get_platforms()
    platform_ids = [p["platform_number"] for p in platforms]
    assert "GLIDER_INCOIS_SEAL_01" in platform_ids

    prof = glider_adapter.get_profile("GLIDER_INCOIS_SEAL_01")
    assert prof is not None
    assert prof["temperatures"][0] == 28.8
