from app.ingestion.base import IngestionAdapter
from app.ingestion.registry import AdapterRegistry, register_adapter

# Import built-in and plugin adapters to register them
from app.ingestion import argo  # noqa: F401  (registers the Argo adapter)

__all__ = ["IngestionAdapter", "AdapterRegistry", "register_adapter"]
