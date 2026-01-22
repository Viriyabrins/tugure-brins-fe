import { appParams } from '@/lib/app-params';

const appId = appParams.appId || import.meta.env.VITE_BASE44_APP_ID;

const handleResponse = async (res) => {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    
    // Check if response has success/data structure (from EntityController)
    if (parsed && typeof parsed === 'object') {
      // EntityController returns { success: true, data: [...], message: '' }
      if (parsed.success !== undefined && parsed.success === true) {
        return parsed.data || [];
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

export const backend = {
  async list(entityName, query = {}) {
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
    return handleResponse(res);
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
    const qs = new URLSearchParams({ q: JSON.stringify(query) }).toString();
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
