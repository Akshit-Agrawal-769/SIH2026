import os
import sys
from typing import Optional
from fastapi import APIRouter

api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "api"))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from app import analytics_engine as ae

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/timeseries")
def get_analytics_timeseries(variable: str = "temperature", lat: float = 13.691, lon: float = 88.074, depth: float = 10.0):
    return ae.compute_timeseries(variable, lat, lon, depth)

@router.get("/anomalies")
def get_analytics_anomalies(variable: str = "temperature", lat: float = 13.691, lon: float = 88.074, depth: float = 10.0, date: str = "2024-06-03"):
    return ae.compute_anomalies(variable, lat, lon, depth, date)

@router.get("/correlation")
def get_analytics_correlation(lat: float = 13.691, lon: float = 88.074, depth: float = 10.0, date: str = "2024-06-03"):
    return ae.compute_correlation(lat, lon, depth, date)

@router.get("/profile")
def get_analytics_profile(lat: float = 13.691, lon: float = 88.074, variable: str = "temperature", date: str = "2024-06-03"):
    return ae.compute_vertical_profile_analysis(lat, lon, variable, date)
