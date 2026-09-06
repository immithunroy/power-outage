const express = require('express');
const { getPublicGrowattSettings, updateGrowattSettings } = require('../models/GrowattSetting');
const growattService = require('../services/growattService');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.get('/growatt/status', async (_req, res) => {
  try {
    const status = await growattService.getRealtimeStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/growatt/energy', async (req, res) => {
  try {
    const period = ['day', 'week', 'month', 'quarter', 'all'].includes(req.query.period)
      ? req.query.period
      : 'week';
    const data = await growattService.getEnergyHistory(period);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/growatt/alarms', async (_req, res) => {
  try {
    const data = await growattService.getAlarms();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/growatt/settings', requireAuth, async (_req, res) => {
  try {
    const settings = await getPublicGrowattSettings();
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/growatt/settings', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const sanitized = {};

    if (body.enabled !== undefined) sanitized.enabled = Boolean(body.enabled);
    if (body.apiToken !== undefined) sanitized.apiToken = String(body.apiToken).trim();
    if (body.serverUrl !== undefined) sanitized.serverUrl = String(body.serverUrl).trim();
    if (body.plantId !== undefined) sanitized.plantId = String(body.plantId).trim();
    if (body.deviceSn !== undefined) sanitized.deviceSn = String(body.deviceSn).trim();
    if (body.deviceType !== undefined) sanitized.deviceType = String(body.deviceType).trim();
    if (body.batteryCapacityKwh !== undefined) sanitized.batteryCapacityKwh = Number(body.batteryCapacityKwh);
    if (body.batteryDoD !== undefined) sanitized.batteryDoD = Number(body.batteryDoD);
    if (body.reserveSoc !== undefined) sanitized.reserveSoc = Number(body.reserveSoc);
    if (body.pollingIntervalSec !== undefined) sanitized.pollingIntervalSec = Number(body.pollingIntervalSec);

    if (sanitized.enabled && !sanitized.apiToken) {
      const { getGrowattSettings } = require('../models/GrowattSetting');
      const current = await getGrowattSettings();
      if (!current.apiToken) {
        return res.status(400).json({ error: 'API token is required to enable integration' });
      }
    }

    await updateGrowattSettings(sanitized);
    res.json({ ok: true, settings: await getPublicGrowattSettings() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/growatt/test', requireAuth, async (_req, res) => {
  try {
    const result = await growattService.testConnection();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/growatt/discover', requireAuth, async (_req, res) => {
  try {
    const result = await growattService.discoverDevices();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/growatt/meters', requireAuth, async (req, res) => {
  try {
    const datalogSn = req.query.datalog_sn;
    if (!datalogSn) return res.status(400).json({ error: 'datalog_sn is required' });
    const data = await growattService.getSmartMeters(datalogSn);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/growatt/meters/data', requireAuth, async (req, res) => {
  try {
    const { datalog_sn, address } = req.query;
    if (!datalog_sn || !address) return res.status(400).json({ error: 'datalog_sn and address are required' });
    const data = await growattService.getSmartMeterData(datalog_sn, address);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/growatt/v4/details', requireAuth, async (req, res) => {
  try {
    const { deviceSn, deviceType } = req.query;
    const data = await growattService.getDeviceDetailsV4(deviceSn, deviceType);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/growatt/v4/power', requireAuth, async (req, res) => {
  try {
    const { deviceSn, deviceType } = req.query;
    const data = await growattService.getPowerRealtimeV4(deviceSn, deviceType);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/growatt/v4/device-info', requireAuth, async (req, res) => {
  try {
    const { deviceSn, deviceType } = req.query;
    const data = await growattService.getDeviceInfoV4(deviceSn, deviceType);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/growatt/v4/wifi', requireAuth, async (req, res) => {
  try {
    const { deviceSn, deviceType } = req.query;
    const data = await growattService.getWifiStrengthV4(deviceSn, deviceType);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/growatt/v4/historical', requireAuth, async (req, res) => {
  try {
    const { deviceSn, deviceType, date } = req.query;
    const data = await growattService.getHistoricalDataV4(deviceSn, deviceType, date);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
