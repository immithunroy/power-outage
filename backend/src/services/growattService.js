const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getGrowattSettings, setGrowattSyncStatus, setGrowattDiscovery } = require('../models/GrowattSetting');

const cache = {
  status: null,
  statusAt: 0,
  energy: null,
  energyAt: 0,
  alarms: null,
  alarmsAt: 0,
  deviceDetails: null,
  deviceDetailsAt: 0,
  powerRealtime: null,
  powerRealtimeAt: 0,
  deviceInfo: null,
  deviceInfoAt: 0,
  wifiStrength: null,
  wifiStrengthAt: 0,
};

const CACHE_TTL_MS = 30000;
const CACHE_LONG_TTL_MS = 300000;

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(options.headers || {}),
      },
      timeout: 15000,
    };

    const req = mod.request(reqOpts, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ result: 1, error: 'invalid JSON', raw: body });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Growatt API timeout'));
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

function buildBaseUrl(settings) {
  const base = (settings.serverUrl || 'https://openapi.growatt.com').replace(/\/+$/, '');
  return `${base}/v1`;
}

function buildV4BaseUrl(settings) {
  const base = (settings.serverUrl || 'https://openapi.growatt.com').replace(/\/+$/, '');
  return `${base}/v4/new-api`;
}

function authHeaders(settings) {
  return { token: settings.apiToken };
}

async function testConnection() {
  const settings = await getGrowattSettings();
  if (!settings.apiToken) throw new Error('API token not configured');
  if (!settings.enabled) throw new Error('Growatt integration is disabled');

  const base = buildBaseUrl(settings);
  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  // Try V4 API first (more stable), fall back to V1
  let plantRes;
  try {
    const deviceListRes = await request(`${v4Base}/queryDeviceList`, {
      method: 'POST',
      headers,
      body: 'page=1&pageSize=100',
    });
    if (deviceListRes.code === 0 && deviceListRes.data?.count > 0) {
      // V4 API works, use device list response
      plantRes = { result: 0, plants: [{ plantId: 'v4', plantName: 'V4 API Account' }] };
    }
  } catch {
    // V4 not available, try V1
  }

  if (!plantRes) {
    plantRes = await request(`${base}/plant/list?page=1&perpage=1`, { headers });
  }

  if (plantRes.result !== 0 && !plantRes.plants?.length) {
    const msg = plantRes.error || plantRes.msg || 'No plants found';
    await setGrowattSyncStatus('error', msg);
    throw new Error(msg);
  }

  const plant = plantRes.plants[0];
  const plantName = plant.plantName || plant.name || '';

  let inverterModel = '';
  let batteryModel = '';
  let deviceSn = settings.deviceSn;

  try {
    const deviceRes = await request(`${base}/device/list?plantId=${plant.plantId}&page=1&perpage=50`, { headers });
    if (deviceRes.result === 0 && deviceRes.devices) {
      for (const d of deviceRes.devices) {
        if (!deviceSn && d.deviceType === 'inverter') {
          deviceSn = d.deviceSn || d.sn || '';
        }
        if (d.deviceType === 'inverter') inverterModel = d.model || d.deviceType || '';
        if (d.deviceType === 'storage') batteryModel = d.model || d.deviceType || '';
      }
    }
  } catch {
    // ignore discovery errors
  }

  await setGrowattSyncStatus('ok');
  await setGrowattDiscovery({
    plantName,
    inverterModel: inverterModel || 'Unknown',
    batteryModel: batteryModel || 'Unknown',
  });

  if (deviceSn && !settings.deviceSn) {
    const { updateGrowattSettings } = require('../models/GrowattSetting');
    await updateGrowattSettings({ deviceSn });
  }

  return {
    connected: true,
    plantId: plant.plantId,
    plantName,
    deviceSn,
    inverterModel,
    batteryModel,
  };
}

