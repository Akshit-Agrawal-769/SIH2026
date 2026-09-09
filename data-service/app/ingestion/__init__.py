from app.ingestion.base import IngestionAdapter
from app.ingestion.registry import AdapterRegistry, register_adapter

# Import built-in and plugin adapters to register them
from app.ingestion import argo
from app.ingestion import glider
from app.ingestion import moored_buoy

__all__ = ["IngestionAdapter", "AdapterRegistry", "register_adapter"]
