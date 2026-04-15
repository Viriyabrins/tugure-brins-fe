import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Muat env file sesuai mode (.env.development, .env.staging, dll)
  const env = loadEnv(mode, __dirname, '')

  return {
    logLevel: 'error', // Suppress warnings, only show errors
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    // Dev server proxy settings (useful for local/staging dev)
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          // VITE_API_PROXY must be a full URL (e.g. http://host:10011), never a path like /api.
          // PROXY_TARGET is the fallback for server.js; use the same value here for consistency.
          target: env.VITE_API_PROXY || env.PROXY_TARGET || 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
          // Enable WebSocket-like streaming for SSE
          ws: true,
          // preserve the /api prefix so dev behavior matches production
          rewrite: (path) => path,
          configure: (proxy) => {
            // Ensure SSE streams are not buffered
            proxy.on('proxyRes', (proxyRes, req, res) => {
              if (req.url.includes('/db-channel/stream')) {
                res.setHeader('X-Accel-Buffering', 'no')
              }
            })
          }
        }
      }
    },
    plugins: [
      react(),
    ]
  }
})
