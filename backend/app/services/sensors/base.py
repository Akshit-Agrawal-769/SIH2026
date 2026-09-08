"""
Sensor Platform Plugin Framework
Provides extensible abstract interfaces and a dynamic registry
for oceanographic in-situ and remote sensing assets (Argo, Gliders, Moored Buoys, HF-Radar, ADCP).
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from pathlib import Path


class BaseSensorAdapter(ABC):
    """Abstract Base Class for all ocean sensor adapters."""

    @property
    @abstractmethod
    def sensor_type(self) -> str:
        """Returns canonical sensor type identifier (e.g., 'argo', 'glider', 'mooring', 'hf_radar', 'adcp')."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable description of the sensor platform and instrumentation."""
        pass

    @abstractmethod
    def get_platforms(self, bounding_box: Optional[Dict[str, float]] = None) -> List[Dict[str, Any]]:
        """Returns list of active platforms with latest geospatial coordinates and status."""
        pass

    @abstractmethod
    def get_profile(self, platform_id: str, cycle_number: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Returns calibrated physical vertical profile (depth, temp, sal, etc.) for a platform."""
        pass

    def get_telemetry(self, platform_id: str) -> Optional[Dict[str, Any]]:
        """Optional telemetry hook for real-time mooring buoys or autonomous vehicles."""
        return None


class SensorPluginRegistry:
    """Central registry maintaining active sensor platform adapters."""

    def __init__(self):
        self._adapters: Dict[str, BaseSensorAdapter] = {}

    def register(self, adapter: BaseSensorAdapter):
        self._adapters[adapter.sensor_type.lower()] = adapter

    def get(self, sensor_type: str) -> Optional[BaseSensorAdapter]:
        return self._adapters.get(sensor_type.lower())

    def list_sensors(self) -> List[Dict[str, str]]:
        return [
            {
                "sensor_type": adapter.sensor_type,
                "description": adapter.description,
                "adapter_class": adapter.__class__.__name__
            }
            for adapter in self._adapters.values()
        ]


# Global singleton registry
sensor_registry = SensorPluginRegistry()
