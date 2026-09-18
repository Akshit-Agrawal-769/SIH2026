import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
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

const requireAuth = (req: Request, res: Response, next: express.NextFunction) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error: JWT_SECRET missing' });
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// Proxy /api routes to Python data-service
app.use(
  '/api',
  requireAuth,
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
const wss = new WebSocketServer({ 
  server, 
  path: '/ws/live',
  verifyClient: (info, done) => {
    if (!process.env.JWT_SECRET) {
      return done(false, 500, 'Server configuration error: JWT_SECRET missing');
    }
    let token = '';
    const authHeader = info.req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
      token = url.searchParams.get('token') || '';
    }
    
    if (!token) {
      return done(false, 401, 'Unauthorized');
    }
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      done(true);
    } catch {
      done(false, 401, 'Unauthorized');
    }
  }
});

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
