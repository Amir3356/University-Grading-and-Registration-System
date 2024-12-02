import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, {
                'Content-Type': 'application/json',
              });
              res.end(
                JSON.stringify({
                  error: {
                    kind: 'service_unavailable',
                    message: 'Backend server is temporarily unavailable or restarting.',
                  },
                })
              );
            }
          });
        },
      },
      '/ws': {
        target: 'ws://127.0.0.1:5000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, socket) => {
            if (socket && !socket.destroyed && typeof socket.destroy === 'function') {
              socket.destroy();
            }
          });
        },
      },
    },
  },
})

