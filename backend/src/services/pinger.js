const { execFile } = require('child_process');
const net = require('net');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const { getSettings } = require('../models/Setting');
const Outage = require('../models/Outage');
const Ping = require('../models/Ping');

const HOSTS = ['grid', 'generator', 'ips'];

const state = {
  declared: { grid: null, generator: null, ips: null },
  streaks: {
    grid: { fail: 0, ok: 0 },
    generator: { fail: 0, ok: 0 },
    ips: { fail: 0, ok: 0 },
  },
  lastPing: { grid: null, generator: null, ips: null },
  currentIds: { grid: null, generator: null },
  loopTimer: null,
  running: false,
};

function parsePingLatency(stdout) {
  const match = stdout.match(/time[=<]\s*([\d.]+)\s*ms/i);
  return match ? Math.round(parseFloat(match[1])) : null;
}

function parseReceived(stdout, isWin) {
  if (isWin) {
    const m = stdout.match(/Received\s*=\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }
  const m = stdout.match(/(\d+)\s+received/i);
  return m ? parseInt(m[1], 10) : 0;
}

async function icmpPing(target) {
  const isWin = process.platform === 'win32';
  const args = isWin
    ? ['-n', '4', '-w', '1000', target]
    : ['-c', '4', '-W', '1', target];
  let stdout = '';
  try {
    const r = await execFileAsync('ping', args, { timeout: 15000 });
    stdout = r.stdout;
  } catch (e) {
    stdout = (e && e.stdout) || '';
  }
  // A host is only considered down when it answers no packets at all.
  // Partial loss (some replies, some timeouts) is still an UP host, so a
  // single dropped ICMP packet never produces a false short outage.
  const received = parseReceived(stdout, isWin);
  return { up: received > 0, latency: parsePingLatency(stdout) };
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

function targetFor(settings, host) {
  if (host === 'generator') return settings.generatorTarget;
  if (host === 'ips') return settings.ipsTarget;
  return settings.target;
}

async function probeHost(host, settings) {
  const target = targetFor(settings, host);
  if (!target) return { up: null, latency: null };
  if (settings.method === 'tcp') {
    return tcpPing(target, settings.port || 443, settings.timeoutMs || 5000);
  }
  return icmpPing(target);
}

async function currentOpen(kind) {
  return Outage.findOne({ kind, endedAt: null }).sort({ startedAt: 1 });
}

async function startGrid() {
  const out = await Outage.create({ kind: 'grid', startedAt: new Date(), endedAt: null, durationMs: null });
  state.currentIds.grid = String(out._id);
  state.declared.grid = false;
  console.log('[pinger] GRID OUTAGE STARTED');
}

async function endGrid() {
  const now = new Date();
  const out = await Outage.findById(state.currentIds.grid).catch(() => null);
  if (out && !out.endedAt) {
    out.endedAt = now;
    out.durationMs = now.getTime() - out.startedAt.getTime();
    await out.save();
    console.log('[pinger] GRID OUTAGE ENDED, duration', (out.durationMs / 1000).toFixed(0), 's');
  }
  state.currentIds.grid = null;
  state.declared.grid = true;
}

async function startGenerator() {
  const out = await Outage.create({ kind: 'generator', startedAt: new Date(), endedAt: null, durationMs: null });
  state.currentIds.generator = String(out._id);
  state.declared.generator = true;
  console.log('[pinger] GENERATOR RUN STARTED (grid down + generator host up)');
}

async function endGenerator() {
  const now = new Date();
  const out = await Outage.findById(state.currentIds.generator).catch(() => null);
  if (out && !out.endedAt) {
    out.endedAt = now;
    out.durationMs = now.getTime() - out.startedAt.getTime();
    await out.save();
    console.log('[pinger] GENERATOR RUN ENDED, duration', (out.durationMs / 1000).toFixed(0), 's');
  }
  state.currentIds.generator = null;
  state.declared.generator = false;
}

async function applyCondition(key, isUp, settings, onStart, onEnd) {
  if (isUp === null || isUp === undefined) return;
  const cur = state.declared[key];
  if (cur === null) {
    state.declared[key] = isUp;
    return;
  }
  const s = state.streaks[key];
  if (cur) {
    if (!isUp) {
      s.fail += 1;
      if (s.fail >= settings.confirmDown) {
        s.fail = 0;
        s.ok = 0;
        state.declared[key] = false;
        if (onEnd) await onEnd();
      }
    } else {
      s.fail = 0;
    }
  } else {
    if (isUp) {
      s.ok += 1;
      if (s.ok >= settings.confirmUp) {
        s.ok = 0;
        s.fail = 0;
        state.declared[key] = true;
        if (onStart) await onStart();
      }
    } else {
      s.ok = 0;
    }
  }
}

async function reconcileOnBoot(settings) {
  const openGrid = await currentOpen('grid');
  const openGen = await currentOpen('generator');
  state.currentIds.grid = openGrid ? String(openGrid._id) : null;
  state.currentIds.generator = openGen ? String(openGen._id) : null;
  if (settings.target) state.declared.grid = openGrid ? false : true;
  else state.declared.grid = null;
  if (settings.generatorTarget) state.declared.generator = openGen ? true : false;
  else state.declared.generator = null;
  if (settings.ipsTarget) state.declared.ips = true;
  else state.declared.ips = null;
}

async function tick() {
  if (state.running) return;
  state.running = true;
  try {
    const settings = await getSettings();
    const now = new Date();
    const results = {};

    for (const host of HOSTS) {
      const target = targetFor(settings, host);
      results[host] = { up: null, latency: null, target };
      if (!target) {
        state.lastPing[host] = null;
        continue;
      }
      const t0 = Date.now();
      let res;
      try {
        res = await probeHost(host, settings);
      } catch {
        res = { up: false, latency: null };
      }
      const up = Boolean(res.up);
      const latency = res.latency != null ? res.latency : up ? Date.now() - t0 : null;
      results[host] = { up, latency, target };
      state.lastPing[host] = { ts: now, up, latency, target };
      try {
        await Ping.create({ host, ts: now, up, latency });
      } catch (e) {
        console.error('[pinger] failed to store ping:', e.message);
      }
    }

    const gridUp = results.grid.up;
    const genUp = results.generator.up;
    const ipsUp = results.ips.up;
    const genCondition = gridUp === null || genUp === null ? null : gridUp === false && genUp === true;

    await applyCondition('grid', gridUp, settings, endGrid, startGrid);
    await applyCondition('generator', genCondition, settings, startGenerator, endGenerator);
    await applyCondition('ips', ipsUp, settings, null, null);
  } catch (e) {
    console.error('[pinger] tick error:', e.message);
  } finally {
    state.running = false;
  }
}

async function ensureLoop() {
  if (state.loopTimer) clearInterval(state.loopTimer);
  const settings = await getSettings();
  await reconcileOnBoot(settings);
  await tick();
  state.loopTimer = setInterval(tick, settings.intervalMs || 30000);
  if (state.loopTimer.unref) state.loopTimer.unref();
  console.log(
    '[pinger] loop every',
    settings.intervalMs,
    'ms — grid:',
    settings.target || '(unset)',
    '| generator:',
    settings.generatorTarget || '(unset)',
    '| ips:',
    settings.ipsTarget || '(unset)'
  );
}

function restartLoop() {
  return ensureLoop().catch((e) => console.error('[pinger] loop restart error:', e.message));
}

async function testOnce() {
  const settings = await getSettings();
  const hosts = {};
  for (const host of HOSTS) {
    const target = targetFor(settings, host);
    if (!target) {
      hosts[host] = { configured: false };
      continue;
    }
    hosts[host] = { configured: true, target, ...(await probeHost(host, settings)) };
  }
  return { settings: { method: settings.method, port: settings.port }, hosts };
}

async function getStatusSnapshot() {
  const settings = await getSettings();
  const now = Date.now();

  const gridOpen = state.currentIds.grid ? await Outage.findById(state.currentIds.grid).catch(() => null) : null;
  const genOpen = state.currentIds.generator ? await Outage.findById(state.currentIds.generator).catch(() => null) : null;

  const start = new Date(now - 24 * 3600 * 1000);

  let grid24 = { total: 0, up: 0 };
  try {
    const agg = await Ping.aggregate([
      { $match: { ts: { $gte: start }, host: { $in: ['grid', null] } } },
      { $group: { _id: null, total: { $sum: 1 }, up: { $sum: { $cond: ['$up', 1, 0] } } } },
    ]);
    if (agg[0]) grid24 = agg[0];
  } catch {
    /* ignore */
  }

  let gen24 = { runMs: 0, count: 0 };
  try {
    const gens = await Outage.find({
      kind: 'generator',
      startedAt: { $lt: new Date(now) },
      $or: [{ endedAt: null }, { endedAt: { $gt: start } }],
    }).lean();
    for (const g of gens) {
      const s = Math.max(g.startedAt.getTime(), start.getTime());
      const e = g.endedAt ? g.endedAt.getTime() : now;
      if (e > s) {
        gen24.runMs += e - s;
        if (g.startedAt.getTime() >= start.getTime()) gen24.count += 1;
      }
    }
  } catch {
    /* ignore */
  }

  return {
    up: state.declared.grid,
    target: settings.target,
    method: settings.method,
    port: settings.port,
    intervalMs: settings.intervalMs,
    serverTime: new Date(now),
    lastChecked: state.lastPing.grid ? state.lastPing.grid.ts : null,
    currentOutage: gridOpen
      ? { id: String(gridOpen._id), startedAt: gridOpen.startedAt, durationMs: now - gridOpen.startedAt.getTime() }
      : null,

    grid: {
      up: state.declared.grid,
      target: settings.target,
      lastChecked: state.lastPing.grid ? state.lastPing.grid.ts : null,
      latency: state.lastPing.grid ? state.lastPing.grid.latency : null,
      currentOutage: gridOpen
        ? { id: String(gridOpen._id), startedAt: gridOpen.startedAt, durationMs: now - gridOpen.startedAt.getTime() }
        : null,
    },
    generator: {
      on: state.declared.generator,
      target: settings.generatorTarget,
      lastChecked: state.lastPing.generator ? state.lastPing.generator.ts : null,
      latency: state.lastPing.generator ? state.lastPing.generator.latency : null,
      currentRun: genOpen
        ? { id: String(genOpen._id), startedAt: genOpen.startedAt, durationMs: now - genOpen.startedAt.getTime() }
        : null,
    },
    ips: {
      up: state.declared.ips,
      target: settings.ipsTarget,
      lastChecked: state.lastPing.ips ? state.lastPing.ips.ts : null,
      latency: state.lastPing.ips ? state.lastPing.ips.latency : null,
    },

    last24h: {
      upCount: grid24.up || 0,
      totalCount: grid24.total || 0,
      availability: grid24.total ? Math.round((grid24.up / grid24.total) * 1000) / 10 : null,
    },
    gen24h: {
      runMs: gen24.runMs,
      count: gen24.count,
      runHours: gen24.runMs / 3600000,
    },
  };
}

module.exports = { ensureLoop, restartLoop, testOnce, getStatusSnapshot, state, pingTarget: probeHost, HOSTS };