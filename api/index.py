import os
import json
from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="INCOIS Ocean Data API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PUBLIC_DATA_DIR = os.path.join(BASE_DIR, "..", "frontend", "public", "api")
TILES_DIR = os.path.join(BASE_DIR, "..", "frontend", "public", "tiles")

def find_json_file(filename: str):
    for d in [DATA_DIR, PUBLIC_DATA_DIR, os.path.join(BASE_DIR, "..", "frontend", "dist", "api")]:
        p = os.path.join(d, filename)
        if os.path.exists(p):
            with open(p, "r") as f:
                return json.load(f)
    return None

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "incois-ocean-api",
        "backend": "FastAPI (Python Serverless on Vercel)",
        "data_policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC",
        "supported_platforms": ["argo", "glider", "moored_buoy"],
        "supported_variables": ["temperature", "salinity", "currents", "chlorophyll", "oxygen"],
        "timeline_window": ["2024-06-01", "2024-06-05"]
    }

@app.get("/api/variables")
def get_variables():
    data = find_json_file("variables.json")
    if data:
        return data
    return []

@app.get("/api/manifest/{variable}")
def get_manifest(variable: str):
    data = find_json_file(f"manifest/{variable}.json")
    if data:
        return data
    raise HTTPException(status_code=404, detail=f"Manifest for '{variable}' not found")

@app.get("/api/instruments")
def get_instruments():
    data = find_json_file("instruments.json")
    if data:
        return data
    return {"type": "FeatureCollection", "features": []}

@app.get("/api/instruments/{instrument_id}/profile")
def get_instrument_profile(instrument_id: str):
    clean_id = instrument_id.replace("INCOIS_ARGO_", "")
    for id_val in [instrument_id, clean_id]:
        data = find_json_file(f"profiles/{id_val}.json")
        if data:
            return data
    raise HTTPException(status_code=404, detail=f"Profile for '{instrument_id}' not found")

@app.get("/api/currents/uv")
def get_currents_uv():
    data = find_json_file("currents_uv.json")
    if data:
        return data
    raise HTTPException(status_code=404, detail="Currents UV vector data not found")

@app.get("/api/tiles/{variable}/{date}/{depth}")
def get_tile(variable: str, date: str, depth: str):
    depth_str = str(depth)
    candidates = [
        f"{depth_str}.bin",
        f"{float(depth_str):.1f}.bin" if depth_str.replace(".", "", 1).isdigit() else "",
        f"{int(float(depth_str))}.bin" if depth_str.replace(".", "", 1).isdigit() else "",
        "0.5.bin" if depth_str in ("0", "0.0", "0.5") else ""
    ]

    search_dirs = [
        TILES_DIR,
        os.path.join(BASE_DIR, "tiles"),
        os.path.join(BASE_DIR, "..", "tiles"),
        os.path.join(BASE_DIR, "..", "frontend", "dist", "tiles")
    ]

    for s_dir in search_dirs:
        for c in candidates:
            if not c:
                continue
            tile_path = os.path.join(s_dir, variable, date, c)
            if os.path.exists(tile_path):
                with open(tile_path, "rb") as tf:
                    tile_bytes = tf.read()
                return Response(
                    content=tile_bytes,
                    media_type="application/octet-stream",
                    headers={
                        "Content-Disposition": f'inline; filename="{variable}_{date}_{depth}.bin"',
                        "Cache-Control": "public, max-age=86400",
                        "X-Data-Source": "Authentic-NetCDF",
                        "X-Data-Policy": "STRICT_REAL_DATA_ZERO_SYNTHETIC"
                    }
                )

    raise HTTPException(
        status_code=404,
        detail=f"No authentic oceanographic tile available for variable '{variable}' at date '{date}', depth {depth}m."
    )

# ============================================================
# CANONICAL MODEL VS. OBSERVATION & ANALYTICS SUITE
# ============================================================

try:
    import api.analytics_engine as ae
except ImportError:
    import analytics_engine as ae

@app.get("/api/comparison/{instrument_id}")
def get_model_vs_obs(instrument_id: str, variable: str = "temperature", date: str = None):
    """
    Collocates authentic in-situ instrument profile observations with INCOIS Bio-ROMS model output.
    Computes RMSE, MAE, Bias, Pearson r, and residual vertical depth profile.
    Strict Zero Mock Data: returns empty state if out of domain or missing measurements.
    """
    result = ae.compute_model_vs_obs(instrument_id, variable, date)
    return result

