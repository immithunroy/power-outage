import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import PowerFlow from '../components/PowerFlow';
import BatteryStatus from '../components/BatteryStatus';
import EnergyCharts from '../components/EnergyCharts';
import DeviceInfo from '../components/DeviceInfo';
import SmartMeter from '../components/SmartMeter';
import InverterDetails from '../components/InverterDetails';
import HistoricalData from '../components/HistoricalData';
import { digits, cn } from '../utils';

function StatusCard({ icon, label, value, unit, sub, color, active }) {
  return (
    <div className={cn('power-status-card', active && 'active')}>
      <div className="psc-icon" style={{ color }}>{icon}</div>
      <div className="psc-info">
        <span className="psc-label">{label}</span>
        <span className="psc-value">
          {value != null ? `${digits(Math.round(value))}` : '—'}
          {unit && <span className="psc-unit">{unit}</span>}
        </span>
        {sub && <span className="psc-sub">{sub}</span>}
      </div>
    </div>
  );
}

function InsightCard({ icon, label, value, color }) {
  return (
    <div className="insight-card">
      <span className="insight-icon" style={{ color }}>{icon}</span>
      <span className="insight-label">{label}</span>
      <span className="insight-value" style={{ color }}>{value}</span>
    </div>
  );
}

export default function Power() {
  const { t, lang, digits: D } = useApp();
  const [dashboard, setDashboard] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [energyPeriod, setEnergyPeriod] = useState('week');
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const d = await api.growattDashboard();
      setDashboard(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const id = setInterval(loadDashboard, 15000);
    return () => clearInterval(id);
  }, [loadDashboard]);

  useEffect(() => {
    api.growattEnergy(energyPeriod).then(setEnergy).catch(() => {});
  }, [energyPeriod]);

  if (error && !dashboard) {
    return (
      <div className="page power-page">
        <div className="card power-error-card">
          <h2 className="section-title">{t('powerDashboard')}</h2>
          <p className="section-sub">{t('powerDashboardSub')}</p>
          <div className="power-error">
            <span className="power-error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard || !dashboard.status || !dashboard.status.enabled) {
    return (
      <div className="page power-page">
        <div className="card power-disabled-card">
          <h2 className="section-title">{t('powerDashboard')}</h2>
          <p className="section-sub">{t('powerDashboardSub')}</p>
          <div className="power-disabled">
            <span className="power-disabled-icon">🔌</span>
            <span>{dashboard?.status?.error || t('growattDisconnected')}</span>
            <span className="power-disabled-hint">Configure Growatt integration in Admin settings</span>
          </div>
        </div>
      </div>
    );
  }

  const status = dashboard.status;
  const solar = status.solar || {};
  const grid = status.grid || {};
  const load_ = status.load || {};
  const inverter = status.inverter || {};
  const battery = status.battery || {};
  const energyData = status.energy || {};
  const power = status.power || {};
  const deviceDetails = dashboard.deviceDetails;
  const deviceInfo = dashboard.deviceInfo;
  const wifiStrength = dashboard.wifiStrength;

  const totalSolar = solar.energy_today || 0;
  const totalGridImport = grid.energy_import_today || 0;
  const totalGridExport = grid.energy_export_today || 0;
  const totalLoad = energyData.load_today || 0;
  const selfConsumption = totalSolar > 0 ? Math.min(100, ((totalSolar - totalGridExport) / totalSolar * 100)) : 0;
  const gridDependency = totalLoad > 0 ? Math.min(100, (totalGridImport / totalLoad * 100)) : 0;
  const batteryUtil = (battery.capacityKwh || 0) > 0 ? Math.min(100, ((energyData.battery_charge_today || 0) / (battery.capacityKwh || 1) * 100)) : 0;

  return (
    <div className="page power-page">
      <div className="power-header">
        <div>
          <h2 className="section-title">⚡ {t('powerDashboard')}</h2>
          <p className="section-sub">{t('powerDashboardSub')}</p>
        </div>
        <div className="power-header-right">
          <div className="power-header-status">
            <span className={cn('status-dot', inverter.status === 'online' ? 'dot-green' : inverter.status === 'fault' ? 'dot-red' : 'dot-yellow')} />
            <span className="power-header-label">
              {inverter.status === 'online' ? t('growattOnline') : inverter.status === 'fault' ? t('growattFault') : inverter.status}
            </span>
          </div>
          {wifiStrength?.wifi?.wifiStrength != null && (
            <div className="power-header-wifi">
              <span className="wifi-icon">📶</span>
              <span className="wifi-pct">{wifiStrength.wifi.wifiStrength}%</span>
            </div>
          )}
        </div>
      </div>

      {/* System Overview */}
      <div className="section-label">{t('systemOverview')}</div>
      <div className="power-cards-grid">
        <StatusCard
          icon="☀️"
          label={t('solarPower')}
          value={solar.power}
          unit="W"
          sub={`${D(solar.energy_today?.toFixed(1) || '0')} kWh today`}
          color="var(--warn)"
          active={solar.power > 0}
        />
        <StatusCard
          icon="⚡"
          label={t('gridImport')}
          value={grid.import_power}
          unit="W"
          sub={`${D(grid.energy_import_today?.toFixed(1) || '0')} kWh today`}
          color="var(--primary)"
          active={grid.import_power > 0}
        />
        <StatusCard
          icon="🏠"
          label={t('loadPower')}
          value={load_.power}
          unit="W"
          sub={`${D(energyData.load_today?.toFixed(1) || '0')} kWh today`}
          color="var(--text)"
          active={load_.power > 0}
        />
        <StatusCard
          icon="🔋"
          label={t('batterySOC')}
          value={battery.soc}
          unit="%"
          sub={battery.chargeState === 'charging' ? t('batteryCharge') : battery.chargeState === 'discharging' ? t('batteryDischarge') : t('batteryIdle')}
          color={battery.chargeState === 'charging' ? 'var(--success)' : battery.chargeState === 'discharging' ? 'var(--warn)' : 'var(--muted)'}
          active={battery.chargeState !== 'idle'}
        />
      </div>

      {/* Energy Insights */}
      <div className="section-label">{t('energyBreakdown')}</div>
      <div className="insights-grid">
        <InsightCard icon="🔄" label={t('selfConsumption')} value={`${selfConsumption.toFixed(0)}%`} color="var(--success)" />
        <InsightCard icon="🔌" label={t('gridDependency')} value={`${gridDependency.toFixed(0)}%`} color="var(--primary)" />
        <InsightCard icon="🔋" label={t('batteryUtilization')} value={`${batteryUtil.toFixed(0)}%`} color="var(--warn)" />
        <InsightCard icon="⚡" label={t('solarTotal')} value={`${D(solar.energy_total?.toFixed(0) || '0')} kWh`} color="var(--warn)" />
        <InsightCard icon="📥" label={t('gridImportToday')} value={`${D(totalGridImport.toFixed(1))} kWh`} color="var(--primary)" />
        <InsightCard icon="📤" label={t('gridExportToday')} value={`${D(totalGridExport.toFixed(1))} kWh`} color="var(--success)" />
      </div>

      {/* Power Flow */}
      <PowerFlow status={status} />

      {/* Battery */}
      <BatteryStatus status={status} />

      {/* Energy History */}
      <EnergyCharts
        energy={energy}
        period={energyPeriod}
        onPeriodChange={setEnergyPeriod}
      />

      {/* Historical Data */}
      <HistoricalData />

      {/* Device Info */}
      <DeviceInfo
        deviceDetails={deviceDetails}
        deviceInfo={deviceInfo}
        wifiStrength={wifiStrength}
      />

      {/* Inverter Details */}
      <InverterDetails deviceDetails={deviceDetails} />

      {/* Smart Meter */}
      <SmartMeter meterData={null} />

      {/* Today's Summary */}
      <div className="card power-info-card">
        <h3 className="section-title">{t('energyBreakdown')}</h3>
        <div className="power-info-grid">
          <div className="power-info-item">
            <span className="power-info-label">{t('solarToday')}</span>
            <span className="power-info-value">{D(totalSolar.toFixed(1))} kWh</span>
          </div>
          <div className="power-info-item">
            <span className="power-info-label">{t('gridImportToday')}</span>
            <span className="power-info-value">{D(totalGridImport.toFixed(1))} kWh</span>
          </div>
          <div className="power-info-item">
            <span className="power-info-label">{t('gridExportToday')}</span>
            <span className="power-info-value">{D(totalGridExport.toFixed(1))} kWh</span>
          </div>
          <div className="power-info-item">
            <span className="power-info-label">{t('loadToday')}</span>
            <span className="power-info-value">{D(totalLoad.toFixed(1))} kWh</span>
          </div>
          <div className="power-info-item">
            <span className="power-info-label">{t('batteryCharge')}</span>
            <span className="power-info-value">{D((energyData.battery_charge_today || 0).toFixed(1))} kWh</span>
          </div>
          <div className="power-info-item">
            <span className="power-info-label">{t('batteryDischarge')}</span>
            <span className="power-info-value">{D((energyData.battery_discharge_today || 0).toFixed(1))} kWh</span>
          </div>
        </div>
      </div>
    </div>
  );
}
