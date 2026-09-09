#!/bin/bash
# INCOIS 3D Ocean Data Visualization Platform Startup Script (SIH 2026 PS 26067)
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================================"
echo "  INCOIS 3D OCEAN DATA VISUALIZATION SYSTEM (PS 26067)  "
echo "========================================================"

# 1. Kill any existing instances holding ports 8000, 4000, 3000, 3001
fuser -k 8000/tcp 4000/tcp 3000/tcp 3001/tcp 2>/dev/null || true
pkill -9 -f "uvicorn app.main:app" 2>/dev/null || true
pkill -9 -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
sleep 1

# 2. Trap SIGINT and SIGTERM to kill all background services gracefully
cleanup() {
    echo ""
    echo "Shutting down backend, gateway, and frontend services..."
    kill $(jobs -p) 2>/dev/null || true
    fuser -k 8000/tcp 4000/tcp 3000/tcp 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 3. Start Data Service (Python Backend)
if [ -f "$ROOT_DIR/data-service/venv/bin/activate" ]; then
    source "$ROOT_DIR/data-service/venv/bin/activate"
elif [ -f "$ROOT_DIR/venv/bin/activate" ]; then
    source "$ROOT_DIR/venv/bin/activate"
fi
echo "[1/3] Starting Scientific Data Service on http://localhost:8000..."
cd "$ROOT_DIR/data-service"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Brief pause for backend startup
sleep 2

# 4. Start API Gateway
echo "[2/3] Starting API Gateway on http://localhost:4000..."
cd "$ROOT_DIR/gateway"
npm run dev &
GATEWAY_PID=$!

# Brief pause for gateway startup
sleep 2

# 5. Start WebGL Frontend
echo "[3/3] Starting WebGL Frontend on http://localhost:3000..."
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

WSL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "--------------------------------------------------------"
echo "  ✓ Platform is running!"
echo "  • Primary Web UI: http://localhost:3000"
echo "  • IPv6 Direct:   http://[::1]:3000"
echo "  • WSL Host IP:   http://${WSL_IP}:3000"
echo "  • API Gateway:   http://localhost:4000"
echo "  • Data Service API: http://localhost:8000/docs"
echo "--------------------------------------------------------"
echo "Press CTRL+C to stop all services together."
echo ""

wait
