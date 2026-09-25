import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import crypto from 'crypto';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 4000);
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8000';
const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || '';
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 600);
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Behind Render / reverse proxies: use X-Forwarded-For for client IPs.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  cors({
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Data-Source', 'X-Data-Policy'],
    credentials: false
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Fixed-window per-IP rate limit (in-memory; one gateway instance).
const hits = new Map<string, { windowStart: number; count: number }>();
app.use((req: Request, res: Response, next: NextFunction) => {
  const now = Date.now();
  const key = req.ip || 'unknown';
  const entry = hits.get(key);
  if (!entry || now - entry.windowStart >= 60_000) {
    hits.set(key, { windowStart: now, count: 1 });
    if (hits.size > 50_000) hits.clear();
    return next();
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_PER_MINUTE) {
    res.setHeader('Retry-After', String(Math.ceil((entry.windowStart + 60_000 - now) / 1000)));
    return res.status(429).json({ error: 'Too many requests' });
  }
  return next();
});

const gatewayHealth = () => ({
  status: 'healthy',
  service: 'gateway',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
  auth: { mutatingRequests: JWT_SECRET ? 'jwt_required' : 'disabled', publicReads: true }
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json(gatewayHealth());
});

// Gateway + upstream health; public.
app.get('/api/health', async (_req: Request, res: Response) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(`${DATA_SERVICE_URL}/api/health`, { signal: controller.signal });
    const body = await upstream.json().catch(() => null);
    res.status(upstream.ok ? 200 : 502).json({ ...gatewayHealth(), dataService: { status: upstream.status, body } });
  } catch (err: any) {
    res.status(502).json({ ...gatewayHealth(), status: 'degraded', dataService: { error: String(err?.message || err) } });
  } finally {
    clearTimeout(timer);
  }
});

function verifyBearer(authHeader: string | undefined): boolean {
  if (!JWT_SECRET || !authHeader?.startsWith('Bearer ')) return false;
  try {
    jwt.verify(authHeader.slice(7), JWT_SECRET, { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// Admin login only exists when credentials are provisioned through the environment.
app.post('/api/auth/login', express.json({ limit: '4kb' }), (req: Request, res: Response) => {
  const user = process.env.ADMIN_USERNAME || '';
  const pass = process.env.ADMIN_PASSWORD || '';
  if (!JWT_SECRET || !user || !pass) {
    return res.status(503).json({ error: 'Admin login is not configured on this deployment' });
  }
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !safeEqual(username, user) || !safeEqual(password, pass)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ sub: username, role: 'admin' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  return res.json({ token });
});

// Scientific data is public and read-only. Anything that mutates requires a JWT.
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (!JWT_SECRET) return res.status(503).json({ error: 'Mutating requests are disabled (JWT_SECRET not configured)' });
  if (!verifyBearer(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' });
  return next();
});

app.use(
  createProxyMiddleware({
    target: DATA_SERVICE_URL,
    changeOrigin: true,
    pathFilter: '/api',
    // First read of a model volume streams slabs from Hugging Face; allow for it.
    proxyTimeout: 180_000,
    timeout: 180_000,
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.removeHeader('authorization');
        if (req.method !== 'GET' && req.method !== 'HEAD' && ADMIN_API_TOKEN) {
          proxyReq.setHeader('X-Admin-Token', ADMIN_API_TOKEN);
        }
      },
      error: (err: any, _req: any, res: any) => {
        console.error('Gateway Proxy Error:', err.message);
        if (res && !res.headersSent && res.writeHead) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Gateway: Failed to reach Data Service' }));
        }
      }
    }
  })
);

// WebSocket channel (authenticated; no public broadcast source is wired yet).
const wss = new WebSocketServer({
  server,
  path: '/ws/live',
  verifyClient: (info, done) => {
    if (!JWT_SECRET) return done(false, 503, 'WebSocket disabled (JWT_SECRET not configured)');
    const header = info.req.headers.authorization;
    const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
    const token = header?.startsWith('Bearer ') ? header : `Bearer ${url.searchParams.get('token') || ''}`;
    return verifyBearer(token) ? done(true) : done(false, 401, 'Unauthorized');
  }
});

wss.on('connection', (ws: WebSocket) => {
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to INCOIS Live Gateway' }));
});

export function broadcast(payload: Record<string, unknown>) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}

server.listen(PORT, () => {
  console.log(`[Gateway] Running on port ${PORT}`);
  console.log(`[Gateway] Proxying /api to ${DATA_SERVICE_URL}`);
  console.log(`[Gateway] CORS origins: ${allowedOrigins.join(', ')}`);
});