async function discoverDevices() {
  const settings = await getGrowattSettings();
  if (!settings.apiToken) throw new Error('API token not configured');

  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  // Try V4 API first
  try {
    const deviceListRes = await request(`${v4Base}/queryDeviceList`, {
      method: 'POST',
      headers,
      body: 'page=1&pageSize=100',
    });

    if (deviceListRes.code === 0 && deviceListRes.data) {
      const devices = (deviceListRes.data.data || []).map((d) => ({
        deviceSn: d.deviceSn || d.sn || '',
        deviceType: d.deviceType || '',
        model: d.model || '',
        alias: d.alias || '',
        status: d.status || '',
        dataloggerSn: d.dataloggerSn || '',
      }));

      return {
        plants: [{ plantId: 'v4', plantName: 'V4 API Account' }],
        devices,
      };
    }
  } catch {
    // V4 failed, fall back to V1
  }

  // Fall back to V1 API
  const base = buildBaseUrl(settings);
  const plantRes = await request(`${base}/plant/list?page=1&perpage=50`, { headers });
  if (plantRes.result !== 0) throw new Error(plantRes.error || 'Failed to list plants');

  const plants = (plantRes.plants || []).map((p) => ({
    plantId: p.plantId,
    plantName: p.plantName || p.name || '',
    capacity: p.capacity || 0,
  }));

  let devices = [];
  if (plants.length > 0) {
    const targetPlantId = settings.plantId || plants[0].plantId;
    const deviceRes = await request(`${base}/device/list?plantId=${targetPlantId}&page=1&perpage=50`, { headers });
    if (deviceRes.result === 0 && deviceRes.devices) {
      devices = deviceRes.devices.map((d) => ({
        deviceSn: d.deviceSn || d.sn || '',
        deviceType: d.deviceType || '',
        model: d.model || '',
        alias: d.alias || '',
        status: d.status || '',
      }));
    }
  }

  return { plants, devices };
}

function normalizeStorageData(raw, settings) {
  if (!raw || !raw.data) {
    return {
      battery: { soc: 0, voltage: 0, current: 0, power: 0, temperature: 0, chargeState: 'unknown', health: 'unknown' },
      power: { battery_charge: 0, battery_discharge: 0 },
      energy: { battery_charge_today: 0, battery_discharge_today: 0, battery_charge_total: 0, battery_discharge_total: 0 },
    };
  }

  const d = raw.data;
  const capacityKwh = settings.batteryCapacityKwh || 16;
  const dodPct = settings.batteryDoD || 80;
  const usableCapacityKwh = capacityKwh * (dodPct / 100);

  // Handle V4 field names (soc can be 'capacity', 'soc', 'bmsSoc')
  const socPct = Number(d.capacity || d.soc || d.bmsSoc) || 0;

  let chargeState = 'idle';
  // Handle V4 field names (power can be 'pCharge' or 'chargePower')
  const pCharge = Number(d.pCharge || d.chargePower) || 0;
  const pDischarge = Number(d.pDischarge || d.dischargePower) || 0;
  if (pCharge > 0) chargeState = 'charging';
  else if (pDischarge > 0) chargeState = 'discharging';

  let health = 'good';
  const bmsStatus = Number(d.bmsStatus) || 0;
  if (bmsStatus !== 0) health = 'warning';
  if (d.bmsError && d.bmsError !== 0) health = 'fault';

  return {
    battery: {
      soc: socPct,
      voltage: Number(d.vBat || d.batteryVoltage) || 0,
      current: Number(d.bmsCurrent || d.batteryCurrent) || 0,
      power: pCharge > 0 ? pCharge : -pDischarge,
      temperature: Number(d.batTemp || d.bmsTemperature || d.batteryTemperature) || 0,
      chargeState,
      health,
      capacityKwh,
      usableCapacityKwh,
      remainingUsableKwh: usableCapacityKwh * (socPct / 100),
      cycleCount: Number(d.cycleCount || d.batteryCycleCount) || 0,
    },
    power: {
      battery_charge: pCharge,
      battery_discharge: pDischarge,
    },
    energy: {
      battery_charge_today: Number(d.eChargeToday || d.chargeEnergyToday) || 0,
      battery_discharge_today: Number(d.eDischargeToday || d.dischargeEnergyToday) || 0,
      battery_charge_total: Number(d.eChargeTotal || d.chargeEnergyTotal) || 0,
      battery_discharge_total: Number(d.eDischargeTotal || d.dischargeEnergyTotal) || 0,
    },
    raw: {
      bmsStatus: d.bmsStatus,
      bmsError: d.bmsError,
      errorCode: d.errorCode,
      warnCode: d.warnCode,
      faultCode: d.faultCode,
    },
  };
}

