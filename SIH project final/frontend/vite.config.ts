import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_GATEWAY_URL || 'http://localhost:4000',
        changeOrigin: true
      },
      '/ws': {
        target: (process.env.VITE_GATEWAY_URL || 'http://localhost:4000').replace('http', 'ws'),
        ws: true
      }
    }
  }
});
