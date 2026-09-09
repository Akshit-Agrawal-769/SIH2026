import io
import re
import numpy as np
from PIL import Image
from typing import Optional
from fastapi import APIRouter, Request, Response, HTTPException, Query
from scipy.interpolate import RegularGridInterpolator

from app.processing.voxelize import (
    get_grid_coordinates,
    generate_synthetic_ocean_field,
    STANDARD_DEPTH_LEVELS,
    LON_MIN, LON_MAX, LAT_MIN, LAT_MAX,
    GRID_WIDTH, GRID_HEIGHT,
    compute_land_mask, point_in_polygon, LAND_POLYGONS
)
from app.processing.pack_texture import download_tile_from_minio

router = APIRouter(tags=["wms"])

# Colormap LUT Implementations
def colormap_turbo(x: np.ndarray) -> np.ndarray:
    """Turbo colormap polynomial approximation (0.0 - 1.0 -> RGB uint8)."""
    t = np.clip(x, 0.0, 1.0)
    r = 0.1357 + t * (4.61539 + t * (-42.6603 + t * (132.131 + t * (-152.942 + t * 59.2864))))
    g = 0.0914 + t * (2.19419 + t * (4.84297 + t * (-14.1850 + t * (4.27730 + t * 2.82956))))
    b = 0.1067 + t * (12.5925 + t * (-60.1897 + t * (109.075 + t * (-88.5067 + t * 26.8183))))
    rgb = np.stack([np.clip(r, 0, 1), np.clip(g, 0, 1), np.clip(b, 0, 1)], axis=-1)
    return (rgb * 255).astype(np.uint8)

def colormap_viridis(x: np.ndarray) -> np.ndarray:
    """Perceptually uniform Viridis colormap approximation."""
    t = np.clip(x, 0.0, 1.0)
    r = np.clip(-0.16 + 1.25 * t - 0.1 * t**2, 0.0, 1.0)
    g = np.clip(0.01 + 0.95 * t + 0.04 * t**2, 0.0, 1.0)
    b = np.clip(0.33 + 0.9 * t - 1.15 * t**2, 0.0, 1.0)
    rgb = np.stack([r, g, b], axis=-1)
    return (rgb * 255).astype(np.uint8)

def colormap_chlorophyll(x: np.ndarray) -> np.ndarray:
    """Biogeochemical Chlorophyll palette: Navy -> Cyan -> Emerald -> Yellow."""
    t = np.clip(x, 0.0, 1.0)
    r = np.clip(0.06 + 0.15 * t + 0.79 * (t**3), 0.0, 1.0)
    g = np.clip(0.10 + 1.10 * t - 0.25 * (t**2), 0.0, 1.0)
    b = np.clip(0.20 + 0.60 * (1.0 - t)**2, 0.0, 1.0)
    rgb = np.stack([r, g, b], axis=-1)
    return (rgb * 255).astype(np.uint8)

LAYER_METADATA = {
    "temperature": {
        "title": "Ocean Potential Temperature",
        "abstract": "3D numerical simulation of Indian Ocean potential temperature (°C).",
        "units": "degC",
        "min": 20.0,
        "max": 32.0,
        "colormap": colormap_turbo
    },
    "salinity": {
        "title": "Ocean Practical Salinity",
        "abstract": "3D numerical simulation of Indian Ocean practical salinity (PSU).",
        "units": "PSU",
        "min": 29.5,
        "max": 37.5,
        "colormap": colormap_viridis
    },
    "currents": {
        "title": "Ocean Current Velocity",
        "abstract": "Indian Ocean horizontal circulation current speed magnitude (m/s).",
        "units": "m/s",
        "min": 0.0,
        "max": 2.2,
        "colormap": colormap_turbo
    },
    "chlorophyll": {
        "title": "Chlorophyll-a Concentration",
        "abstract": "Photic zone Chlorophyll-a biomass concentration (mg/m³).",
        "units": "mg/m3",
        "min": 0.05,
        "max": 10.0,
        "colormap": colormap_chlorophyll
    }
}

