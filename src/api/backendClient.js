import { appParams } from '@/lib/app-params';

const appId = appParams.appId || import.meta.env.VITE_BASE44_APP_ID;

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
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
      const error = await res.text();
      try {
        const parsed = JSON.parse(error);
        throw new Error(parsed.message || 'Request failed');
      } catch (e) {
        throw new Error(error || res.statusText);
      }
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
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
      const error = await res.text();
      try {
        const parsed = JSON.parse(error);
        throw new Error(parsed.message || 'Request failed');
      } catch (e) {
        throw new Error(error || res.statusText);
      }
    }
    return handlePaginatedResponse(res);
  },

  async get(entityName, id) {
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
      const error = await res.text();
      try {
        const parsed = JSON.parse(error);
        throw new Error(parsed.message || 'Request failed');
      } catch (e) {
        throw new Error(error || res.statusText);
      }
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
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.text();
      try {
        const parsed = JSON.parse(error);
        throw new Error(parsed.message || 'Request failed');
      } catch (e) {
        throw new Error(error || res.statusText);
      }
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
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.text();
      try {
        const parsed = JSON.parse(error);
        throw new Error(parsed.message || 'Request failed');
      } catch (e) {
        throw new Error(error || res.statusText);
      }
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

  async filter(entityName, query = {}) {
    const qs = new URLSearchParams({ limit: '0', q: JSON.stringify(query) }).toString();
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}?${qs}`;
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
      const error = await res.text();
      try {
        const parsed = JSON.parse(error);
        throw new Error(parsed.message || 'Request failed');
      } catch (e) {
        throw new Error(error || res.statusText);
      }
    }
    return handleResponse(res);
  }
};
