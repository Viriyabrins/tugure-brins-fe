/**
 * @file requestSignature.js
 * @description Utility untuk menghasilkan Request Signature yang aman pada setiap
 * HTTP request dari Frontend ke Backend.
 *
 * Signature terdiri dari:
 *   - UUID    : crypto.randomUUID() — identitas unik setiap request
 *   - Timestamp: Date.now() dalam zona waktu Asia/Jakarta (epoch ms tetap UTC internally)
 *   - Method  : HTTP method (GET, POST, PUT, DELETE, dll)
 *   - Endpoint: URL path yang dituju (misalnya /api/v1/users)
 *
 * Payload string yang di-sign:
 *   `{METHOD}:{ENDPOINT}:{TIMESTAMP}:{UUID}`
 *
 * Algoritma: HMAC-SHA256 menggunakan Web Crypto API (SubtleCrypto) — berjalan di browser.
 * Secret Key: Dibaca dari import.meta.env.VITE_KEYCLOAK_SECRET_KEY
 * Expiry    : Dikonfigurasi via VITE_SIGNATURE_MAX_AGE_MS (default 5000ms = 5 detik).
 *
 * CATATAN KEAMANAN:
 * Secret key ini di-bundle ke dalam kode browser. Karena arsitektur proyek ini
 * menggunakan server.js (Fastify BFF) sebagai perantara, validasi sesungguhnya
 * terjadi di server-side (Node.js). Secret key di frontend hanya untuk keperluan
 * pembangkitan signature; pastikan key ini berbeda dari kredensial kritis Keycloak.
 */

const SIGNATURE_SECRET  = import.meta.env.VITE_KEYCLOAK_SECRET_KEY || '';

import { v4 as uuidv4 } from 'uuid';

/**
 * Waktu hidup maksimum sebuah signature (ms).
 * Harus bernilai sama dengan SIGNATURE_MAX_AGE_MS di server.js.
 * Dikonfigurasi via VITE_SIGNATURE_MAX_AGE_MS. Default: 5000ms (5 detik).
 */
const SIGNATURE_MAX_AGE_MS = Number(import.meta.env.VITE_SIGNATURE_MAX_AGE_MS) || 5000;

/**
 * Mengimpor secret key berupa base64 string menjadi CryptoKey untuk HMAC-SHA256.
 * @param {string} secret - Secret key dalam format string (plain atau base64)
 * @returns {Promise<CryptoKey>}
 */
