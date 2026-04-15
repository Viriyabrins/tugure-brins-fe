import path from 'path';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyHttpProxy from '@fastify/http-proxy';
import { fileURLToPath } from 'url';

// emulate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment file. Priority:
// 1) process.env.DOTENV_CONFIG_PATH
// 2) .env.<NODE_ENV> within project root
// 3) fallback to .env.development
const envPath = path.join(__dirname, process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env.development');
dotenv.config({ path: envPath });

const fastify = Fastify({
  // Logger diaktifkan agar request masuk ter-tracking di terminal.
  // Set ke false di production jika log dikelola oleh sistem eksternal (Datadog, dll).
  logger: process.env.NODE_ENV !== 'production',
});


// Environment-configurable values (set via cross-env or your environment)
// Use values from the loaded env file (envPath) via process.env
const {
  PORT = 5173,
  HOST = '0.0.0.0',
  PROXY_TARGET = 'http://localhost:3000',
  PROXY_PREFIX = '/api',
  CORS_ORIGIN = '*',
  MINIO_TARGET_ENDPOINT,
  MINIO_PROXY_PREFIX = '/minio'
} = process.env;

// Baca KEYCLOAK_SECRET_KEY langsung dari process.env (setelah dotenv.config())
// agar nilainya selalu terbaca dari env file, tidak tergantikan default value.
const KEYCLOAK_SECRET_KEY = process.env.VITE_KEYCLOAK_SECRET_KEY || process.env.KEYCLOAK_SECRET_KEY || '';

if (!KEYCLOAK_SECRET_KEY) {
  console.warn(
    '\x1b[33m[WARN][RequestSignature] KEYCLOAK_SECRET_KEY tidak ditemukan di env file!' +
    ' Validasi request signature akan DINONAKTIFKAN.\x1b[0m'
  );
}

// ─── Request Signature Verification ────────────────────────────────────────────

/**
 * Waktu toleransi maksimum (ms) antara timestamp request dan waktu server.
 * Request yang terlalu lama (stale) akan ditolak untuk mencegah replay attack.
 * Dikonfigurasi via env SIGNATURE_MAX_AGE_MS. Default: 5000ms (5 detik).
 */
const SIGNATURE_MAX_AGE_MS = Number(process.env.SIGNATURE_MAX_AGE_MS) || 5000;

console.log(
  `\x1b[36m[RequestSignature] Signature max age: ${SIGNATURE_MAX_AGE_MS}ms ` +
  `(${SIGNATURE_MAX_AGE_MS / 1000}s)\x1b[0m`
);

/**
 * Menghasilkan HMAC-SHA256 hex dari payload menggunakan secret key.
 * Algoritma identik dengan yang digunakan di sisi browser (SubtleCrypto HMAC-SHA256).
 *
 * @param {string} secret  - Secret key (KEYCLOAK_SECRET_KEY)
 * @param {string} payload - String yang di-sign: METHOD:ENDPOINT:TIMESTAMP:UUID
 * @returns {string} Hex string hasil HMAC-SHA256
 */
function computeHmacSha256(secret, payload) {
  return crypto
    .createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(payload, 'utf8')
    .digest('hex');
}

/**
 * Verifikasi Request Signature dari HTTP headers.
 *
 * Headers yang diharapkan:
 *   - X-Request-UUID      : UUID unik per-request
 *   - X-Request-Timestamp : Epoch ms (UTC) saat request dibuat
 *   - X-Request-Signature : HMAC-SHA256 hex dari payload
 *
 * Payload yang direkonstruksi: `{METHOD}:{ENDPOINT}:{TIMESTAMP}:{UUID}`
 *
 * Jika validasi gagal, melempar Error dengan pesan yang sesuai.
 *
 * @param {import('fastify').FastifyRequest} request
 * @throws {Error}
 */
function verifyRequestSignature(request) {
  const uuid      = request.headers['x-request-uuid'];
  const timestamp = request.headers['x-request-timestamp'];
  const signature = request.headers['x-request-signature'];

  // Jika salah satu header tidak ada, tolak request
  if (!uuid || !timestamp || !signature) {
    throw new Error('Missing required signature headers (X-Request-UUID, X-Request-Timestamp, X-Request-Signature)');
  }

  // ── Anti-Replay Attack: cek usia timestamp ──────────────────────────────────
  const tsMs  = Number(timestamp);
  if (!Number.isFinite(tsMs)) {
    throw new Error('X-Request-Timestamp must be a valid numeric epoch milliseconds value');
  }

  const serverNow = Date.now();
  const ageDiff   = Math.abs(serverNow - tsMs);
  if (ageDiff > SIGNATURE_MAX_AGE_MS) {
    throw new Error(
      `Request timestamp out of acceptable window. Age: ${ageDiff}ms, max: ${SIGNATURE_MAX_AGE_MS}ms. ` +
      `Pastikan waktu klien dan server sudah sinkron.`
    );
  }

  // ── Rekonstruksi payload dan verifikasi signature ──────────────────────────
  const method   = (request.method || 'GET').toUpperCase();
  // Hapus query string dari URL untuk konsistensi dengan sisi Frontend
  const endpoint = (request.url || '/').split('?')[0];

  const expectedPayload   = `${method}:${endpoint}:${timestamp}:${uuid}`;
  const expectedSignature = computeHmacSha256(KEYCLOAK_SECRET_KEY, expectedPayload);

  // Bandingkan signature menggunakan timing-safe comparison untuk mencegah timing attacks
  const sigBuffer      = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  // timingSafeEqual membutuhkan buffer dengan panjang yang sama
  if (sigBuffer.length !== expectedBuffer.length) {
    throw new Error('Invalid signature: length mismatch');
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error('Invalid request signature. Akses ditolak.');
  }
}

// ────────────────────────────────────────────────────────────────────────────────

// Optional SSL certificate paths (can be relative to the env file directory)
const { SSL_KEY_PATH, SSL_CERT_PATH, SSL_CA_PATH } = process.env;

// Keep track of which env file was loaded
const ENV_FILE = envPath;

// Register CORS
fastify.register(cors, {
  origin: CORS_ORIGIN
});

// ─── Global Request Signature Validation Hook ────────────────────────────────
//
// PENTING: Menggunakan 'onRequest' (bukan 'preHandler') agar hook ini berjalan
// SEBELUM @fastify/http-proxy mengambil alih routing. Plugin proxy berjalan
// dalam encapsulated scope sehingga 'preHandler' tidak akan pernah dipanggil
// untuk route yang dihandle oleh proxy.
//
fastify.addHook('onRequest', async (request, reply) => {
  const url = request.raw.url || '';
  const method = request.method || 'GET';

  // Lewati validasi untuk route non-API (file statis, SPA fallback)
  if (!PROXY_PREFIX || !url.startsWith(PROXY_PREFIX)) {
    return;
  }

  // Pengecualian (Bypass) Signature untuk Server-Sent Events (SSE)
  if (url.includes('/db-channel/stream')) {
    return;
  }

  // ── Log setiap incoming API request ─────────────────────────────────────────
  const uuid      = request.headers['x-request-uuid']      || '(tidak ada)';
  const timestamp = request.headers['x-request-timestamp'] || '(tidak ada)';
  const signature = request.headers['x-request-signature'] || '(tidak ada)';

  const hasAllHeaders = 
    request.headers['x-request-uuid']      !== undefined &&
    request.headers['x-request-timestamp'] !== undefined &&
    request.headers['x-request-signature'] !== undefined;

  console.log(
    `\x1b[90m[Signature] ──────────────────────────────────────\x1b[0m\n` +
    `\x1b[90m  Method    : \x1b[0m${method}\n` +
    `\x1b[90m  URL       : \x1b[0m${url}\n` +
    `\x1b[90m  UUID      : \x1b[0m${uuid}\n` +
    `\x1b[90m  Timestamp : \x1b[0m${timestamp}\n` +
    `\x1b[90m  Signature : \x1b[0m${signature.length > 20 ? signature.slice(0, 20) + '...' : signature}\n` +
    `\x1b[90m  Headers OK: \x1b[0m${hasAllHeaders ? '\x1b[32m✓ ya\x1b[0m' : '\x1b[31m✗ tidak lengkap\x1b[0m'}`
  );

  // Jika KEYCLOAK_SECRET_KEY tidak dikonfigurasi, log peringatan dan lewati
  if (!KEYCLOAK_SECRET_KEY) {
    console.warn(
      '\x1b[33m[Signature] ⚠ KEYCLOAK_SECRET_KEY tidak dikonfigurasi. ' +
      'Validasi dinonaktifkan — semua request diteruskan.\x1b[0m'
    );
    return;
  }

  try {
    verifyRequestSignature(request);
    console.log(`\x1b[32m[Signature] ✓ VALID — request diteruskan ke proxy [${method} ${url}]\x1b[0m`);
  } catch (err) {
    console.error(`\x1b[31m[Signature] ✗ DITOLAK [${method} ${url}]: ${err.message}\x1b[0m`);
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: err.message,
    });
  }
});
// ─────────────────────────────────────────────────────────────────────────────


