const express = require('express');
const { getStatusSnapshot } = require('../services/pinger');

const router = express.Router();

router.get('/status', async (_req, res) => {
  try {
    res.json(await getStatusSnapshot());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;