function normalizeInverterData(raw, settings) {
  if (!raw || !raw.data) {
    return {
      solar: { power: 0, energy_today: 0, energy_total: 0 },
      grid: { available: false, voltage: 0, frequency: 0, import_power: 0, export_power: 0 },
      load: { power: 0, energy_today: 0 },
      inverter: { status: 'unknown', mode: 'unknown', output_power: 0, temperature: 0, efficiency: 0 },
    };
  }

  const d = raw.data;
  const ppv = Number(d.ppv || d.pvPower || d.pv1Power) || 0;
  const pacToUser = Number(d.pacToUser || d.loadPower || d.outputPower) || 0;
  const pacToGrid = Number(d.pacToGrid || d.gridPower || d.toGridPower) || 0;
  const pGrid = Number(d.pGrid || d.gridPowerTotal) || 0;

  let gridImport = 0;
  let gridExport = 0;
  if (pGrid > 0) gridImport = pGrid;
  else gridExport = Math.abs(pGrid);
  if (pacToGrid > 0) gridExport = pacToGrid;

  let inverterStatus = 'online';
  if (d.errorCode && d.errorCode !== 0) inverterStatus = 'fault';
  else if (d.warnCode && d.warnCode !== 0) inverterStatus = 'warning';

  let mode = 'unknown';
  if (d.workMode != null) mode = String(d.workMode);
  else if (d.runMode != null) mode = String(d.runMode);

  const loadPower = pacToUser || Math.max(0, ppv + gridImport - gridExport - (Number(d.pCharge) || 0));

  return {
    solar: {
      power: ppv,
      energy_today: Number(d.epvToday || d.eToday || d.energyDay) || 0,
      energy_total: Number(d.epvTotal || d.eTotal || d.energyTotal) || 0,
      voltage: Number(d.vpv || d.vpv1 || d.pv1Voltage) || 0,
      current: Number(d.ipv || d.ipv1 || d.pv1Current) || 0,
    },
    grid: {
      available: true,
      voltage: Number(d.vac || d.vAc1 || d.gridVoltage) || 0,
      frequency: Number(d.fac || d.fac1 || d.gridFrequency) || 0,
      import_power: gridImport,
      export_power: gridExport,
      energy_import_today: Number(d.eToUserToday || d.loadEnergyToday) || 0,
      energy_import_total: Number(d.eToUserTotal || d.loadEnergyTotal) || 0,
      energy_export_today: Number(d.eToGridToday || d.gridEnergyToday) || 0,
      energy_export_total: Number(d.eToGridTotal || d.gridEnergyTotal) || 0,
    },
    load: {
      power: loadPower,
      energy_today: Number(d.eLoadToday || d.loadEnergyToday) || 0,
    },
    inverter: {
      status: inverterStatus,
      mode,
      output_power: pacToUser + pacToGrid,
      input_power: ppv,
      temperature: Number(d.temperature || d.ipmTemperature || d.innerTemperature) || 0,
      efficiency: 0,
      fault_code: Number(d.errorCode || d.faultCode) || 0,
      warning_code: Number(d.warnCode) || 0,
      error_text: d.errorText || '',
      warn_text: d.warnText || '',
    },
    raw: {
      workMode: d.workMode,
      runMode: d.runMode,
      vBus: d.vBus,
      iAc: d.iacToUser,
    },
  };
}