// Register HTTP proxy for API routes (if PROXY_TARGET provided)
if (PROXY_TARGET) {
  fastify.register(fastifyHttpProxy, {
    upstream: PROXY_TARGET,
    prefix: PROXY_PREFIX,
    // Preserve the /api prefix when forwarding to backend (backend routes expect /api/files)
    rewritePrefix: PROXY_PREFIX,
    http2: false,
    replyOptions: {
      // leave headers as-is; you can customize here if needed
    }
  });
}

// Register HTTP proxy for MinIO routes (if MINIO_TARGET_ENDPOINT provided)
if (MINIO_TARGET_ENDPOINT) {
  fastify.register(fastifyHttpProxy, {
    upstream: MINIO_TARGET_ENDPOINT,
    prefix: MINIO_PROXY_PREFIX,
    // remove the /minio prefix when forwarding to MinIO
    rewritePrefix: '',
    http2: false,
    replyOptions: {
      // leave headers as-is
    }
  });
}

// Serve static assets. Allow absolute path via env var `STATIC_ROOT` or `VITE_DIST_PATH`.
// If those are not provided, resolve `public` relative to the env file directory.
let staticRoot = process.env.VITE_DIST_PATH || path.join(path.dirname(ENV_FILE), 'public');
// Ensure absolute path
if (!path.isAbsolute(staticRoot)) {
  staticRoot = path.resolve(path.dirname(ENV_FILE), staticRoot);
}
fastify.register(fastifyStatic, {
  root: staticRoot,
  prefix: '/',
});

