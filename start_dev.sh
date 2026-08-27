#!/bin/bash
# INCOIS 3D Ocean Data Visualization Platform Startup Script (SIH 2026 PS 26067)
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================================"
echo "  INCOIS 3D OCEAN DATA VISUALIZATION SYSTEM (PS 26067)  "
echo "========================================================"

# Auto-cleanup any stale instances before starting
fuser -k 8000/tcp 3000/tcp 3001/tcp 5173/tcp 2>/dev/null || true
sleep 0.5

# Trap SIGINT and SIGTERM to kill all background services gracefully
cleanup() {
    echo ""
    echo "Shutting down backend and frontend services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "[1/2] Starting Scientific Backend on http://localhost:8000..."
cd "$ROOT_DIR/backend"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Brief pause for backend startup
sleep 1.5

echo "[2/2] Starting WebGL Frontend on http://localhost:3000..."
cd "$ROOT_DIR/frontend"
npm run dev &

WSL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "--------------------------------------------------------"
echo "  ✓ Platform is running!"
echo "  • Primary Web UI: http://localhost:3000"
echo "  • IPv6 Direct:   http://[::1]:3000"
echo "  • WSL Host IP:   http://${WSL_IP}:3000"
echo "  • Backend API:   http://localhost:8000/api/v1/health"
echo "  • API Docs:      http://localhost:8000/docs"
echo "--------------------------------------------------------"
echo "Press CTRL+C to stop both backend and frontend together."
echo ""

wait
