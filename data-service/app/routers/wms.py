import io
from typing import Optional
from xml.sax.saxutils import escape

import numpy as np
from PIL import Image
from fastapi import APIRouter, Request, Response, HTTPException, Query
from scipy.interpolate import RegularGridInterpolator

from app import analytics_engine as ae

router = APIRouter(tags=["wms"])


def colormap_turbo(x: np.ndarray) -> np.ndarray:
    """Turbo colormap polynomial approximation (0..1 -> RGB uint8)."""
    t = np.clip(x, 0.0, 1.0)
    r = 0.1357 + t * (4.61539 + t * (-42.6603 + t * (132.131 + t * (-152.942 + t * 59.2864))))
    g = 0.0914 + t * (2.19419 + t * (4.84297 + t * (-14.1850 + t * (4.27730 + t * 2.82956))))
    b = 0.1067 + t * (12.5925 + t * (-60.1897 + t * (109.075 + t * (-88.5067 + t * 26.8183))))
    rgb = np.stack([np.clip(r, 0, 1), np.clip(g, 0, 1), np.clip(b, 0, 1)], axis=-1)
    return (rgb * 255).astype(np.uint8)


def colormap_viridis(x: np.ndarray) -> np.ndarray:
    t = np.clip(x, 0.0, 1.0)
    r = np.clip(-0.16 + 1.25 * t - 0.1 * t ** 2, 0.0, 1.0)
    g = np.clip(0.01 + 0.95 * t + 0.04 * t ** 2, 0.0, 1.0)
    b = np.clip(0.33 + 0.9 * t - 1.15 * t ** 2, 0.0, 1.0)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def colormap_chlorophyll(x: np.ndarray) -> np.ndarray:
    t = np.clip(x, 0.0, 1.0)
    r = np.clip(0.06 + 0.15 * t + 0.79 * (t ** 3), 0.0, 1.0)
    g = np.clip(0.10 + 1.10 * t - 0.25 * (t ** 2), 0.0, 1.0)
    b = np.clip(0.20 + 0.60 * (1.0 - t) ** 2, 0.0, 1.0)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


COLORMAPS = {"chlorophyll": colormap_chlorophyll, "salinity": colormap_viridis}
LOG_SCALE = {"chlorophyll"}


def _service_url(request: Request) -> str:
    return str(request.url).split("?")[0]


def _capabilities(request: Request) -> str:
    cat = ae.get_catalog()
    if not cat:
        raise HTTPException(status_code=503, detail="Data catalog missing")
    w, s, e, n = cat["grid"]["bbox"]
    url = escape(_service_url(request))
    layers = []
    for var, meta in cat["variables"].items():
        src = cat["sources"].get(meta["source_id"], {})
        times = ",".join(meta["timesteps"])
        depths = ",".join(ae.depth_key(d) for d in meta["depths"])
        layers.append(f"""
      <Layer queryable="0">
        <Name>{escape(var)}</Name>
        <Title>{escape(meta['long_name'])} ({escape(meta['units'])})</Title>
        <Abstract>{escape(src.get('title', ''))}. {escape(meta.get('vertical_coverage') or '')}.</Abstract>
        <Dimension name="time" units="ISO8601" default="{meta['timesteps'][-1]}">{times}</Dimension>
        <Dimension name="elevation" units="m" default="{ae.depth_key(meta['depths'][0])}">{depths}</Dimension>
      </Layer>""")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms" xmlns:xlink="http://www.w3.org/1999/xlink">
  <Service>
    <Name>WMS</Name>
    <Title>INCOIS 3D Ocean Data Web Map Service</Title>
    <Abstract>Gridded fields served from the platform data catalog (INCOIS Bio-ROMS surface fields, CMEMS ARMOR3D surface geostrophic currents).</Abstract>
    <OnlineResource xlink:type="simple" xlink:href="{url}"/>
    <Fees>NONE</Fees>
    <AccessConstraints>Subject to the source data licences listed in the data catalog.</AccessConstraints>
  </Service>
  <Capability>
    <Request>
      <GetCapabilities><Format>text/xml</Format><DCPType><HTTP><Get><OnlineResource xlink:type="simple" xlink:href="{url}"/></Get></HTTP></DCPType></GetCapabilities>
      <GetMap><Format>image/png</Format><Format>image/jpeg</Format><DCPType><HTTP><Get><OnlineResource xlink:type="simple" xlink:href="{url}"/></Get></HTTP></DCPType></GetMap>
    </Request>
    <Exception><Format>XML</Format></Exception>
    <Layer>
      <Title>INCOIS Ocean Layers</Title>
      <CRS>EPSG:4326</CRS>
      <CRS>CRS:84</CRS>
      <EX_GeographicBoundingBox>
        <westBoundLongitude>{w}</westBoundLongitude><eastBoundLongitude>{e}</eastBoundLongitude>
        <southBoundLatitude>{s}</southBoundLatitude><northBoundLatitude>{n}</northBoundLatitude>
      </EX_GeographicBoundingBox>
      <BoundingBox CRS="EPSG:4326" minx="{s}" miny="{w}" maxx="{n}" maxy="{e}"/>
      <BoundingBox CRS="CRS:84" minx="{w}" miny="{s}" maxx="{e}" maxy="{n}"/>{''.join(layers)}
    </Layer>
  </Capability>