CAPABILITIES_XML = """<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/wms http://schemas.opengis.net/wms/1.3.0/capabilities_1_3_0.xsd">
  <Service>
    <Name>WMS</Name>
    <Title>INCOIS 3D Ocean Data Web Map Service</Title>
    <Abstract>OGC WMS 1.3.0 compliant Web Map Service serving numerical oceanographic model simulation fields for the Indian Ocean basin and EEZ.</Abstract>
    <KeywordList>
      <Keyword>oceanography</Keyword>
      <Keyword>INCOIS</Keyword>
      <Keyword>temperature</Keyword>
      <Keyword>salinity</Keyword>
      <Keyword>currents</Keyword>
      <Keyword>chlorophyll</Keyword>
      <Keyword>Indian Ocean</Keyword>
    </KeywordList>
    <OnlineResource xlink:type="simple" xlink:href="http://localhost:4000/api/wms"/>
    <ContactInformation>
      <ContactPersonPrimary>
        <ContactPerson>INCOIS Data Operations</ContactPerson>
        <ContactOrganization>Indian National Centre for Ocean Information Services (INCOIS)</ContactOrganization>
      </ContactPersonPrimary>
      <ContactPosition>Ocean Data Scientist</ContactPosition>
      <ContactAddress>
        <AddressType>postal</AddressType>
        <Address>Ocean Valley, Pragathi Nagar (BO), Nizampet (SO)</Address>
        <City>Hyderabad</City>
        <StateOrProvince>Telangana</StateOrProvince>
        <PostCode>500090</PostCode>
        <Country>India</Country>
      </ContactAddress>
      <ContactElectronicMailAddress>ocean.data@incois.gov.in</ContactElectronicMailAddress>
    </ContactInformation>
    <Fees>NONE</Fees>
    <AccessConstraints>NONE. Public Scientific Data.</AccessConstraints>
  </Service>
  <Capability>
    <Request>
      <GetCapabilities>
        <Format>text/xml</Format>
        <DCPType>
          <HTTP>
            <Get><OnlineResource xlink:type="simple" xlink:href="http://localhost:4000/api/wms"/></Get>
          </HTTP>
        </DCPType>
      </GetCapabilities>
      <GetMap>
        <Format>image/png</Format>
        <Format>image/jpeg</Format>
        <DCPType>
          <HTTP>
            <Get><OnlineResource xlink:type="simple" xlink:href="http://localhost:4000/api/wms"/></Get>
          </HTTP>
        </DCPType>
      </GetMap>
    </Request>
    <Exception>
      <Format>XML</Format>
      <Format>INIMAGE</Format>
      <Format>BLANK</Format>
    </Exception>
    <Layer>
      <Title>INCOIS Ocean Model Layers</Title>
      <CRS>EPSG:4326</CRS>
      <CRS>CRS:84</CRS>
      <CRS>EPSG:3857</CRS>
      <EX_GeographicBoundingBox>
        <westBoundLongitude>45.0</westBoundLongitude>
        <eastBoundLongitude>100.0</eastBoundLongitude>
        <southBoundLatitude>-15.0</southBoundLatitude>
        <northBoundLatitude>30.0</northBoundLatitude>
      </EX_GeographicBoundingBox>
      <BoundingBox CRS="EPSG:4326" minx="-15.0" miny="45.0" maxx="30.0" maxy="100.0"/>
      <BoundingBox CRS="CRS:84" minx="45.0" miny="-15.0" maxx="100.0" maxy="30.0"/>

      <!-- Layer: Temperature -->
      <Layer queryable="1">
        <Name>temperature</Name>
        <Title>Ocean Potential Temperature</Title>
        <Abstract>3D numerical model potential temperature field (°C) across the Indian Ocean basin.</Abstract>
        <Dimension name="time" default="2024-06-01" units="ISO8601">2024-06-01/2024-06-14/P1D</Dimension>
        <Dimension name="elevation" default="0.5" units="meters">0.5,5.0,15.0,30.0,50.0,75.0,100.0,125.0,150.0,200.0,250.0,300.0,400.0,500.0,600.0,800.0,1000.0,1250.0,1500.0,2000.0</Dimension>
        <Style>
          <Name>default</Name>
          <Title>Turbo Colormap</Title>
        </Style>
      </Layer>

      <!-- Layer: Salinity -->
      <Layer queryable="1">
        <Name>salinity</Name>
        <Title>Ocean Practical Salinity</Title>
        <Abstract>3D numerical model practical salinity field (PSU).</Abstract>
        <Dimension name="time" default="2024-06-01" units="ISO8601">2024-06-01/2024-06-14/P1D</Dimension>
        <Dimension name="elevation" default="0.5" units="meters">0.5,5.0,15.0,30.0,50.0,75.0,100.0,125.0,150.0,200.0,250.0,300.0,400.0,500.0,600.0,800.0,1000.0,1250.0,1500.0,2000.0</Dimension>
        <Style>
          <Name>default</Name>
          <Title>Viridis Colormap</Title>
        </Style>
      </Layer>

      <!-- Layer: Currents -->
      <Layer queryable="1">
        <Name>currents</Name>
        <Title>Ocean Current Velocity</Title>
        <Abstract>Ocean hydrodynamic horizontal current velocity magnitude (m/s).</Abstract>
        <Dimension name="time" default="2024-06-01" units="ISO8601">2024-06-01/2024-06-14/P1D</Dimension>
        <Dimension name="elevation" default="0.5" units="meters">0.5,5.0,15.0,30.0,50.0,75.0,100.0,125.0,150.0,200.0,250.0,300.0,400.0,500.0,600.0,800.0,1000.0,1250.0,1500.0,2000.0</Dimension>
        <Style>
          <Name>default</Name>
          <Title>Turbo Speed Palette</Title>
        </Style>
      </Layer>

      <!-- Layer: Chlorophyll -->
      <Layer queryable="1">
        <Name>chlorophyll</Name>
        <Title>Chlorophyll-a Concentration</Title>
        <Abstract>Photic zone biological chlorophyll-a phytoplankton biomass (mg/m³).</Abstract>
        <Dimension name="time" default="2024-06-01" units="ISO8601">2024-06-01/2024-06-14/P1D</Dimension>
        <Dimension name="elevation" default="0.5" units="meters">0.5,5.0,15.0,30.0,50.0,75.0,100.0,125.0,150.0,200.0,250.0,300.0,400.0,500.0,600.0,800.0,1000.0,1250.0,1500.0,2000.0</Dimension>
        <Style>
          <Name>default</Name>
          <Title>Chlorophyll Palette</Title>
        </Style>
      </Layer>
    </Layer>
  </Capability>
</WMS_Capabilities>"""

