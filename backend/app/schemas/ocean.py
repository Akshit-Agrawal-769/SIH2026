from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class DatasetHealthStatus(BaseModel):
    status: str
    available_datasets: List[str]
    missing_datasets: List[str]
    data_policy: str = "STRICT NO MOCK DATA"

class DatasetMetadataResponse(BaseModel):
    filename: str
    title: str
    source: str
    grid_type: Optional[str] = "rectilinear"
    is_native_s_coord: Optional[bool] = False
    bounds: Dict[str, float]
    depth_levels: List[float]
    time_range: List[str]
    variables: List[str]
    variable_info: Dict[str, Any]
    dimensions: Dict[str, int]

class ArgoFloatSummary(BaseModel):
    platform_number: str
    filename: str
    profiles_count: int
    latest_position: Dict[str, float]
    cycles: List[int]
    trajectory: List[Dict[str, Any]]

class ArgoProfileResponse(BaseModel):
    platform_number: str
    cycle_number: int
    timestamp: str
    latitude: float
    longitude: float
    depths: List[float]
    temperature: List[float]
    salinity: Optional[List[Optional[float]]] = None
    qc_flags: List[int]

class ComparisonMetrics(BaseModel):
    bias: float
    mae: float
    rmse: float
    pearson_r: Optional[float] = None
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
    variable: str
    metrics: ComparisonMetrics
