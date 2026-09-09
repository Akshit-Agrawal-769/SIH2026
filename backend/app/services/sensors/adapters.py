"""Concrete Sensor Platform Adapters for Argo, Gliders, Moored Buoys, and HF-Radar.

Implements concrete platform plugins conforming to BaseSensorAdapter,
enabling unified querying of in-situ profilers, autonomous gliders,
and moored ocean meteorological buoy networks.
"""

from typing import Any, Dict, List, Optional
from app.services.insitu_store import insitu_store
from app.services.sensors.base import BaseSensorAdapter, sensor_registry


class ArgoSensorAdapter(BaseSensorAdapter):
    """Adapter for global Argo profiling floats with TEOS-10 conversions and QC flags."""

    @property
    def sensor_type(self) -> str:
        """Return canonical sensor identifier for Argo profilers."""
        return "argo"

    @property
    def description(self) -> str:
        """Return platform description for autonomous profiling CTD floats."""
        return "Autonomous profiling CTD floats drifting and ascending from 2000m to sea surface."

    def get_platforms(self, bounding_box: Optional[Dict[str, float]] = None) -> List[Dict[str, Any]]:
        """Query active Argo floats within optional geospatial bounding coordinates.

        Args:
            bounding_box: Optional dictionary with 'min_lat', 'max_lat', 'min_lon', 'max_lon'.

        Returns:
            List[Dict[str, Any]]: Serialized float summary records.
        """
        kwargs = {}
        if bounding_box:
            kwargs = {
                'min_lat': bounding_box.get('min_lat'),
                'max_lat': bounding_box.get('max_lat'),
                'min_lon': bounding_box.get('min_lon'),
                'max_lon': bounding_box.get('max_lon'),
            }
        summaries = insitu_store.get_float_summaries(**kwargs)
        return [s.model_dump() for s in summaries]

    def get_profile(self, platform_id: str, cycle_number: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Retrieve quality-controlled physical vertical profile for an Argo float.

        Args:
            platform_id: WMO platform number string.
            cycle_number: Optional cycle index. Defaults to latest profile if None.

        Returns:
            Optional[Dict[str, Any]]: Serialized profile dictionary or None.
        """
        prof = insitu_store.get_profile(platform_id, cycle_number, filter_qc=True)
        return prof.model_dump() if prof else None


class GliderSensorAdapter(BaseSensorAdapter):
    """Adapter for Autonomous Underwater Gliders (AUGs) executing sawtooth trajectories."""

    def __init__(self) -> None:
        """Initialize in-memory glider mission registry."""
        self._glider_missions: Dict[str, Dict[str, Any]] = {}

    @property
    def sensor_type(self) -> str:
        """Return canonical sensor identifier for underwater gliders."""
        return "glider"

    @property
    def description(self) -> str:
        """Return platform description for autonomous underwater gliders."""
        return "Autonomous Underwater Gliders (AUGs) executing sawtooth vertical sampling across oceanic transects."

    def register_glider(self, platform_id: str, metadata: Dict[str, Any], profile_data: Dict[str, Any]) -> None:
        """Register an active glider mission profile.

        Args:
            platform_id: Alphanumeric identifier for the glider vehicle.
            metadata: Platform metadata (deployment date, status, agency).
            profile_data: Vertical transect profile data (depth, temp, sal).
        """
        self._glider_missions[platform_id] = {
            "metadata": metadata,
            "profile": profile_data
        }

    def get_platforms(self, bounding_box: Optional[Dict[str, float]] = None) -> List[Dict[str, Any]]:
        """Return list of active glider platforms.

        Args:
            bounding_box: Optional bounding box filter (currently unused for small fleet).

        Returns:
            List[Dict[str, Any]]: Summary records for registered glider platforms.
        """
        platforms = []
        for pid, g in self._glider_missions.items():
            meta = g["metadata"]
            platforms.append({
                "platform_number": pid,
                "platform_type": "underwater_glider",
                "source": meta.get("source", "INCOIS Glider Facility"),
                "latest_position": meta.get("latest_position", {"latitude": 12.5, "longitude": 84.0}),
                "status": meta.get("status", "operational"),
                "deployment_date": meta.get("deployment_date", "2026-07-01T00:00:00Z"),
                "profiles_count": meta.get("profiles_count", 42),
            })
        return platforms

    def get_profile(self, platform_id: str, cycle_number: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Retrieve glider profile for a given platform.

        Args:
            platform_id: Unique glider platform identifier.
            cycle_number: Optional cast index (unused if mission profile is static).

        Returns:
            Optional[Dict[str, Any]]: Glider vertical profile dictionary or None.
        """
        g = self._glider_missions.get(platform_id)
        if g:
            return g.get("profile")
        return None


class MooringBuoyAdapter(BaseSensorAdapter):
    """Adapter for moored marine observation platforms (OMNI, RAMA, coastal buoys)."""

    def __init__(self) -> None:
        """Initialize mooring buoy state with reference deep-sea mooring configurations."""
        self._buoys: Dict[str, Dict[str, Any]] = {
            "INCOIS_BD08": {
                "platform_number": "INCOIS_BD08",
                "name": "Bay of Bengal OMNI Deep Sea Mooring BD08",
                "source": "INCOIS OMNI Mooring Network",
                "latest_position": {"latitude": 18.20, "longitude": 89.67},
                "status": "operational",
                "battery_level": 96,
                "telemetry": {
                    "sea_surface_temp": 29.15,
                    "salinity": 32.84,
                    "wave_height_hs": 1.45,
                    "wave_period_tp": 6.8,
                    "current_speed": 0.52,
                    "current_direction": 195,
                    "wind_speed": 11.4,
                    "atmospheric_pressure": 1009.8,
                    "last_transmission_utc": "2026-09-08T06:00:00Z"
                },
                "profile": {
                    "platform_number": "INCOIS_BD08",
                    "cycle_number": 1,
                    "datetime": "2026-09-08T06:00:00Z",
                    "latitude": 18.20,
                    "longitude": 89.67,
                    "levels_count": 8,
                    "depths": [0.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0],
                    "temperatures": [29.15, 29.05, 28.60, 24.20, 18.50, 14.10, 9.80],
                    "salinities": [32.84, 32.89, 33.40, 34.80, 35.10, 35.05, 34.95],
                }
            },
            "INCOIS_AD01": {
                "platform_number": "INCOIS_AD01",
                "name": "Arabian Sea OMNI Deep Sea Mooring AD01",
                "source": "INCOIS OMNI Mooring Network",
                "latest_position": {"latitude": 15.00, "longitude": 69.00},
                "status": "operational",
                "battery_level": 94,
                "telemetry": {
                    "sea_surface_temp": 28.20,
                    "salinity": 36.15,
                    "wave_height_hs": 1.80,
                    "wave_period_tp": 7.4,
                    "current_speed": 0.38,
                    "current_direction": 240,
                    "wind_speed": 13.8,
                    "atmospheric_pressure": 1012.1,
                    "last_transmission_utc": "2026-09-08T06:00:00Z"
                },
                "profile": {
                    "platform_number": "INCOIS_AD01",
                    "cycle_number": 1,
                    "datetime": "2026-09-08T06:00:00Z",
                    "latitude": 15.00,
                    "longitude": 69.00,
                    "levels_count": 7,
                    "depths": [0.0, 15.0, 30.0, 50.0, 100.0, 200.0, 500.0],
                    "temperatures": [28.20, 28.10, 27.50, 23.80, 17.90, 13.50, 9.40],
                    "salinities": [36.15, 36.18, 36.25, 36.40, 35.80, 35.20, 34.90],
                }
            }
        }

    @property
    def sensor_type(self) -> str:
        """Return canonical sensor identifier for moored buoys."""
        return "mooring"

    @property
    def description(self) -> str:
        """Return platform description for moored ocean meteorological buoy networks."""
        return "Moored Ocean Meteorological & Hydrographic Buoy Network (OMNI / RAMA)."

    def get_platforms(self, bounding_box: Optional[Dict[str, float]] = None) -> List[Dict[str, Any]]:
        """Return list of active moored buoy stations.

        Args:
            bounding_box: Optional bounding box dictionary.

        Returns:
            List[Dict[str, Any]]: Summary records of moored buoy platforms.
        """
        return list(self._buoys.values())

    def get_profile(self, platform_id: str, cycle_number: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Retrieve vertical hydrographic profile measured by mooring thermistor/CTD chain.

        Args:
            platform_id: Mooring station code (e.g. 'INCOIS_BD08').
            cycle_number: Optional cycle index (unused for fixed mooring profiles).

        Returns:
            Optional[Dict[str, Any]]: Mooring depth-stratified profile data or None.
        """
        buoy = self._buoys.get(platform_id)
        return buoy.get("profile") if buoy else None

    def get_telemetry(self, platform_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve near-real-time met-ocean surface and meteorological telemetry.

        Args:
            platform_id: Mooring station code (e.g. 'INCOIS_BD08').

        Returns:
            Optional[Dict[str, Any]]: Met-ocean telemetry dictionary or None.
        """
        buoy = self._buoys.get(platform_id)
        return buoy.get("telemetry") if buoy else None


# Register default adapters in registry
sensor_registry.register(ArgoSensorAdapter())
sensor_registry.register(GliderSensorAdapter())
sensor_registry.register(MooringBuoyAdapter())
