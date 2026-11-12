// Fetch wrapper: attaches the per-session token and turns error responses into exceptions with readable messages.

const token = document.querySelector('meta[name="cs-token"]')?.content || '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api/${path}`, {
      method,
      headers: { 'X-CS-Token': token, ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }) },
      body: method === 'GET' ? undefined : JSON.stringify(body || {})
    });
  } catch (_) {
    throw new ApiError("Can't reach the Studio server. Is it still running?", 0);
  }
  let data = null;
  try { data = await res.json(); } catch (_) { /* non-JSON error body */ }
  if (!res.ok) throw new ApiError((data && data.error) || `Request failed (${res.status}).`, res.status);
  return data;
}
