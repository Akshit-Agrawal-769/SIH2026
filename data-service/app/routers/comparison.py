import os
import sys
from typing import Optional
from fastapi import APIRouter, HTTPException

api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "api"))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from app import analytics_engine as ae

router = APIRouter(prefix="/comparison", tags=["comparison"])

@router.get("/{instrument_id}")
def get_model_vs_obs(instrument_id: str, variable: str = "temperature", date: Optional[str] = None):
    """
    Collocates authentic in-situ instrument profile observations with INCOIS Bio-ROMS model output.
    Computes RMSE, MAE, Bias, Pearson r, and residual vertical depth profile.
    Strict Zero Mock Data: returns explicit empty state if out of domain or missing measurements.
    """
    return ae.compute_model_vs_obs(instrument_id, variable, date)
