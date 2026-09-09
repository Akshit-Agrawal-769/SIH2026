import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8000';

app.use(cors());
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'gateway',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dataServiceUrl: DATA_SERVICE_URL
  });
});

// Proxy /api routes to Python data-service
app.use(
  '/api',
  createProxyMiddleware({
    target: DATA_SERVICE_URL,
    changeOrigin: true,
    ws: false,
    pathRewrite: {
      '^/api': '/api'
    },
    on: {
      error: (err: any, req: any, res: any) => {
        console.error('Gateway Proxy Error:', err.message);
        if (!res.headersSent && res.writeHead) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Bad Gateway: Failed to reach Data Service',
            message: err.message
          }));
        }
      }
    }
  })
);

// WebSocket server for real-time sensor updates
const wss = new WebSocketServer({ server, path: '/ws/live' });

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Client connected');
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to INCOIS Live Gateway' }));

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('[WebSocket] Received:', data);
    } catch {
      // ignore non-json
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
  });
});

export function broadcast(payload: Record<string, unknown>) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

server.listen(PORT, () => {
  console.log(`[Gateway] Running on port ${PORT}`);
  console.log(`[Gateway] Proxying /api to ${DATA_SERVICE_URL}`);
});