async function getRealtimeStatus() {
  const now = Date.now();
  if (cache.status && now - cache.statusAt < CACHE_TTL_MS) return cache.status;

  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) {
    return { enabled: false, error: 'Growatt integration not configured' };
  }

  const base = buildBaseUrl(settings);
  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  try {
    let inverterData = null;
    let storageData = null;

    // Try V4 API first (more stable and unified)
    if (settings.deviceSn) {
      try {
        // V4 API: queryLastData works for all device types
        const deviceType = settings.deviceType || 'sph';
        const v4Res = await request(`${v4Base}/queryLastData`, {
          method: 'POST',
          headers,
          body: `deviceSn=${settings.deviceSn}&deviceType=${deviceType}`,
        });

        if (v4Res.code === 0 && v4Res.data) {
          const deviceData = v4Res.data[deviceType];
          if (deviceData && deviceData.length > 0) {
            const d = deviceData[0];
            // V4 response has similar structure to V1
            inverterData = { data: d };
            storageData = { data: d };
          }
        }
      } catch {
        // V4 failed, fall back to V1
      }
    }

    // Fall back to V1 API if V4 didn't work
    if (!inverterData && !storageData) {
      if (settings.deviceSn) {
        const deviceTypeRes = await request(`${base}/device/get_device_type?deviceSn=${settings.deviceSn}`, { headers });
        const deviceType = deviceTypeRes.deviceType || deviceTypeRes.data?.deviceType || 'inverter';

        if (deviceType === 'storage') {
          storageData = await request(`${base}/device/storage/storage_last_data`, {
            method: 'POST',
            headers,
            body: `storageSn=${settings.deviceSn}`,
          });
        } else {
          inverterData = await request(`${base}/device/inverter/last_new_data?deviceSn=${settings.deviceSn}`, { headers });
        }
      }

      if (!inverterData && settings.plantId) {
        try {
          const deviceRes = await request(`${base}/device/list?plantId=${settings.plantId}&page=1&perpage=50`, { headers });
          if (deviceRes.result === 0 && deviceRes.devices) {
            for (const d of deviceRes.devices) {
              const sn = d.deviceSn || d.sn;
              const type = d.deviceType || '';
              if (type === 'storage' && !storageData) {
                storageData = await request(`${base}/device/storage/storage_last_data`, {
                  method: 'POST',
                  headers,
                  body: `storageSn=${sn}`,
                });
              } else if (!inverterData) {
                inverterData = await request(`${base}/device/inverter/last_new_data?deviceSn=${sn}`, { headers });
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }

    const inverter = normalizeInverterData(inverterData, settings);
    const storage = normalizeStorageData(storageData, settings);

    const batteryPct = storage.battery.soc;
    const remainingKwh = storage.battery.remainingUsableKwh;
    const loadKw = inverter.load.power / 1000;
    const backupHours = loadKw > 0 ? remainingKwh / loadKw : null;

    const result = {
      enabled: true,
      serverTime: new Date(),
      solar: inverter.solar,
      grid: inverter.grid,
      load: inverter.load,
      inverter: inverter.inverter,
      battery: storage.battery,
      power: {
        solar: inverter.solar.power,
        grid_import: inverter.grid.import_power,
        grid_export: inverter.grid.export_power,
        load: inverter.load.power,
        battery_charge: storage.power.battery_charge,
        battery_discharge: storage.power.battery_discharge,
      },
      energy: {
        solar_today: inverter.solar.energy_today,
        grid_import_today: inverter.grid.energy_import_today,
        grid_export_today: inverter.grid.energy_export_today,
        load_today: inverter.load.energy_today,
        battery_charge_today: storage.energy.battery_charge_today,
        battery_discharge_today: storage.energy.battery_discharge_today,
      },
      backup: {
        remaining_hours: backupHours,
        remaining_display: backupHours != null ? formatHours(backupHours) : null,
        estimated: true,
      },
      alarms: {
        fault_code: storage.raw.faultCode || inverter.inverter.fault_code,
        warn_code: storage.raw.warnCode || inverter.inverter.warning_code,
        error_text: inverter.inverter.error_text,
        warn_text: inverter.inverter.warn_text,
      },
      last_updated: new Date(),
    };

    cache.status = result;
    cache.statusAt = now;

    await setGrowattSyncStatus('ok');
    return result;
  } catch (err) {
    await setGrowattSyncStatus('error', err.message);
    return { enabled: true, error: err.message, last_updated: new Date() };
  }
}

function formatHours(h) {
  if (!Number.isFinite(h) || h < 0) return '0h 0m';
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

async function getEnergyHistory(period) {
  const now = Date.now();
  if (cache.energy && now - cache.energyAt < 60000) return cache.energy;

  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) {
    return { enabled: false, error: 'Not configured' };
  }

  const base = buildBaseUrl(settings);
  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  try {
    let days = 1;
    if (period === 'week') days = 7;
    else if (period === 'month') days = 30;
    else if (period === 'quarter') days = 90;
    else if (period === 'all') days = 365;

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);
    const fmt = (d) => d.toISOString().slice(0, 10);

    let data = [];

    // Try V4 API first (supports up to 95 days of history)
    if (days <= 95) {
      try {
        const deviceType = settings.deviceType || 'sph';
        const v4Res = await request(`${v4Base}/queryEnergyData`, {
          method: 'POST',
          headers,
          body: `deviceSn=${settings.deviceSn}&deviceType=${deviceType}&startDate=${fmt(startDate)}&endDate=${fmt(endDate)}`,
        });

        if (v4Res.code === 0 && v4Res.data?.length) {
          data = v4Res.data;
        }
      } catch {
        // V4 failed, fall back to V1
      }
    }

    // Fall back to V1 API
    if (!data.length && settings.deviceSn) {
      const res = await request(`${base}/device/inverter/data?deviceSn=${settings.deviceSn}&startDate=${fmt(startDate)}&endDate=${fmt(endDate)}&page=1&perpage=200`, { headers });
      if (res.result === 0 && res.data) {
        data = Array.isArray(res.data) ? res.data : [res.data];
      }
    }

    const points = data.map((d) => ({
      date: d.date || d.day || d.dateTime || '',
      solar: Number(d.epv || d.ePv || d.pvEnergy || d.solarEnergy) || 0,
      grid_import: Number(d.eToUser || d.eGridImport || d.gridImportEnergy) || 0,
      grid_export: Number(d.eToGrid || d.eGridExport || d.gridExportEnergy) || 0,
      load: Number(d.eLoad || d.loadEnergy) || 0,
      battery_charge: Number(d.eCharge || d.chargeEnergy) || 0,
      battery_discharge: Number(d.eDischarge || d.dischargeEnergy) || 0,
    }));

    const result = { enabled: true, period, points, generatedAt: new Date() };
    cache.energy = result;
    cache.energyAt = now;
    return result;
  } catch (err) {
    return { enabled: true, period, points: [], error: err.message, generatedAt: new Date() };
  }
}

async function getSmartMeters(datalogSn) {
  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) return { meters: [] };

  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  try {
    const res = await request(`${v4Base}/device/ammeter/meter_list?datalog_sn=${datalogSn}&page=1&perpage=20`, { headers });
    if (res.error_code === 0 && res.data?.meters) {
      return { meters: res.data.meters };
    }
    return { meters: [] };
  } catch {
    return { meters: [] };
  }
}

async function getSmartMeterData(datalogSn, address) {
  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) return null;

  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  try {
    const res = await request(`${v4Base}/device/ammeter/meter_last_data?datalog_sn=${datalogSn}&address=${address}`, { headers });
    if (res.error_code === 0 && res.data) {
      return res.data;
    }
    return null;
  } catch {
    return null;
  }
}

async function getDeviceDetailsV4(deviceSn, deviceType) {
  const now = Date.now();
  if (cache.deviceDetails && now - cache.deviceDetailsAt < CACHE_LONG_TTL_MS) return cache.deviceDetails;

  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) return { enabled: false, error: 'Not configured' };

  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  try {
    const type = deviceType || settings.deviceType || 'sph';
    const sn = deviceSn || settings.deviceSn;
    if (!sn) return { enabled: false, error: 'No device serial number' };

    const res = await request(`${v4Base}/device/details`, {
      method: 'POST',
      headers,
      body: `deviceSn=${sn}&deviceType=${type}`,
    });

    if (res.code === 0 && res.data) {
      const result = { enabled: true, details: res.data, generatedAt: new Date() };
      cache.deviceDetails = result;
      cache.deviceDetailsAt = now;
      return result;
    }
    return { enabled: false, error: res.message || 'Failed to get device details' };
  } catch (err) {
    return { enabled: false, error: err.message };
  }
}

