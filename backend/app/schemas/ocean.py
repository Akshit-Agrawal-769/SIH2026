from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class DatasetHealthStatus(BaseModel):
    status: str
    available_datasets: List[str]
    missing_datasets: List[str]
    data_policy: str = "STRICT NO MOCK DATA"

class DatasetMetadataResponse(BaseModel):
    dataset_id: str
    title: str
    source: str
    variables: List[str]
    dimensions: Dict[str, int]
    time_range: List[str]
    depth_levels: List[float]
    bounds: Dict[str, float]

class ArgoProfileResponse(BaseModel):
    platform_number: str
    cycle_number: int
    timestamp: str
    latitude: float
    longitude: float
    depths: List[float]
    temperature: List[float]
    salinity: Optional[List[float]] = None
    qc_flags: List[int]

class ComparisonMetrics(BaseModel):
    bias: float
    mae: float
    rmse: float
    pearson_r: float
    sample_count: int

class ModelVsObsComparisonResponse(BaseModel):
    platform_number: str
    cycle_number: int
    timestamp: str
    latitude: float
    longitude: float
    depths: List[float]
    obs_values: List[float]
    model_interpolated_values: List[float]
    residuals: List[float]
    metrics: ComparisonMetrics
