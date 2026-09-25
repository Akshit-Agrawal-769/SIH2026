import os
import secrets

from fastapi import Header, HTTPException


def require_admin_token(x_admin_token: str = Header(default="")) -> None:
    """
    Guard for mutating endpoints (ingestion). Scientific read endpoints are public.
    Disabled unless ADMIN_API_TOKEN is configured; never falls back to a default.
    """
    expected = os.getenv("ADMIN_API_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=403, detail="Mutating endpoints are disabled (ADMIN_API_TOKEN not configured).")
    if not x_admin_token or not secrets.compare_digest(x_admin_token, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")