async function importHmacKey(secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/**
 * Menghasilkan HMAC-SHA256 signature dalam format hex string.
 * @param {CryptoKey} key - CryptoKey yang sudah diimport
 * @param {string} payload - String payload yang akan di-sign
 * @returns {Promise<string>} Signature dalam format hex
 */
async function hmacSha256Hex(key, payload) {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Mendapatkan timestamp saat ini dalam epoch milliseconds (UTC).
 * Untuk keperluan logging/display, zona waktu Asia/Jakarta digunakan,
 * namun nilai yang di-kirim ke server tetap epoch ms (UTC) agar konsisten
 * dalam validasi anti-replay di berbagai zona waktu.
 *
 * @returns {{ epochMs: number, jakartaISO: string }}
 *   - epochMs   : timestamp epoch ms (UTC) — digunakan sebagai nilai dalam signature
 *   - jakartaISO: representasi waktu Asia/Jakarta untuk keperluan logging
 */
export function getJakartaTimestamp() {
  const now = new Date();
  const epochMs = now.getTime();

  // Format tampilan untuk logging/debugging dalam zona waktu Jakarta (WIB, UTC+7)
  const jakartaISO = now.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return { epochMs, jakartaISO };
}

/**
 * Mengecek apakah sebuah signature yang sudah dibuat sebelumnya masih valid
 * (belum melewati batas waktu SIGNATURE_MAX_AGE_MS).
 *
 * Berguna sebagai guard sebelum menggunakan ulang signature yang tersimpan.
 * Dalam arsitektur saat ini, setiap fetch selalu membuat signature baru,
 * sehingga fungsi ini berfungsi sebagai safety-net.
 *
 * @param {number} signatureTimestamp - Nilai epochMs saat signature dibuat
 * @returns {boolean} true jika sudah expired, false jika masih valid
 */
export function isSignatureExpired(signatureTimestamp) {
  if (!signatureTimestamp || typeof signatureTimestamp !== 'number') return true;
  const age = Date.now() - signatureTimestamp;
  return age > SIGNATURE_MAX_AGE_MS;
}

/**
 * Membuat Request Signature lengkap untuk sebuah HTTP request.
 *
 * @param {object} params
 * @param {string} params.method   - HTTP method (GET, POST, PUT, DELETE, PATCH)
 * @param {string} params.endpoint - URL path (misalnya "/api/v1/users")
 * @returns {Promise<{
 *   uuid: string,
 *   timestamp: number,
 *   timestampDisplay: string,
 *   method: string,
 *   endpoint: string,
 *   signature: string
 * }>}
 */
export async function createRequestSignature({ method, endpoint }) {
  if (!SIGNATURE_SECRET) {
    console.warn(
      '[RequestSignature] VITE_KEYCLOAK_SECRET_KEY tidak ditemukan. Signature tidak akan dibuat.'
    );
    return null;
  }

  // Use uuid v4 to ensure compatibility across runtimes
  const uuid = uuidv4();
  const { epochMs: timestamp, jakartaISO: timestampDisplay } = getJakartaTimestamp();
  const normalizedMethod = String(method).toUpperCase();
  const normalizedEndpoint = String(endpoint).split('?')[0]; // Strip query params dari endpoint

  // Format payload: METHOD:ENDPOINT:TIMESTAMP:UUID
  const payload = `${normalizedMethod}:${normalizedEndpoint}:${timestamp}:${uuid}`;

  try {
    const key = await importHmacKey(SIGNATURE_SECRET);
    const signature = await hmacSha256Hex(key, payload);

    return {
      uuid,
      timestamp,
      timestampDisplay,
      method: normalizedMethod,
      endpoint: normalizedEndpoint,
      signature,
    };
  } catch (err) {
    console.error('[RequestSignature] Gagal membuat signature:', err);
    return null;
  }
}

/**
 * Menyisipkan signature headers ke dalam objek fetch options.
 * Dirancang untuk digunakan sebagai wrapper dari authFetchOptions().
 *
 * Headers yang disisipkan:
 *   - X-Request-UUID      : UUID unik per-request
 *   - X-Request-Timestamp : Epoch ms timestamp
 *   - X-Request-Signature : HMAC-SHA256 hex signature
 *
 * @param {RequestInit} fetchOptions - Fetch options yang sudah ada (termasuk headers)
 * @param {string} endpoint - URL path yang akan di-request
 * @returns {Promise<RequestInit>} Fetch options dengan signature headers ditambahkan
 */
export async function withSignatureHeaders(fetchOptions, endpoint) {
  const method = fetchOptions.method || 'GET';
  const sigResult = await createRequestSignature({ method, endpoint });

  if (!sigResult) {
    // Jika signature gagal dibuat (key tidak ada), lanjutkan request tanpa signature
    return fetchOptions;
  }

  // Sanity check: pastikan signature yang baru saja dibuat belum expired
  // (normalnya tidak akan terjadi, tapi bisa terjadi jika ada race condition
  // atau delay ekstrem antara pembuatan dan pengiriman request)
  if (isSignatureExpired(sigResult.timestamp)) {
    console.warn(
      `[RequestSignature] Signature expired segera setelah dibuat ` +
      `(age > ${SIGNATURE_MAX_AGE_MS}ms). Membuat ulang signature...`
    );
    // Buat ulang sekali lagi — jika masih expired, ada masalah sistem (clock skew ekstrem)
    const retryResult = await createRequestSignature({ method, endpoint });
    if (!retryResult || isSignatureExpired(retryResult.timestamp)) {
      console.error('[RequestSignature] Gagal membuat signature yang valid. Request dikirim tanpa signature.');
      return fetchOptions;
    }
    return buildHeadersFromSignature(fetchOptions, retryResult);
  }

  return buildHeadersFromSignature(fetchOptions, sigResult);
}

/**
 * Helper: menggabungkan signature result ke dalam fetch options headers.
 * @param {RequestInit} fetchOptions
 * @param {{ uuid: string, timestamp: number, signature: string }} sigResult
 * @returns {RequestInit}
 */
function buildHeadersFromSignature(fetchOptions, sigResult) {
  const existingHeaders = fetchOptions.headers || {};
  return {
    ...fetchOptions,
    headers: {
      ...existingHeaders,
      'X-Request-UUID': sigResult.uuid,
      'X-Request-Timestamp': String(sigResult.timestamp),
      'X-Request-Signature': sigResult.signature,
    },
  };
}
