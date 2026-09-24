const BASE = (import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080')).replace(/\/+$/, '');

export const A = $state({ token: '', user: null });

export function loadToken() {
  try {
    const saved = localStorage.getItem('auth_token');
    if (saved) A.token = saved;
  } catch {}
}

export function setToken(t) {
  A.token = t;
  if (!t) A.user = null;
  try {
    if (t) {
      localStorage.setItem('auth_token', t);
    } else {
      localStorage.removeItem('auth_token');
    }
  } catch {}
}

// Restores the profile after a reload, when only the token survives in localStorage.
export async function loadUser() {
  if (!A.token || A.user) return;
  try {
    A.user = await api('/api/auth/me');
  } catch {
    // A 401 already clears the session in request(); other failures just leave the profile empty.
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (A.token) headers.Authorization = 'Bearer ' + A.token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal });
  if (res.status === 401) { setToken(''); throw new Error('Invalid credentials'); }
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const safeMsg = res.status === 401 ? 'Invalid credentials' :
                    res.status === 409 ? 'Invalid request' :
                    res.status === 400 ? 'Invalid input' :
                    'Something went wrong';
    throw new Error(safeMsg);
  }
  return raw;
}

export async function api(path, opts = {}) {
  const raw = await request(path, opts);
  return raw?.data !== undefined ? raw.data : raw;
}

export async function apiRaw(path, opts = {}) {
  return request(path, opts);
}
