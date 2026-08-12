const BASE = '/api';

let token = localStorage.getItem('outage_token') || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('outage_token', t);
  else localStorage.removeItem('outage_token');
}

export function getToken() {
  return token;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...options, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  status: () => request('/status'),
  stats: (period, kind) => request(`/stats?period=${period}${kind ? `&kind=${kind}` : ''}`),
  timeline: (host) => request(`/timeline?hours=24&stepMinutes=1${host ? `&host=${host}` : ''}`),
  history: (limit = 15, kind) =>
    request(`/history?limit=${limit}${kind ? `&kind=${kind}` : ''}`),
  login: (password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),

  getSettings: () => request('/settings'),
  updateSettings: (s) => request('/settings', { method: 'POST', body: JSON.stringify(s) }),
  testPing: () => request('/settings/test', { method: 'POST' }),
  changePassword: (currentPassword, newPassword) =>
    request('/settings/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  clearHistory: () => request('/settings/clear-history', { method: 'POST' }),
  verify: () => request('/auth/verify'),

  exportCSV: async () => {
    const res = await fetch(BASE + '/history/export', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('export failed');
    return res.blob();
  },
};