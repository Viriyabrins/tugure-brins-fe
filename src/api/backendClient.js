import { appParams } from '@/lib/app-params';
import { getKeycloakToken } from '@/lib/keycloak';

const appId = appParams.appId || import.meta.env.VITE_APP_ID || 'brin-app-dev';

/**
 * Build default fetch options with Keycloak Bearer token injected.
 */
function authFetchOptions(extra = {}) {
  const token = getKeycloakToken();
  const headers = { ...(extra.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return { ...extra, headers };
}

const prettifyErrorMessage = (message = '', fallback = 'Permintaan gagal diproses') => {
  const text = String(message || '').trim();
  if (!text) return fallback;

  if (text.includes('Unique constraint failed')) {
    return 'Data sudah terdaftar. Periksa nilai unik seperti contract_id.';
  }

  if (text.includes('Foreign key constraint failed')) {
    return 'Data tidak valid karena relasi referensi tidak ditemukan.';
  }

  if (text.includes('Record to update not found') || text.includes('not found')) {
    return 'Data tidak ditemukan atau sudah berubah.';
  }

  return text;
};

const readErrorMessage = async (res) => {
  const text = await res.text();
  if (!text) {
    return prettifyErrorMessage('', `Permintaan gagal (${res.status})`);
  }

  try {
    const parsed = JSON.parse(text);
    const baseMessage = parsed?.message || parsed?.error || text;
    return prettifyErrorMessage(baseMessage, `Permintaan gagal (${res.status})`);
  } catch {
    return prettifyErrorMessage(text, `Permintaan gagal (${res.status})`);
  }
};

const throwBackendError = async (res) => {
  const message = await readErrorMessage(res);
  throw new Error(message);
};

/**
 * Extract a plain array from any backend response shape.
 * Handles:
 *   { success: true, data: [...] }                         → [...]
 *   { success: true, data: { data: [...], pagination } }   → [...]
 *   [...]                                                    → [...]
 *   { data: [...] }                                          → [...]
 */
const handleResponse = async (res) => {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    
    if (parsed && typeof parsed === 'object') {
      // EntityController returns { success: true, data: ..., message: '' }
      if (parsed.success !== undefined && parsed.success === true) {
        const payload = parsed.data;
        // payload may be the array directly, or a pagination wrapper { data: [...], pagination: {...} }
        if (Array.isArray(payload)) return payload;
        if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
          return payload.data;
        }
        return payload || [];
      }
      // Direct array response
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // Object with data property
      if ('data' in parsed && Array.isArray(parsed.data)) {
        return parsed.data;
      }
    }
    
    // Fallback: return empty array
    return [];
  } catch (e) {
    console.error('Failed to parse response:', e);
    return [];
  }
};

/**
 * Extract data + pagination metadata from a paginated backend response.
 * Returns { data: [...], pagination: { total, page, limit, ... } }
 */
const handlePaginatedResponse = async (res) => {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed === 'object' && parsed.success === true) {
      const payload = parsed.data;
      if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
        return { data: payload.data, pagination: payload.pagination || {} };
      }
      if (Array.isArray(payload)) {
        return { data: payload, pagination: { total: payload.length } };
      }
    }
    if (Array.isArray(parsed)) {
      return { data: parsed, pagination: { total: parsed.length } };
    }
    return { data: [], pagination: { total: 0 } };
  } catch (e) {
    console.error('Failed to parse paginated response:', e);
    return { data: [], pagination: { total: 0 } };
  }
};

