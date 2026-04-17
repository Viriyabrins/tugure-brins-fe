import { authFetchOptions } from '@/api/backendClient';

export async function resetAllData() {
  const url = '/api/dev-tools/reset-all-data';
  const res = await fetch(url, await authFetchOptions({ method: 'DELETE' }, url));

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.message || `Reset failed (${res.status})`);
  }
  return body;
}
