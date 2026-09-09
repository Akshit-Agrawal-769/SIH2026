from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/variables", tags=["variables"])

VARIABLES_METADATA: List[Dict[str, Any]] = [
    {
        "id": "temperature",
        "name": "Sea Water Temperature",
        "standard_name": "sea_water_potential_temperature",
        "units": "°C",
        "min_value": 0.0,
        "max_value": 34.0,
        "default_palette": "turbo",
        "description": "3D potential temperature field across depth levels",
        "category": "model_field"
    },
    {
        "id": "salinity",
        "name": "Sea Water Salinity",
        "standard_name": "sea_water_practical_salinity",
        "units": "PSU",
        "min_value": 30.0,
        "max_value": 38.0,
        "default_palette": "haline",
        "description": "3D practical salinity field across depth levels",
        "category": "model_field"
    },
    {
        "id": "currents",
        "name": "Ocean Current Velocity",
        "standard_name": "sea_water_velocity",
        "units": "m/s",
        "min_value": 0.0,
        "max_value": 2.5,
        "default_palette": "viridis",
        "description": "Vector field of eastward (u) and northward (v) water velocity",
        "category": "vector_field"
    },
    {
        "id": "chlorophyll",
        "name": "Chlorophyll-a",
        "standard_name": "mass_concentration_of_chlorophyll_a_in_sea_water",
        "units": "mg/m³",
        "min_value": 0.01,
        "max_value": 15.0,
        "default_palette": "algae",
        "description": "Surface and subsurface chlorophyll-a concentration",
        "category": "model_field"
    }
]

@router.get("", response_model=List[Dict[str, Any]])
def get_variables():
    """List all available physical and biogeochemical ocean model variables."""
    return VARIABLES_METADATA
