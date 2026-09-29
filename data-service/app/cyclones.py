"""
Historical tropical-cyclone landfalls from IBTrACS v04r01 (NOAA NCEI), read from
ext_products/ibtracs_tracks.json in the dataset repo (local datasets/ copy, else Hugging Face).
Every named storm with a recorded landfall is served; none is selected by hand.
"""
from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any, Dict, List, Optional

from app import model_store as ms

log = logging.getLogger("cyclones")

TRACKS_FILE = "ext_products/ibtracs_tracks.json"
RETRY_AFTER_S = 300

_lock = threading.Lock()
_state: Dict[str, Any] = {"doc": None, "error": None, "failed_at": 0.0}


def _fmt_latlon(lat: float, lon: float) -> str:
    return f"{abs(lat):.2f}°{'N' if lat >= 0 else 'S'}, {abs(lon):.2f}°{'E' if lon >= 0 else 'W'}"


def _kt(v: Optional[float]) -> Optional[str]:
    return f"{v:.0f} kt" if v is not None else None


def _records(doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    for s in doc.get("storms", []):
        lf = s.get("landfall")
        if not lf or not s.get("name") or s["name"] == "UNNAMED":
            continue
        parts = [f"landfall wind {_kt(lf.get('wind_kt'))}" if lf.get("wind_kt") is not None else None,
                 f"lifetime peak {_kt(s.get('max_wind_kt'))}" if s.get("max_wind_kt") is not None else None]
        out.append({
            "id": s["sid"],
            "name": s["name"].title(),
            "season": s.get("season"),
            "basin": s.get("basin"),
            "lat": lf["lat"],
            "lon": lf["lon"],
            "date": lf["t"][:10],
            "location": f"Landfall {_fmt_latlon(lf['lat'], lf['lon'])}",
            "intensity": "; ".join(p for p in parts if p) or "wind not reported",
            "landfall_wind_kt": lf.get("wind_kt"),
            "max_wind_kt": s.get("max_wind_kt"),
        })
    out.sort(key=lambda r: r["date"])
    return out


def landfalls() -> Dict[str, Any]:
    with _lock:
        if _state["doc"] is not None:
            return _state["doc"]
        if _state["error"] and time.time() - _state["failed_at"] < RETRY_AFTER_S:
            return {"available": False, "reason": _state["error"], "cyclones": []}
    try:
        raw = json.loads(ms.repo_file_bytes(TRACKS_FILE))
    except Exception as exc:
        msg = f"{TRACKS_FILE} unavailable: {exc}"
        log.warning(msg)
        with _lock:
            _state.update(error=msg, failed_at=time.time())
        return {"available": False, "reason": msg, "cyclones": []}
    doc = {
        "available": True,
        "source": raw.get("source"),
        "filter": raw.get("filter"),
        "wind_note": raw.get("wind_note"),
        "generated_at": raw.get("generated_at"),
        "cyclones": _records(raw),
    }
    del raw  # the full tracks (~6.5 MB) are not kept in memory
    with _lock:
        _state.update(doc=doc, error=None)
    return doc
