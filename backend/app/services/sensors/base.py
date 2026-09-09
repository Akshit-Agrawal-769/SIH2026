"""Sensor Platform Plugin Framework.

Provides extensible abstract interfaces and a dynamic registry
for oceanographic in-situ and remote sensing assets (Argo, Gliders, Moored Buoys, HF-Radar, ADCP).
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseSensorAdapter(ABC):
    """Abstract Base Class for all ocean sensor adapters.

    Subclasses must implement properties for the sensor type and description,
    as well as query methods for platform discovery and vertical profile retrieval.
    """

    @property
    @abstractmethod
    def sensor_type(self) -> str:
        """Return the canonical sensor type identifier (e.g. 'argo', 'glider', 'mooring').

        Returns:
            str: Identifier for the sensor platform category.
        """
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Return human-readable description of the sensor platform and instrumentation.

        Returns:
            str: Explanatory summary of the sensor instrument and mission profile.
        """
        pass

    @abstractmethod
    def get_platforms(self, bounding_box: Optional[Dict[str, float]] = None) -> List[Dict[str, Any]]:
        """Return list of active platforms with latest geospatial coordinates and status.

        Args:
            bounding_box: Optional dictionary specifying 'min_lat', 'max_lat',
                'min_lon', and 'max_lon' bounding coordinates.

        Returns:
            List[Dict[str, Any]]: List of platform metadata records.
        """
        pass

    @abstractmethod
    def get_profile(self, platform_id: str, cycle_number: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Return calibrated physical vertical profile for a platform.

        Args:
            platform_id: Unique platform alphanumeric designation (e.g. WMO number).
            cycle_number: Optional cycle or cast index. If None, returns latest available profile.

        Returns:
            Optional[Dict[str, Any]]: Calibrated vertical profile record or None if not found.
        """
        pass

    def get_telemetry(self, platform_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve real-time telemetry metrics for moored buoys or autonomous vehicles.

        Args:
            platform_id: Alphanumeric identifier for the platform.

        Returns:
            Optional[Dict[str, Any]]: Telemetry dictionary or None if unsupported.
        """
        return None


class SensorPluginRegistry:
    """Central registry maintaining active sensor platform adapters."""

    def __init__(self) -> None:
        """Initialize empty registry of sensor adapters."""
        self._adapters: Dict[str, BaseSensorAdapter] = {}

    def register(self, adapter: BaseSensorAdapter) -> None:
        """Register a concrete sensor platform adapter.

        Args:
            adapter: Concrete instance conforming to BaseSensorAdapter.
        """
        self._adapters[adapter.sensor_type.lower()] = adapter

    def get(self, sensor_type: str) -> Optional[BaseSensorAdapter]:
        """Look up a sensor adapter by its type identifier.

        Args:
            sensor_type: Alphanumeric sensor category key (case-insensitive).

        Returns:
            Optional[BaseSensorAdapter]: Registered adapter or None if not found.
        """
        return self._adapters.get(sensor_type.lower())

    def list_sensors(self) -> List[Dict[str, str]]:
        """List all registered sensor adapters with descriptions and class names.

        Returns:
            List[Dict[str, str]]: Summary dictionaries of registered sensor adapters.
        """
        return [
            {
                "sensor_type": adapter.sensor_type,
                "description": adapter.description,
                "adapter_class": adapter.__class__.__name__,
            }
            for adapter in self._adapters.values()
        ]


# Global singleton registry
sensor_registry: SensorPluginRegistry = SensorPluginRegistry()
