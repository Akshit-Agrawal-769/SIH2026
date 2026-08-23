"""
Base Abstract Ocean Data Adapter Interface
"""

from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseOceanAdapter(ABC):
    
    @abstractmethod
    def validate_schema(self, file_path_or_url: str) -> bool:
        """Validates file CF conventions, coordinate dimensions, and variables."""
        pass
        
    @abstractmethod
    def extract_metadata(self, file_path_or_url: str) -> Dict[str, Any]:
        """Extracts spatial bounding box, depth levels, time range, and variable attributes."""
        pass
