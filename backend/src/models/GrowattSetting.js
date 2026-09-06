const mongoose = require('mongoose');

const growattSettingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'growatt' },
    enabled: { type: Boolean, default: false },
    apiToken: { type: String, default: '' },
    serverUrl: { type: String, default: 'https://openapi.growatt.com' },
    plantId: { type: String, default: '' },
    deviceSn: { type: String, default: '' },
    deviceType: { type: String, default: 'sph', enum: ['sph', 'max', 'min', 'noah', 'storage', 'wit'] },
    batteryCapacityKwh: { type: Number, default: 16, min: 0 },
    batteryDoD: { type: Number, default: 80, min: 10, max: 100 },
    reserveSoc: { type: Number, default: 20, min: 0, max: 100 },
    pollingIntervalSec: { type: Number, default: 300, min: 60 },
    lastSyncAt: { type: Date, default: null },
    lastSyncStatus: { type: String, enum: ['ok', 'error', null], default: null },
    lastSyncError: { type: String, default: null },
    discoveredPlantName: { type: String, default: '' },
    discoveredInverterModel: { type: String, default: '' },
    discoveredBatteryModel: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const Model = mongoose.model('GrowattSetting', growattSettingSchema);

async function getGrowattSettings() {
  let doc = await Model.findById('growatt');
  if (!doc) {
    doc = await Model.create({ _id: 'growatt' });
  }
  return doc;
}

async function getPublicGrowattSettings() {
  const s = await getGrowattSettings();
  return {
    enabled: s.enabled,
    plantId: s.plantId,
    deviceSn: s.deviceSn,
    deviceType: s.deviceType,
    batteryCapacityKwh: s.batteryCapacityKwh,
    batteryDoD: s.batteryDoD,
    reserveSoc: s.reserveSoc,
    pollingIntervalSec: s.pollingIntervalSec,
    lastSyncAt: s.lastSyncAt,
    lastSyncStatus: s.lastSyncStatus,
    discoveredPlantName: s.discoveredPlantName,
    discoveredInverterModel: s.discoveredInverterModel,
    discoveredBatteryModel: s.discoveredBatteryModel,
  };
}

async function updateGrowattSettings(fields) {
  const allowed = [
    'enabled', 'apiToken', 'serverUrl', 'plantId', 'deviceSn', 'deviceType',
    'batteryCapacityKwh', 'batteryDoD', 'reserveSoc', 'pollingIntervalSec',
  ];
  const set = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) set[key] = fields[key];
  }
  if (set.batteryCapacityKwh !== undefined) set.batteryCapacityKwh = Math.max(0, Number(set.batteryCapacityKwh) || 16);
  if (set.batteryDoD !== undefined) set.batteryDoD = Math.min(100, Math.max(10, Number(set.batteryDoD) || 80));
  if (set.reserveSoc !== undefined) set.reserveSoc = Math.min(100, Math.max(0, Number(set.reserveSoc) || 20));
  if (set.pollingIntervalSec !== undefined) set.pollingIntervalSec = Math.max(60, Number(set.pollingIntervalSec) || 300);
  set.updatedAt = new Date();
  return Model.findByIdAndUpdate('growatt', { $set: set }, { new: true, upsert: true, setDefaultsOnInsert: true });
}

async function setGrowattSyncStatus(status, error) {
  const set = { lastSyncAt: new Date(), lastSyncStatus: status };
  if (error) set.lastSyncError = String(error).slice(0, 500);
  else set.lastSyncError = '';
  return Model.findByIdAndUpdate('growatt', { $set: set }, { new: true });
}

async function setGrowattDiscovery(info) {
  const set = {};
  if (info.plantName !== undefined) set.discoveredPlantName = info.plantName;
  if (info.inverterModel !== undefined) set.discoveredInverterModel = info.inverterModel;
  if (info.batteryModel !== undefined) set.discoveredBatteryModel = info.batteryModel;
  set.updatedAt = new Date();
  return Model.findByIdAndUpdate('growatt', { $set: set }, { new: true });
}

module.exports = {
  getGrowattSettings,
  getPublicGrowattSettings,
  updateGrowattSettings,
  setGrowattSyncStatus,
  setGrowattDiscovery,
};