// SPA fallback: use a NotFound handler to avoid route conflicts with fastify-static
fastify.setNotFoundHandler(async (request, reply) => {
  const url = request.raw.url || '';

  // Let proxied routes return not found here (proxy should have been registered earlier)
  if (PROXY_PREFIX && url.startsWith(PROXY_PREFIX)) {
    return reply.status(404).send({ error: 'Not found' });
  }

  // Only serve index.html for GET requests that don't look like static files
  if (request.method === 'GET' && (!url.includes('.') || url.endsWith('.html'))) {
    try {
      const indexPath = path.join(staticRoot, 'index.html');
      let html = await fs.readFile(indexPath, 'utf8');

      // Build a small runtime config and inject into the page so the client
      // can read runtime flags without needing a rebuild.
      const runtime = {
        VITE_APP_ID: process.env.VITE_APP_ID || null,
        VITE_API_PROXY: process.env.VITE_API_PROXY || process.env.PROXY_TARGET || null,
        PROXY_PREFIX
      };
      const script = `<script>window.__RUNTIME_CONFIG=${JSON.stringify(runtime)};</script>`;

      // Inject before closing </head> so module scripts can read it synchronously
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${script}\n</head>`);
      } else {
        // fallback: prepend to body
        html = `${script}\n${html}`;
      }

      reply.type('text/html').send(html);
    } catch (err) {
      // If anything fails, fall back to sending the file via fastify-static
      try {
        return reply.sendFile('index.html');
      } catch (e) {
        return reply.status(500).send({ error: 'Failed to load index.html', details: err.message });
      }
    }
  }

  return reply.status(404).send({ error: 'Not found' });
});

// Resolve and load HTTPS options from environment if provided
const resolveFromEnvDir = (p) => {
  if (!p) return undefined;
  return path.isAbsolute(p) ? p : path.resolve(path.dirname(ENV_FILE), p);
};

let httpsOptions;
if (SSL_KEY_PATH && SSL_CERT_PATH) {
  try {
    const keyPath = resolveFromEnvDir(SSL_KEY_PATH);
    const certPath = resolveFromEnvDir(SSL_CERT_PATH);
    httpsOptions = {
      key: fsSync.readFileSync(keyPath),
      cert: fsSync.readFileSync(certPath)
    };
    if (SSL_CA_PATH) {
      const caPath = resolveFromEnvDir(SSL_CA_PATH);
      httpsOptions.ca = fsSync.readFileSync(caPath);
    }
    console.log('Loaded SSL files:', keyPath, certPath, SSL_CA_PATH ? resolveFromEnvDir(SSL_CA_PATH) : '');
  } catch (err) {
    console.error('Failed to load SSL certificate files:', err.message);
    httpsOptions = undefined;
  }
}

const start = async () => {
  try {
    await fastify.listen({ port: Number(PORT), host: HOST, ...(httpsOptions ? { https: httpsOptions } : {}) });
    console.log(`Loaded env file: ${ENV_FILE}`);
    console.log(`Server running: ${httpsOptions ? 'https' : 'http'}://${HOST}:${PORT}`);
    console.log(`Proxy mapping: ${PROXY_PREFIX} -> ${PROXY_TARGET}`);
    if (MINIO_TARGET_ENDPOINT) {
      console.log(`MinIO proxy mapping: ${MINIO_PROXY_PREFIX} -> ${MINIO_TARGET_ENDPOINT}`);
    }
    console.log(`CORS origin: ${CORS_ORIGIN}`);
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
};

start();