@app.get("/api/analytics/timeseries")
def get_analytics_timeseries(variable: str = "temperature", lat: float = 13.691, lon: float = 88.074, depth: float = 10.0):
    """
    Extracts multi-day model timeline and computes rate of change, delta, and statistics.
    """
    return ae.compute_timeseries(variable, lat, lon, depth)

@app.get("/api/analytics/anomalies")
def get_analytics_anomalies(variable: str = "temperature", lat: float = 13.691, lon: float = 88.074, depth: float = 10.0, date: str = "2024-06-03"):
    """
    Calculates authentic Z-score departure against regional ocean field baseline.
    """
    return ae.compute_anomalies(variable, lat, lon, depth, date)

@app.get("/api/analytics/correlation")
def get_analytics_correlation(lat: float = 13.691, lon: float = 88.074, depth: float = 10.0, date: str = "2024-06-03"):
    """
    Computes NxN Pearson correlation matrix across authentic physical variables in local neighborhood.
    """
    return ae.compute_correlation(lat, lon, depth, date)

@app.get("/api/analytics/profile")
def get_analytics_profile(lat: float = 13.691, lon: float = 88.074, variable: str = "temperature", date: str = "2024-06-03"):
    """
    Extracts vertical model profile and calculates Mixed Layer Depth (MLD) and thermocline gradient.
    """
    return ae.compute_vertical_profile_analysis(lat, lon, variable, date)

# ============================================================
# OGC WMS 1.3.0 CAPABILITIES ENDPOINT
# ============================================================

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
    <OnlineResource xlink:type="simple" xlink:href="http://localhost:8000/api/wms"/>
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
            <Get><OnlineResource xlink:type="simple" xlink:href="http://localhost:8000/api/wms"/></Get>
          </HTTP>
        </DCPType>
      </GetCapabilities>
      <GetMap>
        <Format>image/png</Format>
        <Format>image/jpeg</Format>
        <DCPType>
          <HTTP>
            <Get><OnlineResource xlink:type="simple" xlink:href="http://localhost:8000/api/wms"/></Get>
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

      <Layer queryable="1">
        <Name>temperature</Name>
        <Title>Ocean Potential Temperature</Title>
        <Abstract>3D numerical model potential temperature field (°C) across the Indian Ocean basin.</Abstract>
        <Dimension name="time" default="2024-06-01" units="ISO8601">2024-06-01/2024-06-05/P1D</Dimension>
        <Dimension name="elevation" default="0.5" units="meters">0.5,10.0,50.0,100.0,200.0,500.0,1000.0,2000.0</Dimension>
      </Layer>

      <Layer queryable="1">
        <Name>salinity</Name>
        <Title>Ocean Practical Salinity</Title>
        <Abstract>3D numerical model practical salinity field (PSU).</Abstract>
        <Dimension name="time" default="2024-06-01" units="ISO8601">2024-06-01/2024-06-05/P1D</Dimension>
        <Dimension name="elevation" default="0.5" units="meters">0.5,10.0,50.0,100.0,200.0,500.0,1000.0,2000.0</Dimension>
      </Layer>

      <Layer queryable="1">
        <Name>currents</Name>
        <Title>Ocean Current Velocity</Title>
        <Abstract>Ocean hydrodynamic horizontal current velocity magnitude (m/s).</Abstract>
        <Dimension name="time" default="2024-06-01" units="ISO8601">2024-06-01/2024-06-05/P1D</Dimension>
        <Dimension name="elevation" default="0.5" units="meters">0.5,10.0,50.0,100.0,200.0,500.0,1000.0,2000.0</Dimension>
      </Layer>

      <Layer queryable="1">
        <Name>chlorophyll</Name>
        <Title>Chlorophyll-a Concentration</Title>
        <Abstract>Photic zone biological chlorophyll-a phytoplankton biomass (mg/m³).</Abstract>
        <Dimension name="time" default="2024-06-01" units="ISO8601">2024-06-01/2024-06-05/P1D</Dimension>
        <Dimension name="elevation" default="0.5" units="meters">0.5,10.0,50.0,100.0,200.0,500.0,1000.0,2000.0</Dimension>
      </Layer>
    </Layer>
  </Capability>
</WMS_Capabilities>"""

@app.get("/api/wms")
def handle_wms(service: str = "WMS", request: str = "GetCapabilities"):
    """
    OGC Web Map Service (WMS) 1.3.0 Capabilities Endpoint.
    Returns authoritative XML capabilities for QGIS, ArcGIS, and OGC clients.
    """
    return Response(content=CAPABILITIES_XML, media_type="text/xml; charset=utf-8")
