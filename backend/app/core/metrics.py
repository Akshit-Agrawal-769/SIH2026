"""
Production Metrics Module
Provides Prometheus metrics for monitoring API performance, error rates, and system health.
"""

from prometheus_client import Counter, Histogram, Gauge, Info
from prometheus_fastapi_instrumentator import Instrumentator
from typing import Optional
import time

# Request metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

# Dataset metrics
model_cache_size = Gauge(
    'model_cache_size',
    'Number of models cached in OceanModelRegistry'
)

model_cache_hits = Counter(
    'model_cache_hits_total',
    'Total OceanModelRegistry cache hits'
)

model_cache_misses = Counter(
    'model_cache_misses_total',
    'Total OceanModelRegistry cache misses'
)

argoprofile_cache_size = Gauge(
    'argoprofile_cache_size',
    'Number of Argo profiles cached in InSituStore'
)

argoprofile_cache_hits = Counter(
    'argoprofile_cache_hits_total',
    'Total InSituStore cache hits'
)

argoprofile_cache_misses = Counter(
    'argoprofile_cache_misses_total',
    'Total InSituStore cache misses'
)

# Data processing metrics
volume_extraction_duration = Histogram(
    'volume_extraction_duration_seconds',
    'Time taken to extract 3D volume buffer',
    ['variable']
)

profile_parsing_duration = Histogram(
    'profile_parsing_duration_seconds',
    'Time taken to parse Argo profile from NetCDF'
)

validation_duration = Histogram(
    'model_validation_duration_seconds',
    'Time taken to validate model vs observations',
    ['variable']
)

# Error metrics
parsing_errors_total = Counter(
    'parsing_errors_total',
    'Total parsing errors',
    ['error_type', 'source']
)

interpolation_errors_total = Counter(
    'interpolation_errors_total',
    'Total interpolation errors',
    ['error_type']
)

# System info
system_info = Info(
    'system_info',
    'System information'
)

def update_system_info(version: str, datasets_dir: str):
    """Update system information metrics."""
    system_info.info({
        'version': version,
        'datasets_dir': datasets_dir
    })

def get_instrumentator() -> Instrumentator:
    """Get configured Prometheus instrumentator for FastAPI."""
    instrumentator = Instrumentator()
    return instrumentator
