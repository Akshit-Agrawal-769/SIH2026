import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "INCOIS 3D Ocean Data System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ]
    
    DATASETS_DIR: str = os.getenv(
        "DATASETS_DIR", 
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../datasets"))
    )

    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()
