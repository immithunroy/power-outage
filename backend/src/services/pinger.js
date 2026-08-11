const { execFile } = require('child_process');
const net = require('net');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const { getSettings } = require('../models/Setting');
const Outage = require('../models/Outage');
const Ping = require('../models/Ping');

const state = {
  declaredUp: null,
  failStreak: 0,
  successStreak: 0,
  lastPing: null,
  currentOutageId: null,
  loopTimer: null,
  running: false,
};

function parsePingLatency(stdout) {
  const match = stdout.match(/time[=<]\s*([\d.]+)\s*ms/i);
  return match ? Math.round(parseFloat(match[1])) : null;
}

async function icmpPing(target) {
  const isWin = process.platform === 'win32';
  const args = isWin
    ? ['-n', '3', '-w', '1000', target]
    : ['-c', '3', '-W', '1', target];
  try {
    const { stdout } = await execFileAsync('ping', args, { timeout: 15000 });
    return { up: true, latency: parsePingLatency(stdout) };
  } catch {
    return { up: false, latency: null };
  }
}

function tcpPing(target, port, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host: target, port });
    socket.setTimeout(timeoutMs);
    const done = (up, latency) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ up, latency });
    };
    socket.once('connect', () => done(true, Date.now() - started));
    socket.once('timeout', () => done(false, null));
    socket.once('error', () => done(false, null));
  });
}

async function pingTarget(settings) {
  if (settings.method === 'tcp') {
    return tcpPing(settings.target, settings.port || 443, settings.timeoutMs || 5000);
  }
  return icmpPing(settings.target);
}

async function currentOpenOutage() {
  return Outage.findOne({ endedAt: null }).sort({ startedAt: 1 });
}

async function startOutage() {
  const out = await Outage.create({ startedAt: new Date(), endedAt: null, durationMs: null });
  state.currentOutageId = String(out._id);
  state.declaredUp = false;
  console.log('[pinger] OUTAGE STARTED at', out.startedAt.toISOString());
}

async function endOutage() {
  const now = new Date();
  const out = await Outage.findById(state.currentOutageId).catch(() => null);
  if (out && !out.endedAt) {
    out.endedAt = now;
    out.durationMs = now.getTime() - out.startedAt.getTime();
    await out.save();
    console.log('[pinger] OUTAGE ENDED, duration', (out.durationMs / 1000).toFixed(0), 's');
  }
  state.currentOutageId = null;
  state.declaredUp = true;
}

async function reconcileOnBoot() {
  const open = await currentOpenOutage();
  if (open) {
    state.currentOutageId = String(open._id);
    state.declaredUp = false;
    console.log('[pinger] found open outage from', open.startedAt.toISOString());
  } else {
    state.declaredUp = true;
  }
}

async function applyTransition(up, settings) {
  const confirmDown = settings.confirmDown || 1;
  const confirmUp = settings.confirmUp || 1;

  if (state.declaredUp === null) {
    state.declaredUp = up;
    return;
  }
  if (state.declaredUp) {
    if (!up) {
      state.failStreak += 1;
      if (state.failStreak >= confirmDown) {
        state.failStreak = 0;
        await startOutage();
      }
    } else {
      state.failStreak = 0;
    }
  } else {
    if (up) {
      state.successStreak += 1;
      if (state.successStreak >= confirmUp) {
        state.successStreak = 0;
        await endOutage();
      }
    } else {
      state.successStreak = 0;
    }
  }
}

async function tick() {
  if (state.running) return;
  state.running = true;
  try {
    const settings = await getSettings();
    const t0 = Date.now();
    let res;
    try {
      res = await pingTarget(settings);
    } catch {
      res = { up: false, latency: null };
    }
    const elapsed = Date.now() - t0;
    const up = Boolean(res.up);
    const latency = res.latency != null ? res.latency : up ? elapsed : null;

    state.lastPing = { ts: new Date(), up, latency, target: settings.target };

    try {
      await Ping.create({ ts: new Date(), up, latency });
    } catch (e) {
      console.error('[pinger] failed to store ping:', e.message);
    }

    await applyTransition(up, settings);
  } catch (e) {
    console.error('[pinger] tick error:', e.message);
  } finally {
    state.running = false;
  }
}

async function ensureLoop() {
  await reconcileOnBoot();
  if (state.loopTimer) clearInterval(state.loopTimer);
  const settings = await getSettings();
  await tick();
  state.loopTimer = setInterval(tick, settings.intervalMs || 30000);
  if (state.loopTimer.unref) state.loopTimer.unref();
  console.log('[pinger] loop running every', settings.intervalMs, 'ms →', settings.target, `(${settings.method})`);
}

function restartLoop() {
  return ensureLoop().catch((e) => console.error('[pinger] loop restart error:', e.message));
}

async function testOnce() {
  const settings = await getSettings();
  return { settings: { target: settings.target, method: settings.method, port: settings.port }, result: await pingTarget(settings) };
}

async function getStatusSnapshot() {
  const settings = await getSettings();
  const open = state.currentOutageId ? await currentOpenOutage() : null;
  const startOf24h = new Date(Date.now() - 24 * 3600 * 1000);

  let last24h = { total: 0, up: 0 };
  try {
    const agg = await Ping.aggregate([
      { $match: { ts: { $gte: startOf24h } } },
      { $group: { _id: null, total: { $sum: 1 }, up: { $sum: { $cond: ['$up', 1, 0] } } } },
    ]);
    if (agg[0]) last24h = agg[0];
  } catch {
    /* ignore */
  }

  return {
    up: state.declaredUp,
    target: settings.target,
    method: settings.method,
    port: settings.port,
    intervalMs: settings.intervalMs,
    lastChecked: state.lastPing ? state.lastPing.ts : null,
    latency: state.lastPing ? state.lastPing.latency : null,
    serverTime: new Date(),
    currentOutage: open
      ? {
          id: String(open._id),
          startedAt: open.startedAt,
          durationMs: Date.now() - open.startedAt.getTime(),
        }
      : null,
    last24h: {
      upCount: last24h.up || 0,
      totalCount: last24h.total || 0,
      availability: last24h.total ? Math.round((last24h.up / last24h.total) * 1000) / 10 : null,
    },
  };
}

module.exports = { ensureLoop, restartLoop, testOnce, getStatusSnapshot, state, pingTarget };