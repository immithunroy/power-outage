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
  history: (limit = 15, kind, period) =>
    request(`/history?limit=${limit}${kind ? `&kind=${kind}` : ''}${period && period !== 'all' ? `&period=${period}` : ''}`),
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

  growattStatus: () => request('/growatt/status'),
  growattEnergy: (period = 'week') => request(`/growatt/energy?period=${period}`),
  growattAlarms: () => request('/growatt/alarms'),
  growattMeters: (datalogSn) => request(`/growatt/meters?datalog_sn=${datalogSn}`),
  growattMeterData: (datalogSn, address) => request(`/growatt/meters/data?datalog_sn=${datalogSn}&address=${address}`),
  growattDeviceDetails: (deviceSn, deviceType) => request(`/growatt/v4/details?deviceSn=${deviceSn}&deviceType=${deviceType}`),
  growattPowerRealtime: (deviceSn, deviceType) => request(`/growatt/v4/power?deviceSn=${deviceSn}&deviceType=${deviceType}`),
  growattDeviceInfo: (deviceSn, deviceType) => request(`/growatt/v4/device-info?deviceSn=${deviceSn}&deviceType=${deviceType}`),
  growattWifiStrength: (deviceSn, deviceType) => request(`/growatt/v4/wifi?deviceSn=${deviceSn}&deviceType=${deviceType}`),
  growattHistorical: (deviceSn, deviceType, date) => request(`/growatt/v4/historical?deviceSn=${deviceSn}&deviceType=${deviceType}&date=${date}`),
  growattDashboard: () => request('/growatt/dashboard'),
  getGrowattSettings: () => request('/growatt/settings'),
  updateGrowattSettings: (s) => request('/growatt/settings', { method: 'POST', body: JSON.stringify(s) }),
  testGrowatt: () => request('/growatt/test', { method: 'POST' }),
  discoverGrowatt: () => request('/growatt/discover', { method: 'POST' }),
};