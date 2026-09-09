import importlib
import inspect
from typing import Dict, Type, Any, List, Optional
from app.ingestion.base import IngestionAdapter

class AdapterRegistry:
    """
    Central registry for all observational platform and numerical model ingestion adapters.
    Enables zero-touch plug-and-play extensibility: any newly added adapter class
    decorated with @register_adapter is automatically discovered and activated.
    """
    _adapters: Dict[str, Type[IngestionAdapter]] = {}
    _metadata: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def register(
        cls,
        platform_type: str,
        display_name: str,
        description: str,
        sensor_parameters: Optional[List[str]] = None,
        data_frequency: str = "Daily",
        institution: str = "INCOIS"
    ):
        """Decorator to register an IngestionAdapter implementation."""
        def decorator(adapter_cls: Type[IngestionAdapter]):
            cls._adapters[platform_type] = adapter_cls
            cls._metadata[platform_type] = {
                "platform_type": platform_type,
                "display_name": display_name,
                "description": description,
                "sensor_parameters": sensor_parameters or ["temperature", "salinity"],
                "data_frequency": data_frequency,
                "institution": institution,
                "class_name": adapter_cls.__name__
            }
            return adapter_cls
        return decorator

    @classmethod
    def get_adapter(cls, platform_type: str) -> Optional[IngestionAdapter]:
        """Instantiate and return an adapter instance by platform type."""
        adapter_cls = cls._adapters.get(platform_type.lower())
        if adapter_cls:
            return adapter_cls()
        return None

    @classmethod
    def list_adapters(cls) -> List[Dict[str, Any]]:
        """Return metadata for all registered adapters."""
        return list(cls._metadata.values())

    @classmethod
    def is_registered(cls, platform_type: str) -> bool:
        """Check if a platform adapter is registered."""
        return platform_type.lower() in cls._adapters

# Convenient decorator alias
register_adapter = AdapterRegistry.register
