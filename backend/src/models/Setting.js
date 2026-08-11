const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config');

const settingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'app' },
    target: { type: String, default: config.DEFAULT_TARGET, trim: true },
    method: { type: String, enum: ['ping', 'tcp'], default: 'ping' },
    port: { type: Number, default: 443 },
    intervalMs: { type: Number, default: config.DEFAULT_INTERVAL_MS, min: 5000 },
    timeoutMs: { type: Number, default: 5000 },
    confirmDown: { type: Number, default: 1, min: 1, max: 10 },
    confirmUp: { type: Number, default: 1, min: 1, max: 10 },
    adminPasswordHash: { type: String },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const Model = mongoose.model('Setting', settingSchema);

async function getSettings() {
  let doc = await Model.findById('app');
  if (!doc) {
    const hash = await bcrypt.hash(config.ADMIN_PASSWORD, 10);
    doc = await Model.create({
      _id: 'app',
      adminPasswordHash: hash,
    });
  }
  return doc;
}

async function getPublicSettings() {
  const s = await getSettings();
  return {
    target: s.target,
    method: s.method,
    port: s.port,
    intervalMs: s.intervalMs,
    timeoutMs: s.timeoutMs,
    confirmDown: s.confirmDown,
    confirmUp: s.confirmUp,
    updatedAt: s.updatedAt,
  };
}

async function updateSettings(fields) {
  const allowed = ['target', 'method', 'port', 'intervalMs', 'timeoutMs', 'confirmDown', 'confirmUp'];
  const set = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) set[key] = fields[key];
  }
  if (set.intervalMs !== undefined) set.intervalMs = Math.max(5000, Number(set.intervalMs) || 30000);
  if (set.timeoutMs !== undefined) set.timeoutMs = Math.max(1000, Number(set.timeoutMs) || 5000);
  if (set.confirmDown !== undefined) set.confirmDown = Math.min(10, Math.max(1, Number(set.confirmDown) || 1));
  if (set.confirmUp !== undefined) set.confirmUp = Math.min(10, Math.max(1, Number(set.confirmUp) || 1));
  set.updatedAt = new Date();
  return Model.findByIdAndUpdate('app', { $set: set }, { new: true, upsert: true, setDefaultsOnInsert: true });
}

async function setAdminPasswordHash(hash) {
  return Model.findByIdAndUpdate('app', { $set: { adminPasswordHash: hash } }, { new: true });
}

module.exports = { getSettings, getPublicSettings, updateSettings, setAdminPasswordHash };