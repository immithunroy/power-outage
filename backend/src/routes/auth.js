const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getSettings } = require('../models/Setting');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { password } = req.body || {};
    const settings = await getSettings();
    const ok = await bcrypt.compare(String(password || ''), settings.adminPasswordHash);
    if (!ok) return res.status(401).json({ error: 'invalid password' });
    const token = jwt.sign({ role: 'admin' }, config.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/verify', requireAuth, (req, res) => {
  res.json({ ok: true, role: req.user.role });
});

module.exports = router;