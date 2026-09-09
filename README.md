# INCOIS 3D Ocean Data Visualization Platform

A web-based, browser-native 3D Ocean Data Visualization System integrating numerical ocean model outputs and in-situ observations (Argo profiling floats, underwater gliders, CTDs, BGC sensors) across the Indian Ocean and Exclusive Economic Zone (EEZ).

Developed for Ministry of Earth Sciences (MoES) — INCOIS Ocean Valley.

---

## Architecture Overview

- **Frontend**: React 18 + Vite + TypeScript + CesiumJS (Resium) + TailwindCSS + Zustand + Recharts
- **API Gateway**: Node.js + Express + TypeScript + WebSockets
- **Data Service**: Python 3.11 + FastAPI + xarray + netCDF4 + argopy + Celery
- **Data & Storage**: PostgreSQL 15 + PostGIS + TimescaleDB, MinIO (S3-compatible), Redis 7
- **Orchestration**: Docker Compose

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical specifications and data layouts.

---

## Quick Start with Docker

1. Clone or navigate to the repository:
   ```bash
   cp .env.example .env
   ```

2. Start the entire platform stack:
   ```bash
   docker compose up --build
   ```

3. Access the services:
   - **Frontend UI (3D Globe)**: [http://localhost:3001](http://localhost:3001) (or 3000 if using FRONTEND_PORT=3000)
   - **API Gateway**: [http://localhost:4000](http://localhost:4000)
   - **Data Service (FastAPI docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **MinIO Console**: [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`)

---

## Local Development (Without Docker)

You can launch the entire local development stack simultaneously using the provided startup script:

```bash
chmod +x start_dev.sh
./start_dev.sh
```

This will automatically start the **Data Service** (Port 8000), **API Gateway** (Port 4000), and **Frontend** (Port 3000).

### Manual Startup Alternative

If you prefer to run the services individually in separate terminals:

**1. API Gateway**
```bash
cd gateway
npm install
npm run dev
```

**2. Python Data Service**
```bash
cd data-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**3. Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## Documentation

- [Master Build Plan](docs/INCOIS_Ocean_3D_Viz_Master_Build_Plan.md)
- [Problem Statement](docs/PROBLEM_STATEMENT.md)
- [System Architecture](ARCHITECTURE.md)
