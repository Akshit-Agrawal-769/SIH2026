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

class ArgoSourceInfo(BaseModel):
    source: str
    platforms_count: int
    profiles_count: int
    dac: Optional[str] = None
    description: Optional[str] = None

class ArgoMetadataResponse(BaseModel):
    version: str
    total_platforms: int
    total_profiles: int
    providers: List[str]
    sources: List[ArgoSourceInfo]
    qc_policy: str = "Strict QC Policy: Flags 1 (Good) and 2 (Probably Good) verified for scientific comparison. Flags 3, 4, 9 rejected."
    vertical_coordinate: str = "TEOS-10 physical depth (meters) calculated from sea pressure (dbar) via gsw.z_from_p"

class ArgoFloatSummary(BaseModel):
    platform_number: str
    filename: Optional[str] = None
    source: Optional[str] = "coriolis"
    dac: Optional[str] = "Coriolis / GDAC"
    profiles_count: int
    latest_position: Dict[str, float]
    latest_timestamp: Optional[str] = None
    latest_cycle: Optional[int] = None
    cycles: List[int]
    trajectory: Optional[List[Dict[str, Any]]] = []

class ArgoProfileResponse(BaseModel):
    platform_number: str
    cycle_number: int
    timestamp: str
    latitude: float
    longitude: float
    source: Optional[str] = "coriolis"
    dac: Optional[str] = "Coriolis / GDAC"
    data_mode: Optional[str] = "R" # R (Real-Time), D (Delayed), A (Adjusted)
    depths: List[float]
    pressures: Optional[List[float]] = None
    temperature: List[float]
    salinity: Optional[List[Optional[float]]] = None
    qc_flags: List[int]
    qc_summary: Optional[str] = "QC 1 & 2 Verified"

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
    obs_values: List[Optional[float]]
    model_interpolated_values: List[Optional[float]]
    residuals: List[Optional[float]]
    variable: str
    metrics: ComparisonMetrics
