from typing import Optional

from fastapi import APIRouter

from app import analytics_engine as ae

router = APIRouter(prefix="/comparison", tags=["comparison"])


@router.get("/{instrument_id}")
def get_model_vs_obs(instrument_id: str, variable: str = "temperature", date: Optional[str] = None):
    """
    Surface matchups between an Argo float and INCOIS Bio-ROMS (IBR): RMSE, MAE,
    bias (model - obs), Pearson r and r^2 from real collocated pairs. When the
    float and the model do not overlap in time, the response is available=false
    with the reason; nothing is substituted.
    """
    return ae.compute_model_vs_obs(instrument_id, variable, date)
