let _token = null;
let _onAuthFailure = null;

export const setAuthToken = (t) => { _token = t; };
export const setAuthFailureHandler = (fn) => { _onAuthFailure = fn; };

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': _token,
      ...options.headers,
    },
  });
  if (res.status === 401 || res.status === 403) {
    _onAuthFailure?.();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res;
}

export const auth = {
  async login(password) {
    const res = await fetch('/mood/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error('Unauthorized');
    const data = await res.json();
    return data.token;
  },
};

export const entries = {
  async record({ type, value }) {
    const res = await apiFetch('/mood/api/entries', {
      method: 'POST',
      body: JSON.stringify({ type, value }),
    });
    return res.json();
  },
  async list({ limit = 30, before } = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    const res = await apiFetch(`/mood/api/entries?${params}`);
    return res.json();
  },
  async delete(id) {
    const res = await apiFetch(`/mood/api/entries/${id}`, { method: 'DELETE' });
    return res.json();
  },
  async addNote(id, note) {
    const res = await apiFetch(`/mood/api/entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    });
    return res.json();
  },
};
