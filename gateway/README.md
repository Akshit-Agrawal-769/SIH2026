# INCOIS API Gateway

Node.js Express + TypeScript API Gateway and WebSocket notification hub for the INCOIS 3D Ocean Data Visualization Platform.

## Features
- Health check at `GET /health`
- Reverse proxy routing for all `/api/*` requests directly to Python `data-service`
- WebSocket server at `/ws/live` for real-time sensor updates
- Production-ready Docker containerization

## Development

```bash
npm install
npm run dev
```

Runs on port `4000` by default.
