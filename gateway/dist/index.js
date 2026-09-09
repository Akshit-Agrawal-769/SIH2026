"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcast = broadcast;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const ws_1 = require("ws");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = process.env.PORT || 4000;
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8000';
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)('dev'));
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'gateway',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        dataServiceUrl: DATA_SERVICE_URL
    });
});
// Proxy /api routes to Python data-service
app.use('/api', (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: DATA_SERVICE_URL,
    changeOrigin: true,
    ws: false,
    pathRewrite: {
        '^/api': '/api'
    },
    on: {
        error: (err, req, res) => {
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
}));
// WebSocket server for real-time sensor updates
const wss = new ws_1.WebSocketServer({ server, path: '/ws/live' });
wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to INCOIS Live Gateway' }));
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('[WebSocket] Received:', data);
        }
        catch {
            // ignore non-json
        }
    });
    ws.on('close', () => {
        console.log('[WebSocket] Client disconnected');
    });
});
function broadcast(payload) {
    const message = JSON.stringify(payload);
    wss.clients.forEach((client) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(message);
        }
    });
}
server.listen(PORT, () => {
    console.log(`[Gateway] Running on port ${PORT}`);
    console.log(`[Gateway] Proxying /api to ${DATA_SERVICE_URL}`);
});
