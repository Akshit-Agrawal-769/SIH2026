from typing import Optional

from fastapi import APIRouter, Query

from app import analytics_engine as ae

router = APIRouter(prefix="/analytics", tags=["analytics"])

LAT = Query(..., ge=-90.0, le=90.0)
LON = Query(..., ge=-180.0, le=180.0)


@router.get("/timeseries")
def get_analytics_timeseries(variable: str = "temperature", lat: float = LAT, lon: float = LON,
                             depth: float = 0.0):
    return ae.compute_timeseries(variable, lat, lon, depth)


@router.get("/anomalies")
def get_analytics_anomalies(variable: str = "temperature", lat: float = LAT, lon: float = LON,
                            depth: float = 0.0, date: Optional[str] = None):
    return ae.compute_anomalies(variable, lat, lon, depth, date)


@router.get("/correlation")
def get_analytics_correlation(lat: float = LAT, lon: float = LON, depth: float = 0.0,
                              date: Optional[str] = None):
    return ae.compute_correlation(lat, lon, depth, date)


@router.get("/profile")
def get_analytics_profile(lat: float = LAT, lon: float = LON, variable: str = "temperature",
                          date: Optional[str] = None):
    return ae.compute_vertical_profile_analysis(lat, lon, variable, date)