async function getPowerRealtimeV4(deviceSn, deviceType) {
  const now = Date.now();
  if (cache.powerRealtime && now - cache.powerRealtimeAt < CACHE_TTL_MS) return cache.powerRealtime;

  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) return { enabled: false, error: 'Not configured' };

  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  try {
    const type = deviceType || settings.deviceType || 'sph';
    const sn = deviceSn || settings.deviceSn;
    if (!sn) return { enabled: false, error: 'No device serial number' };

    const res = await request(`${v4Base}/queryPowerRealtime`, {
      method: 'POST',
      headers,
      body: `deviceSn=${sn}&deviceType=${type}`,
    });

    if (res.code === 0 && res.data) {
      const result = { enabled: true, power: res.data, generatedAt: new Date() };
      cache.powerRealtime = result;
      cache.powerRealtimeAt = now;
      return result;
    }
    return { enabled: false, error: res.message || 'Failed to get power data' };
  } catch (err) {
    return { enabled: false, error: err.message };
  }
}

async function getDeviceInfoV4(deviceSn, deviceType) {
  const now = Date.now();
  if (cache.deviceInfo && now - cache.deviceInfoAt < CACHE_LONG_TTL_MS) return cache.deviceInfo;

  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) return { enabled: false, error: 'Not configured' };

  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  try {
    const type = deviceType || settings.deviceType || 'sph';
    const sn = deviceSn || settings.deviceSn;
    if (!sn) return { enabled: false, error: 'No device serial number' };

    const res = await request(`${v4Base}/device/deviceInfo`, {
      method: 'POST',
      headers,
      body: `deviceSn=${sn}&deviceType=${type}`,
    });

    if (res.code === 0 && res.data) {
      const result = { enabled: true, info: res.data, generatedAt: new Date() };
      cache.deviceInfo = result;
      cache.deviceInfoAt = now;
      return result;
    }
    return { enabled: false, error: res.message || 'Failed to get device info' };
  } catch (err) {
    return { enabled: false, error: err.message };
  }
}

