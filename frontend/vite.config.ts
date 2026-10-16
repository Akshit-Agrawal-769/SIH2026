import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import path from 'path';
import fs from 'fs';
import type { ServerResponse } from 'http';

const gateway = process.env.VITE_GATEWAY_URL || 'http://localhost:4000';
const publicDir = path.resolve(__dirname, 'public');

/** Files bundled in public/ (e.g. public/api/catalog.json) are served directly, never proxied. */
function servePublicFile(req: { url?: string }): string | undefined {
  const urlPath = decodeURIComponent((req.url || '').split('?')[0]);
  const file = path.join(publicDir, urlPath);
  return file.startsWith(publicDir) && fs.existsSync(file) && fs.statSync(file).isFile() ? req.url : undefined;
}

/**
 * Backend not running: answer like static hosting (HTML, not an API response) so the app
 * switches straight to IPFS / the bundled copy instead of retrying a dead backend.
 */
function backendDown(_err: Error, _req: unknown, res: ServerResponse | unknown) {
  const r = res as ServerResponse;
  if (r && typeof r.writeHead === 'function' && !r.headersSent) {
    r.writeHead(503, { 'content-type': 'text/html' });
    r.end('<!doctype html><title>Backend not running</title>');
  }
}

export default defineConfig({
  plugins: [react(), cesium()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: gateway,
        changeOrigin: true,
        bypass: servePublicFile,
        configure: (proxy) => {
          proxy.on('error', backendDown);
        }
      },
      '/ws': {
        target: gateway.replace('http', 'ws'),
        ws: true
      }
    }
  }
});
