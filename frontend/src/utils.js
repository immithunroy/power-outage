const BN_MAP = { 0: '০', 1: '১', 2: '২', 3: '৩', 4: '৪', 5: '৫', 6: '৬', 7: '৭', 8: '৮', 9: '৯' };

export function toBn(input) {
  return String(input).replace(/[0-9]/g, (d) => BN_MAP[d]);
}

export function digits(n, lang) {
  return lang === 'bn' ? toBn(n) : String(n);
}

const UNITS = {
  d: { en: 'd', bn: 'দিন' },
  h: { en: 'h', bn: 'ঘণ্টা' },
  m: { en: 'min', bn: 'মিনিট' },
  s: { en: 's', bn: 'সেকেন্ড' },
};

export function formatDuration(ms, lang) {
  const u = (k) => UNITS[k][lang] || UNITS[k].en;
  if (!Number.isFinite(ms) || ms < 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const D = (n) => digits(n, lang);

  if (totalSec < 60) return `${D(s)}${u('s')}`;
  if (totalSec < 3600) {
    return m > 0 ? `${D(m)}${u('m')} ${D(s)}${u('s')}` : `${D(s)}${u('s')}`;
  }
  if (totalSec < 86400) {
    return h > 0 ? `${D(h)}${u('h')} ${D(m)}${u('m')}` : `${D(m)}${u('m')}`;
  }
  return `${D(d)}${u('d')} ${D(h)}${u('h')}`;
}

export function elapsedClock(ms, lang) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const D = (n) => digits(n, lang);
  const core = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${D(`+${d}`)} ${core}` : lang === 'bn' ? toBn(core) : core;
}

const LOCALES = { en: 'en-GB', bn: 'bn-BD' };

function toAMPM(s) {
  return String(s).replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
}

export function fmtDateTime(ts, lang, opts = {}) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '—';
  const l = LOCALES[lang] || LOCALES.en;
  const base = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...opts,
  };
  try {
    return toAMPM(new Intl.DateTimeFormat(l, base).format(d));
  } catch {
    return d.toLocaleString();
  }
}

export function fmtDate(ts, lang, opts = {}) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '—';
  const l = LOCALES[lang] || LOCALES.en;
  const base = { day: '2-digit', month: 'short', ...opts };
  try {
    return new Intl.DateTimeFormat(l, base).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export function fmtTime(ts, lang, opts = {}) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '—';
  const l = LOCALES[lang] || LOCALES.en;
  const base = { hour: '2-digit', minute: '2-digit', hour12: true, ...opts };
  try {
    return toAMPM(new Intl.DateTimeFormat(l, base).format(d));
  } catch {
    return d.toLocaleTimeString();
  }
}

export function fmtPercent(n, lang) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const p = digits(Number(n).toFixed(2), lang);
  return `${p}%`;
}

export function downsample(points, target) {
  if (!points || points.length <= target) return points || [];
  const size = points.length / target;
  const out = [];
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * size);
    const end = Math.min(points.length, Math.floor((i + 1) * size));
    const slice = points.slice(start, end);
    let down = 0;
    let total = 0;
    let latSum = 0;
    let latN = 0;
    for (const p of slice) {
      total += (p.upCount || 0) + (p.downCount || 0);
      down += p.downCount || 0;
      if (p.avgLatency != null) {
        latSum += p.avgLatency;
        latN += 1;
      }
    }
    out.push({
      t: slice[0] ? slice[0].t : new Date(),
      downRatio: total ? down / total : 0,
      upCount: total - down,
      downCount: down,
      avgLatency: latN ? Math.round(latSum / latN) : null,
    });
  }
  return out;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function cn(...args) {
  return args.filter(Boolean).join(' ');
}