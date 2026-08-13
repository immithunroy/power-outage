const express = require('express');
const Outage = require('../models/Outage');
const Ping = require('../models/Ping');
const { buildReport, VALID } = require('../services/statsService');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const period = VALID.includes(req.query.period) ? req.query.period : 'day';
    const kind = req.query.kind === 'generator' ? 'generator' : 'grid';
    const report = await buildReport(period, req.query.end, kind);
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const hours = Math.min(72, Math.max(1, Number(req.query.hours) || 24));
    const stepMs = Math.min(5, Math.max(1, Number(req.query.stepMinutes) || 1)) * 60 * 1000;
    const host = req.query.host === 'generator' ? 'generator' : 'grid';
    const from = new Date(Date.now() - hours * 3600 * 1000);
    const to = new Date();

    if (host === 'generator') {
      const events = await Outage.find({
        kind: 'generator',
        startedAt: { $lt: to },
        $or: [{ endedAt: null }, { endedAt: { $gt: from } }],
      })
        .select('startedAt endedAt')
        .lean();
      const points = [];
      for (let t = from.getTime(); t < to.getTime(); t += stepMs) {
        const bFrom = t;
        const bTo = Math.min(to.getTime(), t + stepMs);
        let runMs = 0;
        for (const e of events) {
          const s = Math.max(e.startedAt.getTime(), bFrom);
          const en = e.endedAt ? Math.min(e.endedAt.getTime(), bTo) : bTo;
          const ov = en - s;
          if (ov > 0) runMs += ov;
        }
        const span = bTo - bFrom;
        points.push({
          t: new Date(bFrom),
          downRatio: span > 0 ? runMs / span : 0,
          upCount: span > 0 ? Math.round((span - runMs) / 1000) : 0,
          downCount: Math.round(runMs / 1000),
          avgLatency: null,
        });
      }
      res.json({ hours, stepMs, host, points, generatedAt: new Date() });
      return;
    }

    const pings = await Ping.find({
      ts: { $gte: from },
      host: { $in: ['grid', null] },
    })
      .select('ts up latency')
      .lean();

    const buckets = new Map();
    for (const p of pings) {
      const t = Math.floor(p.ts.getTime() / stepMs) * stepMs;
      const key = t;
      if (!buckets.has(key)) buckets.set(key, { t, upTotal: 0, downTotal: 0, latencies: [] });
      const b = buckets.get(key);
      if (p.up) b.upTotal += 1;
      else b.downTotal += 1;
      if (p.latency != null) b.latencies.push(p.latency);
    }

    const points = [...buckets.values()]
      .sort((a, b) => a.t - b.t)
      .map((b) => {
        const total = b.upTotal + b.downTotal;
        const avgLatency =
          b.latencies.length > 0 ? Math.round(b.latencies.reduce((s, l) => s + l, 0) / b.latencies.length) : null;
        return {
          t: new Date(b.t),
          downRatio: total ? b.downTotal / total : 0,
          upCount: b.upTotal,
          downCount: b.downTotal,
          avgLatency,
        };
      });

    res.json({ hours, stepMs, host, points, generatedAt: new Date() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const kind = req.query.kind === 'generator' ? 'generator' : req.query.kind === 'all' ? null : 'grid';
    const q = kind === null ? {} : kind === 'generator' ? { kind: 'generator' } : { kind: { $in: ['grid', null] } };
    const outages = await Outage.find(q).sort({ startedAt: -1 }).limit(limit).lean();
    if (kind !== 'generator') {
      const genEvents = await Outage.find({ kind: 'generator' }).select('startedAt endedAt').lean();
      const now = Date.now();
      for (const o of outages) {
        const oStart = o.startedAt.getTime();
        const oEnd = o.endedAt ? o.endedAt.getTime() : now;
        let genMs = 0;
        for (const g of genEvents) {
          const gs = g.startedAt.getTime();
          const ge = g.endedAt ? g.endedAt.getTime() : now;
          const s = Math.max(gs, oStart);
          const e = Math.min(ge, oEnd);
          if (e > s) genMs += e - s;
        }
        o.generatorMs = genMs;
      }
    }
    res.json({ outages, kind: kind === null ? 'all' : kind });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/history/export', requireAuth, async (_req, res) => {
  try {
    const outages = await Outage.find().sort({ startedAt: 1 }).lean();
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['"kind","startedAt","endedAt","durationMs"'];
    for (const o of outages) {
      lines.push(
        `${esc(o.kind || 'grid')},${esc(o.startedAt.toISOString())},${esc(o.endedAt ? o.endedAt.toISOString() : '')},${esc(o.durationMs ?? '')}`
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="outages.csv"');
    res.send(lines.join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;