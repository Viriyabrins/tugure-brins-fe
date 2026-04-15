/**
 * @file requestSignature.js
 * @description Utility untuk menghasilkan Request Signature pada setiap
 * HTTP request dari Frontend ke Backend.
 *
 * Front-end HANYA membuat dan mengirimkan signature headers.
 * Semua validasi (freshness, uuid uniqueness, HMAC verification) dilakukan
 * sepenuhnya di backend — frontend tidak melakukan pengecekan validitas signature.
 *
 * Payload string yang di-sign: `{uuid}|{timestamp_wib}|{METHOD}|{path}`
 * Timestamp : ISO 8601 WIB (UTC+7), e.g. 2026-04-15T14:00:00.000+07:00
 * Algoritma : HMAC-SHA256 via Web Crypto API (SubtleCrypto)
 * Expiry    : 5 detik — divalidasi di backend
 *
 * Headers yang dikirim:
 *   X-Signature           — hex HMAC-SHA256 dari canonical payload
 *   X-Signature-Timestamp — ISO 8601 WIB (UTC+7) timestamp
 *   X-Signature-UUID      — UUID v4 unik per request
 *
 * Env vars:
 *   VITE_SIGNATURE_SECRET — shared secret (harus sama dengan backend SIGNATURE_KEYS["default"])
 *                           fallback ke VITE_KEYCLOAK_SECRET_KEY jika tidak ada
 */

import { v4 as uuidv4 } from 'uuid';

const SIGNATURE_SECRET = import.meta.env.VITE_SIGNATURE_SECRET || import.meta.env.VITE_KEYCLOAK_SECRET_KEY || '';

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

async function hmacSha256Hex(key, payload) {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Membuat Request Signature lengkap untuk sebuah HTTP request.
 * Payload canonical: `{uuid}|{timestamp}|{METHOD}|{path}`
 *
 * @param {object} params
 * @param {string} params.method   - HTTP method (GET, POST, PUT, DELETE, PATCH)
 * @param {string} params.endpoint - URL path (misalnya "/api/v1/users")
 * @returns {Promise<{ uuid: string, timestamp: string, method: string, endpoint: string, signature: string } | null>}
 */
export async function createRequestSignature({ method, endpoint }) {
  if (!SIGNATURE_SECRET) {
    console.warn('[RequestSignature] VITE_SIGNATURE_SECRET tidak ditemukan. Signature tidak akan dibuat.');
    return null;
  }
  const uuid = uuidv4();
  // Timestamp dalam format WIB (UTC+7) eksplisit, contoh: "2026-04-15T14:30:00.000+07:00".
  // Cara kerja:
  //   1. Date.now() → epoch UTC sekarang (ms)
  //   2. Tambah 7 jam → epoch yang merepresentasikan "jam dinding" WIB
  //   3. .toISOString() → string UTC dari jam dinding WIB (misal "2026-04-15T14:30:00.000Z")
  //   4. Ganti suffix Z → +07:00 agar backend tahu ini WIB
  // Backend mem-parse "2026-04-15T14:30:00.000+07:00" → epoch UTC asli (07:30 UTC) dengan benar.
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const timestamp = new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, -1) + '+07:00';
  const normalizedMethod = String(method).toUpperCase();
  const normalizedPath = String(endpoint).split('?')[0];

  // Canonical payload must match backend exactly: uuid|timestamp|METHOD|path
  const payload = `${uuid}|${timestamp}|${normalizedMethod}|${normalizedPath}`;

  try {
    const key = await importHmacKey(SIGNATURE_SECRET);
    const signature = await hmacSha256Hex(key, payload);
    return { uuid, timestamp, method: normalizedMethod, endpoint: normalizedPath, signature };
  } catch (err) {
    console.error('[RequestSignature] Gagal membuat signature:', err);
    return null;
  }
}

/**
 * Menyisipkan signature headers ke dalam objek fetch options.
 * Validasi signature (freshness, nonce, HMAC) dilakukan sepenuhnya di backend.
 *
 * Headers yang disisipkan:
 *   X-Signature           — hex HMAC-SHA256
 *   X-Signature-Timestamp — ISO 8601 WIB (UTC+7)
 *   X-Signature-UUID      — UUID v4 unik per request
 *
 * @param {RequestInit} fetchOptions - Fetch options yang sudah ada
 * @param {string} endpoint - URL path yang akan di-request
 * @returns {Promise<RequestInit>}
 */
export async function withSignatureHeaders(fetchOptions, endpoint) {
  const method = fetchOptions.method || 'GET';
  const sigResult = await createRequestSignature({ method, endpoint });

  if (!sigResult) {
    return fetchOptions;
  }

  const existingHeaders = fetchOptions.headers || {};
  return {
    ...fetchOptions,
    headers: {
      ...existingHeaders,
      'X-Signature': sigResult.signature,
      'X-Signature-Timestamp': sigResult.timestamp,
      'X-Signature-UUID': sigResult.uuid,
    },
  };
}
