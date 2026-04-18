/**
 * @file requestSignature.js
 * @description Utility untuk menghasilkan Request Signature pada setiap
 * HTTP request dari Frontend ke Backend.
 *
 * Front-end HANYA membuat dan mengirimkan signature headers.
 * Semua validasi (freshness, uuid uniqueness, HMAC verification) dilakukan
 * sepenuhnya di backend — frontend tidak melakukan pengecekan validitas signature.
 *
 * Payload string yang di-sign: `{uuid}|{timestamp}|{METHOD}|{path}`
 * Timestamp : ISO 8601 UTC, e.g. 2026-04-15T07:00:00.000Z
 * Algoritma : HMAC-SHA256
 *   - Secure context (HTTPS / localhost) → Web Crypto API (SubtleCrypto)
 *   - Non-secure context (plain HTTP)    → CryptoJS fallback
 * Expiry    : 10 detik — divalidasi di backend
 *
 * Headers yang dikirim:
 *   X-Signature           — hex HMAC-SHA256 dari canonical payload
 *   X-Signature-Timestamp — ISO 8601 UTC timestamp
 *   X-Signature-UUID      — UUID v4 unik per request
 *
 * Env vars:
 *   VITE_SIGNATURE_SECRET — shared secret (harus sama dengan backend SIGNATURE_KEYS["default"])
 *                           fallback ke VITE_KEYCLOAK_SECRET_KEY jika tidak ada
 */

import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

const SIGNATURE_SECRET = import.meta.env.VITE_SIGNATURE_SECRET || import.meta.env.VITE_KEYCLOAK_SECRET_KEY || '';

// ── Server-clock offset sync ───────────────────────────────────────────────────
// Menyimpan selisih (ms) antara epoch server dan epoch klien agar setiap
// timestamp signature mengacu pada waktu server yang autoritatif, bukan jam
// lokal browser yang bisa saja berbeda (clock drift).
let _serverOffset = 0;

/**
 * Ambil waktu server dari GET /api/time dan hitung selisih jam (clock offset).
 * offset = epochServer − epochKlien (titik tengah round-trip untuk mengurangi bias latensi).
 * Dipanggil sekali saat app pertama kali dibuka, dan setiap kali tab kembali aktif.
 */
async function _fetchServerOffset() {
  try {
    const before = Date.now();
    const resp = await fetch('/api/time');
    const after = Date.now();
    if (!resp.ok) return;
    const { serverTime } = await resp.json();
    const serverMs = Date.parse(serverTime);
    if (isNaN(serverMs)) return;
    // Gunakan titik tengah round-trip untuk mengurangi bias latensi satu arah
    const clientMid = Math.round((before + after) / 2);
    _serverOffset = serverMs - clientMid;
  } catch {
    // Jika gagal, biarkan offset = 0 (pakai jam lokal sebagai fallback)
  }
}

/**
 * Inisialisasi sinkronisasi jam server.
 * Dipanggil sekali saat startup. Juga melakukan re-sync setiap kali tab menjadi visible.
 * Mengembalikan Promise yang selesai saat sync pertama berhasil (atau gagal diam-diam).
 */
export function initServerTimeSync() {
  const p = _fetchServerOffset();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        _fetchServerOffset();
      }
    });
  }
  return p;
}

/**
 * Deteksi apakah Web Crypto SubtleCrypto tersedia.
 * SubtleCrypto hanya tersedia di secure context (HTTPS atau localhost).
 * Pada HTTP biasa (misal staging via IP plain-HTTP), crypto.subtle = undefined.
 */
const isSubtleCryptoAvailable = () =>
  typeof crypto !== 'undefined' &&
  typeof crypto.subtle !== 'undefined' &&
  typeof crypto.subtle.importKey === 'function';

/**
 * Hitung HMAC-SHA256 hex dari payload.
 * Otomatis memilih SubtleCrypto (secure) atau CryptoJS (fallback non-secure).
 *
 * @param {string} secret
 * @param {string} payload
 * @returns {Promise<string>} hex string
 */
async function hmacSha256Hex(secret, payload) {
  if (isSubtleCryptoAvailable()) {
    // ── Path A: SubtleCrypto — tersedia di HTTPS / localhost ─────────────────
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const data = encoder.encode(payload);
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ── Path B: CryptoJS fallback — dipakai saat plain HTTP (non-secure context) ─
  return CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Hex);
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
  // Ambil waktu server secara langsung untuk memastikan timestamp 100% berasal
  // dari server (jangan percaya waktu lokal client). Jika panggilan gagal,
  // kembalikan null sehingga signature tidak dihasilkan.
  try {
    const resp = await fetch('/api/time');
    if (!resp.ok) {
      console.error('[RequestSignature] Gagal mengambil waktu server:', resp.status);
      return null;
    }
    const body = await resp.json();
    const serverTime = body && body.serverTime;
    const serverMs = Date.parse(serverTime);
    if (!serverTime || isNaN(serverMs)) {
      console.error('[RequestSignature] Response /api/time tidak valid:', serverTime);
      return null;
    }
    // Gunakan waktu server persis seperti yang dikembalikan backend.
    const timestamp = new Date(serverMs).toISOString();
    // Lanjutkan pembuatan signature dengan timestamp dari server
    const normalizedMethod = String(method).toUpperCase();
    const normalizedPath = String(endpoint).split('?')[0];

    // Canonical payload must match backend exactly: uuid|timestamp|METHOD|path
    const payload = `${uuid}|${timestamp}|${normalizedMethod}|${normalizedPath}`;

    try {
      const signature = await hmacSha256Hex(SIGNATURE_SECRET, payload);
      return { uuid, timestamp, method: normalizedMethod, endpoint: normalizedPath, signature };
    } catch (err) {
      console.error('[RequestSignature] Gagal membuat signature:', err);
      return null;
    }
  } catch (err) {
    console.error('[RequestSignature] Error saat mengambil waktu server:', err);
    return null;
  }
}

/**
 * Menyisipkan signature headers ke dalam objek fetch options.
 * Validasi signature (freshness, nonce, HMAC) dilakukan sepenuhnya di backend.
 *
 * Headers yang disisipkan:
 *   X-Signature           — hex HMAC-SHA256
 *   X-Signature-Timestamp — ISO 8601 UTC timestamp
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
    throw new Error('[RequestSignature] Gagal membuat signature; request dibatalkan.');
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
