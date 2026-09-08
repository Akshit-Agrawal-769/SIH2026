import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import path from 'path';

export default defineConfig({
  plugins: [react(), cesium()],
  resolve: {
    alias: [
      {
        find: /^satellite\.js$/,
        replacement: path.resolve(__dirname, 'src/utils/satellite-shim.js'),
      },
    ],
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  },
  esbuild: {
    target: 'esnext'
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        format: 'es',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'three';
            if (id.includes('plotly')) return 'plotly';
            return 'vendor';
          }
        },
      },
    },
  },
});
