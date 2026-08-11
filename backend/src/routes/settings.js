const express = require('express');
const bcrypt = require('bcryptjs');
const { getPublicSettings, updateSettings, setAdminPasswordHash, getSettings } = require('../models/Setting');
const { restartLoop, testOnce } = require('../services/pinger');
const requireAuth = require('../middleware/auth');
const Outage = require('../models/Outage');
const Ping = require('../models/Ping');

const router = express.Router();

router.use(requireAuth);

router.get('/settings', async (_req, res) => {
  try {
    res.json(await getPublicSettings());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const body = req.body || {};
    const sanitized = {};
    if (body.target !== undefined) sanitized.target = String(body.target).trim();
    if (body.method !== undefined) sanitized.method = body.method === 'tcp' ? 'tcp' : 'ping';
    if (body.port !== undefined) sanitized.port = Math.min(65535, Math.max(1, Number(body.port) || 443));
    if (body.intervalMs !== undefined) sanitized.intervalMs = Number(body.intervalMs);
    if (body.timeoutMs !== undefined) sanitized.timeoutMs = Number(body.timeoutMs);
    if (body.confirmDown !== undefined) sanitized.confirmDown = Number(body.confirmDown);
    if (body.confirmUp !== undefined) sanitized.confirmUp = Number(body.confirmUp);

    if ('target' in sanitized && !sanitized.target) {
      return res.status(400).json({ error: 'target is required' });
    }

    const updated = await updateSettings(sanitized);
    restartLoop();
    res.json({ ok: true, settings: await getPublicSettings(), updatedAt: updated.updatedAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/settings/test', async (_req, res) => {
  try {
    const started = Date.now();
    const { settings, result } = await testOnce();
    res.json({ ok: true, startedAt: new Date(started), settings, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/settings/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const settings = await getSettings();
    const ok = await bcrypt.compare(String(currentPassword || ''), settings.adminPasswordHash);
    if (!ok) return res.status(401).json({ error: 'current password is incorrect' });
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'new password must be at least 6 characters' });
    }
    const hash = await bcrypt.hash(String(newPassword), 10);
    await setAdminPasswordHash(hash);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/settings/clear-history', async (_req, res) => {
  try {
    await Promise.all([Outage.deleteMany({}), Ping.deleteMany({})]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;