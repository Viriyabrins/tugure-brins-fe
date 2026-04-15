import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Muat env file sesuai mode (.env.development, .env.staging, dll)
  // loadEnv prefix '' berarti baca SEMUA variabel, termasuk yang tanpa prefix VITE_
  const env = loadEnv(mode, __dirname, '')

  const KEYCLOAK_SECRET_KEY = env.KEYCLOAK_SECRET_KEY || ''
  const SIGNATURE_MAX_AGE_MS = Number(env.SIGNATURE_MAX_AGE_MS) || 5000

  /**
   * Verifikasi Request Signature pada Vite dev proxy.
   * Algoritma identik dengan server.js agar hasilnya konsisten.
   * @param {import('http').IncomingMessage} req
   * @returns {{ valid: boolean, reason: string }}
   */
  function verifySignature(req) {
    const uuid = req.headers['x-request-uuid']
    const timestamp = req.headers['x-request-timestamp']
    const signature = req.headers['x-request-signature']

    if (!uuid || !timestamp || !signature) {
      return { valid: false, reason: 'Missing required signature headers (X-Request-UUID, X-Request-Timestamp, X-Request-Signature)' }
    }

    const tsMs = Number(timestamp)
    if (!Number.isFinite(tsMs)) {
      return { valid: false, reason: 'X-Request-Timestamp harus berupa angka epoch ms yang valid' }
    }

    const ageDiff = Math.abs(Date.now() - tsMs)
    if (ageDiff > SIGNATURE_MAX_AGE_MS) {
      return { valid: false, reason: `Signature expired. Usia: ${ageDiff}ms, maks: ${SIGNATURE_MAX_AGE_MS}ms` }
    }

    const method = (req.method || 'GET').toUpperCase()
    const endpoint = (req.url || '/').split('?')[0]
    const payload = `${method}:${endpoint}:${timestamp}:${uuid}`

    const expected = crypto
      .createHmac('sha256', Buffer.from(KEYCLOAK_SECRET_KEY, 'utf8'))
      .update(payload, 'utf8')
      .digest('hex')

    const sigBuf = Buffer.from(signature, 'hex')
    const expBuf = Buffer.from(expected, 'hex')

    if (sigBuf.length !== expBuf.length) {
      return { valid: false, reason: 'Invalid signature: length mismatch' }
    }

    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, reason: 'Invalid request signature. Akses ditolak.' }
    }

    return { valid: true, reason: 'OK' }
  }

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
          // Prefer explicit Vite proxy env, then production PROXY_TARGET, then fallback
          target: env.VITE_API_PROXY || env.PROXY_TARGET || 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
          // Enable WebSocket-like streaming for SSE
          ws: true,
          // preserve the /api prefix so dev behavior matches production
          rewrite: (path) => path,
          configure: (proxy) => {
            // ── Request Signature Validation ─────────────────────────────────
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Pengecualian (Bypass) Signature untuk Server-Sent Events (SSE)
              if (req.url.includes('/db-channel/stream')) {
                return
              }

              // Log incoming API request
              const uuid = req.headers['x-request-uuid'] || '(tidak ada)'
              const timestamp = req.headers['x-request-timestamp'] || '(tidak ada)'
              const signature = req.headers['x-request-signature'] || '(tidak ada)'
              const hasAll = uuid !== '(tidak ada)' && timestamp !== '(tidak ada)' && signature !== '(tidak ada)'

              console.log(
                `\x1b[90m[Signature] ──────────────────────────────────\x1b[0m\n` +
                `\x1b[90m  Method    :\x1b[0m ${req.method}\n` +
                `\x1b[90m  URL       :\x1b[0m ${req.url}\n` +
                `\x1b[90m  UUID      :\x1b[0m ${uuid}\n` +
                `\x1b[90m  Timestamp :\x1b[0m ${timestamp}\n` +
                `\x1b[90m  Signature :\x1b[0m ${signature.length > 20 ? signature.slice(0, 20) + '...' : signature}\n` +
                `\x1b[90m  Headers OK:\x1b[0m ${hasAll ? '\x1b[32m✓ ya\x1b[0m' : '\x1b[31m✗ tidak lengkap\x1b[0m'}`
              )

              // Jika secret key tidak dikonfigurasi, skip validasi dengan peringatan
              if (!KEYCLOAK_SECRET_KEY) {
                console.warn('\x1b[33m[Signature] ⚠ KEYCLOAK_SECRET_KEY tidak ada di env. Validasi dinonaktifkan.\x1b[0m')
                return
              }

              // Validasi signature
              const { valid, reason } = verifySignature(req)

              if (!valid) {
                console.error(`\x1b[31m[Signature] ✗ DITOLAK [${req.method} ${req.url}]: ${reason}\x1b[0m`)
                // Batalkan request ke upstream dan kirim 401 langsung
                res.writeHead(401, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, error: 'Unauthorized', message: reason }))
                // Destroy koneksi ke upstream agar proxy tidak meneruskan request
                proxyReq.destroy()
                return
              }

              console.log(`\x1b[32m[Signature] ✓ VALID — diteruskan ke backend [${req.method} ${req.url}]\x1b[0m`)

              // Log URL yang diteruskan
              try {
                const target = env.VITE_API_PROXY || env.PROXY_TARGET || 'http://localhost:4000'
                const forwarded = new URL(req.url, target)
                console.log(`\x1b[90m[vite proxy] ${req.method} ${req.url} -> ${forwarded.href}\x1b[0m`)
              } catch (_) { /* ignore */ }
            })

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
