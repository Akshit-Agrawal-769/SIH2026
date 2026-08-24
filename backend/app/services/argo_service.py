"""
Argo Profiling Float Service
Loads, indexes, and delivers Argo float trajectories and TEOS-10 calibrated profiles.
"""

import os
import glob
from typing import List, Dict, Any, Optional
from app.core.config import settings
from ingestion.adapters.argo_adapter import ArgoGDACAdapter


class ArgoDataService:

    def __init__(self):
        self.argo_dir = os.path.join(settings.DATASETS_DIR, "argo")

    def list_argo_files(self) -> List[str]:
        if not os.path.exists(self.argo_dir):
            return []
        files = glob.glob(os.path.join(self.argo_dir, "*.nc"))
        return [os.path.basename(f) for f in files]

    def get_floats_summary(self) -> List[Dict[str, Any]]:
        summaries = []
        files = self.list_argo_files()
        for f in files:
            path = os.path.join(self.argo_dir, f)
            try:
                adapter = ArgoGDACAdapter(path)
                profiles = adapter.parse_profiles()
                if not profiles:
                    continue

                latest = profiles[-1]
                trajectory = [
                    {
                        "cycle_number": p["cycle_number"],
                        "latitude": p["latitude"],
                        "longitude": p["longitude"],
                        "timestamp": p["timestamp"],
                        "depth_max": max(p["depths"]) if p["depths"] else None
                    }
                    for p in profiles
                ]

                summaries.append({
                    "platform_number": latest["platform_number"],
                    "filename": f,
                    "profiles_count": len(profiles),
                    "latest_position": {
                        "latitude": latest["latitude"],
                        "longitude": latest["longitude"],
                    },
                    "cycles": [p["cycle_number"] for p in profiles],
                    "trajectory": trajectory,
                })
            except Exception as e:
                print(f"Error reading Argo float {f}: {e}")
                continue

        return summaries

    def get_float_profile(self, platform_number: str, cycle_number: Optional[int] = None) -> Optional[Dict[str, Any]]:
        files = self.list_argo_files()
        for f in files:
            path = os.path.join(self.argo_dir, f)
            try:
                adapter = ArgoGDACAdapter(path)
                profiles = adapter.parse_profiles()
                for p in profiles:
                    if str(p["platform_number"]) == str(platform_number):
                        if cycle_number is None or p["cycle_number"] == cycle_number:
                            return p
            except Exception as e:
                print(f"Error loading profile for {platform_number}: {e}")
                continue
        return None

argo_service = ArgoDataService()
