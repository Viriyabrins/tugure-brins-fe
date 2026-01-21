import { appParams } from '@/lib/app-params';

const appId = appParams.appId || import.meta.env.VITE_BASE44_APP_ID;

const handleResponse = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(text || res.statusText);
  }
};

export const backend = {
  async list(entityName, query = {}) {
    const qs = new URLSearchParams(query).toString();
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw await handleResponse(res);
    return handleResponse(res);
  },

  async get(entityName, id) {
    const url = `/api/apps/${encodeURIComponent(appId)}/entities/${encodeURIComponent(entityName)}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw await handleResponse(res);
    return handleResponse(res);
  }
};