@router.get("/wms")
def handle_wms(
    request: Request,
    service: Optional[str] = Query(None, alias="SERVICE"),
    req_type: Optional[str] = Query(None, alias="REQUEST"),
    layers: Optional[str] = Query(None, alias="LAYERS"),
    layer: Optional[str] = Query(None, alias="LAYER"),
    bbox: Optional[str] = Query(None, alias="BBOX"),
    width: int = Query(512, alias="WIDTH"),
    height: int = Query(512, alias="HEIGHT"),
    crs: Optional[str] = Query(None, alias="CRS"),
    srs: Optional[str] = Query(None, alias="SRS"),
    format: str = Query("image/png", alias="FORMAT"),
    time: str = Query("2024-06-01", alias="TIME"),
    elevation: Optional[float] = Query(None, alias="ELEVATION"),
    depth: Optional[float] = Query(0.5, alias="DEPTH"),
    transparent: str = Query("TRUE", alias="TRANSPARENT"),
    styles: Optional[str] = Query(None, alias="STYLES")
):
    """
    OGC Web Map Service (WMS) 1.3.0 / 1.1.1 Gateway Endpoint.
    Supports GetCapabilities and GetMap requests.
    """
    req = (req_type or "").upper()

    if req == "GETCAPABILITIES" or not req:
        return Response(content=CAPABILITIES_XML, media_type="text/xml; charset=utf-8")

    if req == "GETMAP":
        target_layer = layers or layer or "temperature"
        target_layer = target_layer.split(",")[-1].strip().lower()
        if target_layer not in LAYER_METADATA:
            target_layer = "temperature"

        meta = LAYER_METADATA[target_layer]
        req_depth = elevation if elevation is not None else (depth if depth is not None else 0.5)

        # 1. Parse Bounding Box
        if not bbox:
            min_lon, max_lon = LON_MIN, LON_MAX
            min_lat, max_lat = LAT_MIN, LAT_MAX
        else:
            parts = [float(p.strip()) for p in bbox.split(",")]
            if len(parts) != 4:
                raise HTTPException(status_code=400, detail="Invalid BBOX parameter")
            
            coord_sys = (crs or srs or "CRS:84").upper()
            if "EPSG:4326" in coord_sys and parts[0] < parts[2] and parts[0] >= -90 and parts[2] <= 90:
                min_lat, min_lon, max_lat, max_lon = parts[0], parts[1], parts[2], parts[3]
            else:
                min_lon, min_lat, max_lon, max_lat = parts[0], parts[1], parts[2], parts[3]

        width = max(32, min(width, 2048))
        height = max(32, min(height, 2048))

        # 2. Retrieve data slice
        tile_bytes = download_tile_from_minio(target_layer, time, req_depth)
        if tile_bytes and len(tile_bytes) >= 32 + (GRID_WIDTH * GRID_HEIGHT * 4):
            slice_data = np.frombuffer(tile_bytes[32:], dtype=np.float32).reshape((GRID_HEIGHT, GRID_WIDTH))
        else:
            vol, _, _ = generate_synthetic_ocean_field(target_layer, date_str=time)
            depth_idx = 0
            if req_depth in STANDARD_DEPTH_LEVELS:
                depth_idx = STANDARD_DEPTH_LEVELS.index(req_depth)
            else:
                diffs = [abs(d - req_depth) for d in STANDARD_DEPTH_LEVELS]
                depth_idx = diffs.index(min(diffs))
            slice_data = vol[:, :, depth_idx]

        # 3. Resample onto requested WMS raster bounds
        src_lats = np.linspace(LAT_MIN, LAT_MAX, GRID_HEIGHT)
        src_lons = np.linspace(LON_MIN, LON_MAX, GRID_WIDTH)

        interpolator = RegularGridInterpolator(
            (src_lats, src_lons),
            slice_data,
            bounds_error=False,
            fill_value=np.nan
        )

        tgt_lats = np.linspace(max_lat, min_lat, height)
        tgt_lons = np.linspace(min_lon, max_lon, width)
        grid_lat, grid_lon = np.meshgrid(tgt_lats, tgt_lons, indexing='ij')

        resampled = interpolator((grid_lat, grid_lon))

        # 4. Colorize and apply land / NaN transparency
        val_min = meta["min"]
        val_max = meta["max"]
        normalized = (resampled - val_min) / (val_max - val_min)

        rgb = meta["colormap"](normalized)
        alpha = np.ones((height, width), dtype=np.uint8) * 255

        # Nan mask
        nan_mask = np.isnan(resampled)
        alpha[nan_mask] = 0

        # Land mask
        for i in range(height):
            for j in range(width):
                if alpha[i, j] > 0:
                    lon_val = tgt_lons[j]
                    lat_val = tgt_lats[i]
                    if any(point_in_polygon(lon_val, lat_val, poly) for poly in LAND_POLYGONS):
                        alpha[i, j] = 0

        if transparent.upper() == "TRUE":
            rgba = np.dstack([rgb, alpha])
            img = Image.fromarray(rgba, mode="RGBA")
        else:
            bg = np.array([10, 15, 30], dtype=np.uint8)
            composite = np.where(alpha[:, :, None] == 255, rgb, bg)
            img = Image.fromarray(composite, mode="RGB")

        buf = io.BytesIO()
        img_format = "PNG" if "png" in format.lower() else "JPEG"
        img.save(buf, format=img_format, quality=90)
        png_bytes = buf.getvalue()

        return Response(
            content=png_bytes,
            media_type=f"image/{img_format.lower()}",
            headers={
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
                "X-OGC-WMS-Version": "1.3.0",
                "X-Layer": target_layer
            }
        )

    raise HTTPException(status_code=400, detail=f"Unsupported WMS REQUEST '{req}'")
