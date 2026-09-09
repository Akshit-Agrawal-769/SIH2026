from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime

class IngestionAdapter(ABC):
    """
    Abstract base class for all observational and model data ingestion adapters.
    Extensibility pattern: any new sensor (CTD, Mooring, ADCP, HF-Radar) or model
    output implements this interface.
    """

    @property
    @abstractmethod
    def platform_type(self) -> str:
        """Name of the platform type: 'argo', 'glider', 'copernicus_phy', 'incois_las', etc."""
        pass

    @abstractmethod
    def fetch(self, start_date: datetime, end_date: datetime, bbox: List[float]) -> Any:
        """Fetch raw datasets from source (FTP, ERDDAP, OPeNDAP, API)."""
        pass

    @abstractmethod
    def normalize(self, raw_data: Any) -> List[Dict[str, Any]]:
        """
        Normalize raw data into uniform internal schemas:
        - List of instrument dicts
        - List of profile dicts
        - List of depth measurements
        """
        pass

    @abstractmethod
    def store(self, normalized_data: List[Dict[str, Any]]) -> int:
        """Upsert records into PostgreSQL / TimescaleDB and/or MinIO."""
        pass