async function getWifiStrengthV4(deviceSn, deviceType) {
  const now = Date.now();
  if (cache.wifiStrength && now - cache.wifiStrengthAt < CACHE_LONG_TTL_MS) return cache.wifiStrength;

  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) return { enabled: false, error: 'Not configured' };

  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  try {
    const type = deviceType || settings.deviceType || 'sph';
    const sn = deviceSn || settings.deviceSn;
    if (!sn) return { enabled: false, error: 'No device serial number' };

    const res = await request(`${v4Base}/device/wifiStrength`, {
      method: 'POST',
      headers,
      body: `deviceSn=${sn}&deviceType=${type}`,
    });

    if (res.code === 0 && res.data) {
      const result = { enabled: true, wifi: res.data, generatedAt: new Date() };
      cache.wifiStrength = result;
      cache.wifiStrengthAt = now;
      return result;
    }
    return { enabled: false, error: res.message || 'Failed to get WiFi strength' };
  } catch (err) {
    return { enabled: false, error: err.message };
  }
}

async function getHistoricalDataV4(deviceSn, deviceType, date) {
  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) return { enabled: false, error: 'Not configured' };

  const v4Base = buildV4BaseUrl(settings);
  const headers = authHeaders(settings);

  try {
    const type = deviceType || settings.deviceType || 'sph';
    const sn = deviceSn || settings.deviceSn;
    if (!sn) return { enabled: false, error: 'No device serial number' };

    const dateStr = date || new Date().toISOString().slice(0, 10);

    const res = await request(`${v4Base}/queryHistoricalData`, {
      method: 'POST',
      headers,
      body: `deviceSn=${sn}&deviceType=${type}&date=${dateStr}`,
    });

    if (res.code === 0 && res.data) {
      return { enabled: true, historical: res.data, date: dateStr, generatedAt: new Date() };
    }
    return { enabled: false, error: res.message || 'Failed to get historical data' };
  } catch (err) {
    return { enabled: false, error: err.message };
  }
}

async function getAlarms() {
  const now = Date.now();
  if (cache.alarms && now - cache.alarmsAt < 60000) return cache.alarms;

  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) return { enabled: false, alarms: [] };

  const base = buildBaseUrl(settings);
  const headers = authHeaders(settings);

  try {
    let alarms = [];
    if (settings.deviceSn) {
      const res = await request(`${base}/device/inverter/alarm?deviceSn=${settings.deviceSn}&page=1&perpage=50`, { headers });
      if (res.result === 0 && res.data) {
        alarms = (Array.isArray(res.data) ? res.data : []).map((a) => ({
          code: a.errorCode || a.code || '',
          message: a.message || a.errorText || '',
          time: a.time || a.date || '',
          level: a.level || 'unknown',
        }));
      }
    }

    const result = { enabled: true, alarms, generatedAt: new Date() };
    cache.alarms = result;
    cache.alarmsAt = now;
    return result;
  } catch (err) {
    return { enabled: true, alarms: [], error: err.message };
  }
}

async function ensurePoller() {
  const settings = await getGrowattSettings();
  if (!settings.enabled || !settings.apiToken) return;

  const interval = (settings.pollingIntervalSec || 300) * 1000;
  console.log('[growatt] starting poller every', settings.pollingIntervalSec, 's');

  async function poll() {
    try {
      await getRealtimeStatus();
    } catch (e) {
      console.error('[growatt] poll error:', e.message);
    }
  }

  await poll();
  setInterval(poll, interval);
}

module.exports = {
  testConnection,
  discoverDevices,
  getRealtimeStatus,
  getEnergyHistory,
  getAlarms,
  getSmartMeters,
  getSmartMeterData,
  getDeviceDetailsV4,
  getPowerRealtimeV4,
  getDeviceInfoV4,
  getWifiStrengthV4,
  getHistoricalDataV4,
  ensurePoller,
};
