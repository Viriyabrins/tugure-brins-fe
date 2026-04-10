import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  // Dev server proxy settings (useful for local/staging dev)
  server: {
    host:'0.0.0.0',
    proxy: {
      '/api': {
        // Prefer explicit Vite proxy env, then production PROXY_TARGET, then fallback
        target: process.env.VITE_API_PROXY || process.env.PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        // Enable WebSocket-like streaming for SSE
        ws: true,
        // preserve the /api prefix so dev behavior matches production
        rewrite: (path) => path,
        // attach a small logger so dev console shows the exact forwarded URL
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            try {
              const target = (proxy && proxy.options && proxy.options.target) || process.env.VITE_API_PROXY || process.env.PROXY_TARGET || 'http://localhost:4000';
              const url = req.url || '';
              const forwarded = new URL(url, target);
              console.log(`[vite proxy] ${req.method} ${url} -> ${forwarded.href}`);
            } catch (err) {
              // ignore logging errors
            }
          });
          // Ensure SSE streams are not buffered
          proxy.on('proxyRes', (proxyRes, req, res) => {
            if (req.url.includes('/db-channel/stream')) {
              console.log('[vite proxy] SSE stream detected, disabling buffering');
              // Disable buffering for SSE by setting on the destination response
              res.setHeader('X-Accel-Buffering', 'no');
            }
          });
        }
      }
    }
  },
  plugins: [
    react(),
  ]
});