</WMS_Capabilities>"""


def parse_bbox(bbox: Optional[str], crs: str, version: str, default):
    """Return (min_lon, min_lat, max_lon, max_lat) honouring WMS axis order rules."""
    if not bbox:
        return default
    try:
        parts = [float(p.strip()) for p in bbox.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid BBOX parameter")
    if len(parts) != 4:
        raise HTTPException(status_code=400, detail="Invalid BBOX parameter")
    if crs == "EPSG:4326" and version.startswith("1.3"):
        min_lat, min_lon, max_lat, max_lon = parts  # WMS 1.3.0: EPSG:4326 is lat/lon order
    else:
        min_lon, min_lat, max_lon, max_lat = parts
    if min_lon >= max_lon or min_lat >= max_lat:
        raise HTTPException(status_code=400, detail="BBOX min must be less than max")
    return min_lon, min_lat, max_lon, max_lat


@router.get("/wms")
def handle_wms(
    request: Request,
    service: Optional[str] = Query(None, alias="SERVICE"),
    version: str = Query("1.3.0", alias="VERSION"),
    req_type: Optional[str] = Query(None, alias="REQUEST"),
    layers: Optional[str] = Query(None, alias="LAYERS"),
    bbox: Optional[str] = Query(None, alias="BBOX"),
    width: int = Query(512, alias="WIDTH"),
    height: int = Query(512, alias="HEIGHT"),
    crs: Optional[str] = Query(None, alias="CRS"),
    srs: Optional[str] = Query(None, alias="SRS"),
    format: str = Query("image/png", alias="FORMAT"),
    time: Optional[str] = Query(None, alias="TIME"),
    elevation: Optional[float] = Query(None, alias="ELEVATION"),
    transparent: str = Query("TRUE", alias="TRANSPARENT"),
    styles: Optional[str] = Query(None, alias="STYLES"),
):
    """OGC WMS GetCapabilities / GetMap over the catalogued tiles."""
    req = (req_type or "").upper()
    if req == "GETCAPABILITIES" or not req:
        return Response(content=_capabilities(request), media_type="text/xml; charset=utf-8")
    if req != "GETMAP":
        raise HTTPException(status_code=400, detail=f"Unsupported WMS REQUEST '{req}'")

    layer = (layers or "").split(",")[-1].strip().lower()
    meta = ae.variable_meta(layer)
    if meta is None:
        raise HTTPException(status_code=400, detail=f"LayerNotDefined: '{layer}'")
    coord_sys = (crs or srs or "CRS:84").upper()
    if coord_sys not in ("EPSG:4326", "CRS:84"):
        raise HTTPException(status_code=400, detail=f"InvalidCRS: '{coord_sys}' (supported: EPSG:4326, CRS:84)")
    d, err = ae.resolve_date(layer, time)
    if err:
        raise HTTPException(status_code=404, detail=err)
    depth = elevation if elevation is not None else meta["depths"][0]
    arr = ae.load_tile(layer, d, depth)
    if arr is None:
        raise HTTPException(status_code=404, detail=f"No '{layer}' data at {d}, depth {depth} m.")

    g = ae.grid()
    min_lon, min_lat, max_lon, max_lat = parse_bbox(bbox, coord_sys, version, tuple(g["bbox"]))
    width = max(16, min(width, 2048))
    height = max(16, min(height, 2048))

    src_lats = g["lat0"] + g["dlat"] * np.arange(g["height"])
    src_lons = g["lon0"] + g["dlon"] * np.arange(g["width"])
    interp = RegularGridInterpolator((src_lats, src_lons), arr, method="nearest", bounds_error=False,
                                     fill_value=np.nan)
    # Pixel centres, row 0 = north.
    tgt_lats = max_lat - (np.arange(height) + 0.5) * (max_lat - min_lat) / height
    tgt_lons = min_lon + (np.arange(width) + 0.5) * (max_lon - min_lon) / width
    glat, glon = np.meshgrid(tgt_lats, tgt_lons, indexing="ij")
    outside = (glat < g["bbox"][1]) | (glat > g["bbox"][3]) | (glon < g["bbox"][0]) | (glon > g["bbox"][2])
    values = interp((glat, glon))
    values[outside] = np.nan

    lo, hi = meta["display_range"]
    if layer in LOG_SCALE:
        with np.errstate(divide="ignore", invalid="ignore"):
            norm = (np.log10(values) - np.log10(lo)) / (np.log10(hi) - np.log10(lo))
    else:
        norm = (values - lo) / (hi - lo)
    rgb = COLORMAPS.get(layer, colormap_turbo)(np.nan_to_num(norm, nan=0.0))
    alpha = np.where(np.isfinite(values), 255, 0).astype(np.uint8)

    img_format = "PNG" if "png" in format.lower() else "JPEG"
    if img_format == "PNG" and transparent.upper() == "TRUE":
        img = Image.fromarray(np.dstack([rgb, alpha]), mode="RGBA")
    else:
        bg = np.array([12, 12, 12], dtype=np.uint8)
        img = Image.fromarray(np.where(alpha[:, :, None] == 255, rgb, bg).astype(np.uint8), mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format=img_format, quality=90)
    return Response(
        content=buf.getvalue(),
        media_type=f"image/{img_format.lower()}",
        headers={"Cache-Control": "public, max-age=3600", "X-Layer": layer, "X-Time": d,
                 "X-Data-Source": meta["source_id"]},
    )
