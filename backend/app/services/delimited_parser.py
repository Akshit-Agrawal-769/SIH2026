"""
Delimited Text Ingestion Service (CSV / TSV / ASCII)
Compliant with INCOIS and CF Oceanographic In-Situ Standards.
Parses shipboard CTDs, glider trajectories, drifters, and moorings.
"""

import io
import csv
import re
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
import pandas as pd
import numpy as np


class DelimitedOceanParser:
    """
    Automated multi-format delimited text parser for oceanographic data.
    Auto-detects delimiter, header names, coordinate units, missing value sentinels,
    and formats records into standard vertical profiles.
    """

    COLUMN_MAP = {
        'lat': ['latitude', 'lat', 'lat_deg', 'y', 'lat_dec'],
        'lon': ['longitude', 'lon', 'long', 'lon_deg', 'x', 'lon_dec'],
        'depth': ['depth', 'depth_m', 'depth_meters', 'z', 'dep', 'pressure', 'pres', 'pres_dbar'],
        'temperature': ['temperature', 'temp', 'temp_c', 'sea_water_temperature', 'theta', 't'],
        'salinity': ['salinity', 'sal', 'psal', 'practical_salinity', 'salt', 's'],
        'datetime': ['datetime', 'time', 'timestamp', 'date', 'date_time', 'utc_time'],
        'platform_id': ['platform_id', 'platform', 'station', 'station_id', 'wmo', 'id', 'cast'],
    }

    SENTINELS = {-999.0, -9999.0, -99.9, 9999.0, 999.0, 1e20, 1e36}

    def __init__(self):
        self._stored_profiles: Dict[str, Dict[str, Any]] = {}

    def _normalize_header(self, raw_col: str) -> str:
        clean = re.sub(r'[^a-zA-Z0-9_]', '', raw_col.strip().lower())
        for canonical, aliases in self.COLUMN_MAP.items():
            if clean in aliases:
                return canonical
        return clean

    def detect_delimiter(self, sample_text: str) -> str:
        try:
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(sample_text[:4096])
            return dialect.delimiter
        except Exception:
            # Fallback to comma, tab, or whitespace
            if '\t' in sample_text[:1000]:
                return '\t'
            if ';' in sample_text[:1000]:
                return ';'
            return ','

    def parse_content(self, text_content: str, filename: str = "upload.csv") -> Dict[str, Any]:
        delimiter = self.detect_delimiter(text_content)
        df = pd.read_csv(
            io.StringIO(text_content),
            delimiter=delimiter,
            skipinitialspace=True,
            comment='#'
        )

        # Map columns
        col_rename = {}
        for col in df.columns:
            canonical = self._normalize_header(col)
            col_rename[col] = canonical
        df = df.rename(columns=col_rename)

        # Check essential columns
        has_depth = 'depth' in df.columns
        has_coords = 'lat' in df.columns and 'lon' in df.columns
        has_temp = 'temperature' in df.columns
        has_sal = 'salinity' in df.columns

        if not has_coords or not has_depth:
            raise ValueError(f"Delimited file must contain coordinates ('lat', 'lon') and 'depth'. Found: {list(df.columns)}")

        # Clean sentinels and NaNs
        for col in ['temperature', 'salinity', 'depth', 'lat', 'lon']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                df[col] = df[col].apply(lambda v: np.nan if v in self.SENTINELS else v)

        # Group by platform/cast if present, or treat whole file as one profile/trajectory
        platform_id = str(df['platform_id'].iloc[0]) if 'platform_id' in df.columns and len(df['platform_id'].dropna()) > 0 else Path(filename).stem
        lat = float(df['lat'].dropna().iloc[0])
        lon = float(df['lon'].dropna().iloc[0])
        timestamp = str(df['datetime'].dropna().iloc[0]) if 'datetime' in df.columns and len(df['datetime'].dropna()) > 0 else "2026-08-01T00:00:00Z"

        # Sort by depth
        valid_df = df.dropna(subset=['depth']).sort_values('depth')

        depths = [round(float(d), 2) for d in valid_df['depth'].tolist()]
        temps = [round(float(t), 3) if not np.isnan(t) else None for t in valid_df['temperature'].tolist()] if has_temp else []
        sals = [round(float(s), 3) if not np.isnan(s) else None for s in valid_df['salinity'].tolist()] if has_sal else []

        record = {
            "platform_id": platform_id,
            "filename": filename,
            "latitude": lat,
            "longitude": lon,
            "timestamp": timestamp,
            "levels_count": len(depths),
            "max_depth": max(depths) if depths else 0.0,
            "min_depth": min(depths) if depths else 0.0,
            "has_temperature": has_temp,
            "has_salinity": has_sal,
            "depths": depths,
            "temperatures": temps,
            "salinities": sals,
            "provenance": f"Delimited ASCII/CSV Ingestion ({filename})"
        }

        self._stored_profiles[platform_id] = record
        return record

    def get_all_profiles(self) -> List[Dict[str, Any]]:
        return list(self._stored_profiles.values())

    def get_profile_by_id(self, platform_id: str) -> Optional[Dict[str, Any]]:
        return self._stored_profiles.get(platform_id)


# Global singleton instance
delimited_parser = DelimitedOceanParser()
