import os
from typing import List
from pydantic_settings import BaseSettings

def find_datasets_dir() -> str:
    env_dir = os.getenv("DATASETS_DIR")
    if env_dir and os.path.exists(env_dir):
        return env_dir
    curr = os.path.abspath(os.path.dirname(__file__))
    for _ in range(5):
        candidate = os.path.join(curr, "datasets")
        if os.path.exists(candidate):
            return candidate
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "../../datasets"))

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
    
    DATASETS_DIR: str = find_datasets_dir()

    class Config:
        case_sensitive = True

settings = Settings()