export const backend = {
  /**
   * List all records for an entity. Returns a plain array.
   * By default fetches ALL records (limit=0). Pass { limit, page } to paginate.
   */
  async list(entityName, query = {}) {
    // Default to limit=0 (no limit) so existing callers get all data
    const params = { limit: '0', ...query };
    const qs = new URLSearchParams(params).toString();
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, authFetchOptions());
    if (!res.ok) {
      await throwBackendError(res);
    }
    return handleResponse(res);
  },

  /**
   * List records with pagination metadata.
   * Returns { data: [...], pagination: { total, page, limit, totalPages, hasNext, hasPrev } }
   */
  async listPaginated(entityName, query = {}) {
    const qs = new URLSearchParams(query).toString();
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, authFetchOptions());
    if (!res.ok) {
      await throwBackendError(res);
    }
    return handlePaginatedResponse(res);
  },

  async get(entityName, id) {
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/${encodeURIComponent(id)}`;
    const res = await fetch(url, authFetchOptions());
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        if (parsed.success !== undefined && parsed.success === true) {
          return parsed.data || null;
        }
        if ('data' in parsed) {
          return parsed.data;
        }
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse response:', e);
      return null;
    }
  },

  async create(entityName, payload) {
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}`;
    const res = await fetch(url, authFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        if (parsed.success !== undefined && parsed.success === true) {
          return parsed.data || null;
        }
        if ('data' in parsed) {
          return parsed.data;
        }
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse response:', e);
      return null;
    }
  },

  async update(entityName, id, payload) {
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/${encodeURIComponent(id)}`;
    const res = await fetch(url, authFetchOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        if (parsed.success !== undefined && parsed.success === true) {
          return parsed.data || null;
        }
        if ('data' in parsed) {
          return parsed.data;
        }
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse response:', e);
      return null;
    }
  },

  async delete(entityName, id) {
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed?.success) return parsed.data ?? { id };
      return { id };
    } catch {
      return { id };
    }
  },

  async filter(entityName, query = {}) {
    const qs = new URLSearchParams({ limit: '0', q: JSON.stringify(query) }).toString();
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}?${qs}`;
    const res = await fetch(url, authFetchOptions());
    if (!res.ok) {
      await throwBackendError(res);
    }
    return handleResponse(res);
  },

  async uploadMasterContractsAtomic(payload) {
    const url = `/api/apps/${encodeURIComponent(appId)}/master-contracts/upload`;
    const res = await fetch(url, authFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));

    if (!res.ok) {
      await throwBackendError(res);
    }

    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed?.success) return parsed.data ?? null;
      return parsed;
    } catch {
      return null;
    }
  },

  async processMasterContractApproval(contractId, payload) {
    const url = `/api/apps/${encodeURIComponent(appId)}/master-contracts/${encodeURIComponent(contractId)}/approval`;
    const res = await fetch(url, authFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));

    if (!res.ok) {
      await throwBackendError(res);
    }

    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed?.success) return parsed.data ?? null;
      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * List notifications from backend with pagination. Supports optional filters.
   * GET /api/notifications
   * Returns { data: [...], pagination: { total, ... } }
   */
  async listNotifications(query = {}) {
    const qs = new URLSearchParams(query).toString();
    const url = `/api/notifications${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, authFetchOptions());
    if (!res.ok) {
      await throwBackendError(res);
    }
    return handlePaginatedResponse(res);
  },

  /**
   * Create a new notification.
   * POST /api/notifications
   */
  async createNotification(payload) {
    const url = '/api/notifications';
    const res = await fetch(url, authFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        if (parsed.success !== undefined && parsed.success === true) {
          return parsed.data || null;
        }
        if ('data' in parsed) {
          return parsed.data;
        }
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse response:', e);
      return null;
    }
  },

  /**
   * Update a notification.
   * PUT /api/notifications/:id
   */
  async updateNotification(id, payload) {
    const url = `/api/notifications/${encodeURIComponent(id)}`;
    const res = await fetch(url, authFetchOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        if (parsed.success !== undefined && parsed.success === true) {
          return parsed.data || null;
        }
        if ('data' in parsed) {
          return parsed.data;
        }
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse response:', e);
      return null;
    }
  },

  /**
   * Mark a notification as read.
   * PUT /api/notifications/:id/read
   */
  async markNotificationAsRead(id) {
    const url = `/api/notifications/${encodeURIComponent(id)}/read`;
    const res = await fetch(url, authFetchOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    }));
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        if (parsed.success !== undefined && parsed.success === true) {
          return parsed.data || null;
        }
        if ('data' in parsed) {
          return parsed.data;
        }
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse response:', e);
      return null;
    }
  },

  /**
   * Delete a notification.
   * DELETE /api/notifications/:id
   */
  async deleteNotification(id) {
    const url = `/api/notifications/${encodeURIComponent(id)}`;
    const res = await fetch(url, authFetchOptions({
      method: 'DELETE',
    }));
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch (e) {
      return null;
    }
  },

  /**
   * Get the current user's notification settings by Keycloak user ID.
   * GET /api/notification-settings/me?keycloak_user_id=<sub>
   * Returns the settings object or null if none saved yet.
   */
  async getMyNotificationSettings(keycloakUserId) {
    const qs = new URLSearchParams({ keycloak_user_id: keycloakUserId }).toString();
    const url = `/api/notification-settings/me?${qs}`;
    const res = await fetch(url, authFetchOptions());
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed?.success === true) return parsed.data || null;
      if ('data' in parsed) return parsed.data;
      return parsed;
    } catch (e) {
      console.error('Failed to parse response:', e);
      return null;
    }
  },

  /**
   * Upsert the current user's notification settings.
   * PUT /api/notification-settings/me
   * Body must include keycloak_user_id.
   */
  async upsertMyNotificationSettings(payload) {
    const url = '/api/notification-settings/me';
    const res = await fetch(url, authFetchOptions({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed?.success === true) return parsed.data || null;
      if ('data' in parsed) return parsed.data;
      return parsed;
    } catch (e) {
      console.error('Failed to parse response:', e);
      return null;
    }
  },

  async logUserInApp(pageName) {
    const url = `/api/app-logs/${encodeURIComponent(appId)}/log-user-in-app/${encodeURIComponent(pageName)}`;
    const res = await fetch(url, authFetchOptions({ method: 'POST' }));
    if (!res.ok) {
      await throwBackendError(res);
    }
    return true;
  },

  /**
   * Get all users who have a specific role from Keycloak.
   * GET /api/users-by-role/:roleName
   * Returns [{ email, name }]
   */
  async getUsersByRole(roleName) {
    const url = `/api/users-by-role/${encodeURIComponent(roleName)}`;
    const res = await fetch(url, authFetchOptions());
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed?.success === true) return parsed.data || [];
      if (Array.isArray(parsed)) return parsed;
      if (parsed?.data && Array.isArray(parsed.data)) return parsed.data;
      return [];
    } catch (e) {
      console.error('Failed to parse getUsersByRole response:', e);
      return [];
    }
  },

  /**
   * Send an email directly via the dedicated /api/send-email endpoint.
   * POST /api/send-email
   * Body: { to, subject, body, cc?, bcc? }
   */
  async sendDirectEmail(payload) {
    const url = '/api/send-email';
    const res = await fetch(url, authFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      return parsed?.data ?? parsed;
    } catch (e) {
      return null;
    }
  },

  async sendEmail(payload) {
    const url = `/api/apps/${encodeURIComponent(appId)}/integration-endpoints/Core/SendEmail`;
    const res = await fetch(url, authFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
    if (!res.ok) {
      await throwBackendError(res);
    }
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      return parsed?.data ?? parsed;
    } catch (e) {
      return null;
    }
  },

  async uploadFile(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getKeycloakToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const url = `/api/apps/${encodeURIComponent(appId)}/integration-endpoints/Core/UploadFile`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (res.ok) {
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;
        const maybeUrl = parsed?.data?.file_url || parsed?.file_url;
        if (maybeUrl) {
          return { file_url: maybeUrl };
        }
      }
    } catch (_) {
    }

    return { file_url: URL.createObjectURL(file) };
  }
};
