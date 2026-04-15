import path from 'path';
import { promises as fs } from 'fs';
import fsSync from 'fs';
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

// Optional SSL certificate paths (can be relative to the env file directory)
const { SSL_KEY_PATH, SSL_CERT_PATH, SSL_CA_PATH } = process.env;

// Keep track of which env file was loaded
const ENV_FILE = envPath;

// Register CORS
fastify.register(cors, {
  origin: CORS_ORIGIN
});

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
