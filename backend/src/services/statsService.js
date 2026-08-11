const Outage = require('../models/Outage');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// How many buckets & size per report period.
const PERIODS = {
  day: { n: 24, bucketMs: 1 * HOUR },
  week: { n: 7, bucketMs: 1 * DAY },
  month: { n: 30, bucketMs: 1 * DAY },
  quarter: { n: 13, bucketMs: 7 * DAY },
  all: { n: 24, bucketMs: 30 * DAY },
};

const VALID = Object.keys(PERIODS);

function overlapMs(o, from, to) {
  const start = o.startedAt.getTime();
  const end = o.endedAt ? o.endedAt.getTime() : to;
  if (end <= from || start >= to) return 0;
  return Math.min(end, to) - Math.max(start, from);
}

async function buildReport(period, endTime) {
  const cfg = PERIODS[period] || PERIODS.day;
  const end = endTime ? new Date(endTime).getTime() : Date.now();

  const windowStart = end - cfg.n * cfg.bucketMs;

  const outages = await Outage.find({
    startedAt: { $lt: new Date(end) },
    $or: [{ endedAt: null }, { endedAt: { $gt: new Date(windowStart) } }],
  }).lean();

  const buckets = [];
  for (let i = 0; i < cfg.n; i++) {
    const from = end - (cfg.n - i) * cfg.bucketMs;
    const to = from + cfg.bucketMs;
    const outageMs = outages.reduce((sum, o) => sum + overlapMs(o, from, to), 0);
    const count = outages.filter((o) => {
      const t = o.startedAt.getTime();
      return t >= from && t < to;
    }).length;
    buckets.push({ from: new Date(from), to: new Date(to), outageMs, count });
  }

  let totalOutageMs = 0;
  let count = 0;
  let maxOverlap = 0;
  for (const o of outages) {
    const ov = overlapMs(o, windowStart, end);
    totalOutageMs += ov;
    if (ov > maxOverlap) maxOverlap = ov;
    const t = o.startedAt.getTime();
    if (t >= windowStart && t < end) count += 1;
  }

  const totalTimeMs = cfg.n * cfg.bucketMs;
  const availability = totalTimeMs > 0 ? Math.max(0, Math.min(100, (1 - totalOutageMs / totalTimeMs) * 100)) : 100;

  const ongoing = outages.find((o) => !o.endedAt);

  return {
    period,
    end: new Date(end),
    windowStart: new Date(windowStart),
    windowMs: totalTimeMs,
    buckets,
    summary: {
      outageCount: count,
      totalOutageMs,
      ongoing: Boolean(ongoing && ongoing.startedAt.getTime() < end),
      availability: round(availability, 2),
      avgOutageMs: count > 0 ? Math.round(totalOutageMs / count) : 0,
      longestOutageMs: Math.round(maxOverlap),
      totalTimeMs,
    },
    generatedAt: new Date(),
  };
}

function round(n, p) {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

module.exports = { buildReport, PERIODS, VALID };