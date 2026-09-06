import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import PowerFlow from '../components/PowerFlow';
import BatteryStatus from '../components/BatteryStatus';
import EnergyCharts from '../components/EnergyCharts';
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

export default function Power() {
  const { t, lang, digits: D } = useApp();
  const [status, setStatus] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [energyPeriod, setEnergyPeriod] = useState('week');
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.growattStatus();
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const id = setInterval(loadStatus, 15000);
    return () => clearInterval(id);
  }, [loadStatus]);

  useEffect(() => {
    api.growattEnergy(energyPeriod).then(setEnergy).catch(() => {});
  }, [energyPeriod]);

  if (error && !status) {
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

  if (!status || !status.enabled) {
    return (
      <div className="page power-page">
        <div className="card power-disabled-card">
          <h2 className="section-title">{t('powerDashboard')}</h2>
          <p className="section-sub">{t('powerDashboardSub')}</p>
          <div className="power-disabled">
            <span className="power-disabled-icon">🔌</span>
            <span>{status?.error || t('growattDisconnected')}</span>
            <span className="power-disabled-hint">Configure Growatt integration in Admin settings</span>
          </div>
        </div>
      </div>
    );
  }

  const solar = status.solar || {};
  const grid = status.grid || {};
  const load_ = status.load || {};
  const inverter = status.inverter || {};
  const battery = status.battery || {};
  const energyData = status.energy || {};

  return (
    <div className="page power-page">
      <div className="power-header">
        <div>
          <h2 className="section-title">⚡ {t('powerDashboard')}</h2>
          <p className="section-sub">{t('powerDashboardSub')}</p>
        </div>
        <div className="power-header-status">
          <span className={cn('status-dot', inverter.status === 'online' ? 'dot-green' : inverter.status === 'fault' ? 'dot-red' : 'dot-yellow')} />
          <span className="power-header-label">
            {inverter.status === 'online' ? t('growattOnline') : inverter.status === 'fault' ? t('growattFault') : inverter.status}
          </span>
        </div>
      </div>

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

      <PowerFlow status={status} />

      <BatteryStatus status={status} />

      <EnergyCharts
        energy={energy}
        period={energyPeriod}
        onPeriodChange={setEnergyPeriod}
      />

      <div className="card power-info-card">
        <div className="power-info-grid">
          <div className="power-info-item">
            <span className="power-info-label">{t('solarToday')}</span>
            <span className="power-info-value">{D(solar.energy_today?.toFixed(1) || '0')} kWh</span>
          </div>
          <div className="power-info-item">
            <span className="power-info-label">{t('gridImportToday')}</span>
            <span className="power-info-value">{D(grid.energy_import_today?.toFixed(1) || '0')} kWh</span>
          </div>
          <div className="power-info-item">
            <span className="power-info-label">{t('gridExportToday')}</span>
            <span className="power-info-value">{D(grid.energy_export_today?.toFixed(1) || '0')} kWh</span>
          </div>
          <div className="power-info-item">
            <span className="power-info-label">{t('loadToday')}</span>
            <span className="power-info-value">{D(energyData.load_today?.toFixed(1) || '0')} kWh</span>
          </div>
          <div className="power-info-item">
            <span className="power-info-label">{t('batteryCharge')}</span>
            <span className="power-info-value">{D(energyData.battery_charge_today?.toFixed(1) || '0')} kWh</span>
          </div>
          <div className="power-info-item">
            <span className="power-info-label">{t('batteryDischarge')}</span>
            <span className="power-info-value">{D(energyData.battery_discharge_today?.toFixed(1) || '0')} kWh</span>
          </div>
        </div>
      </div>

      <div className="card power-details-card">
        <h3 className="section-title">{t('inverterStatus')}</h3>
        <div className="power-details-grid">
          <div className="pd-item">
            <span className="pd-label">{t('inverterMode')}</span>
            <span className="pd-value">{inverter.mode || '—'}</span>
          </div>
          <div className="pd-item">
            <span className="pd-label">{t('inverterTemp')}</span>
            <span className="pd-value">{inverter.temperature ? `${D(inverter.temperature)}°C` : '—'}</span>
          </div>
          <div className="pd-item">
            <span className="pd-label">{t('gridStatus')}</span>
            <span className={cn('pd-value', grid.available ? 'text-success' : 'text-danger')}>
              {grid.available ? t('growattOnline') : t('growattOffline')}
            </span>
          </div>
          <div className="pd-item">
            <span className="pd-label">{t('gridImport')}</span>
            <span className="pd-value">{grid.voltage ? `${D(grid.voltage)}V` : '—'}</span>
          </div>
        </div>

        {(inverter.fault_code > 0 || inverter.warning_code > 0) && (
          <div className="power-alerts">
            {inverter.fault_code > 0 && (
              <div className="power-alert alert-fault">
                <span className="alert-icon">🚨</span>
                <span>{t('growattFault')}: {inverter.error_text || inverter.fault_code}</span>
              </div>
            )}
            {inverter.warning_code > 0 && (
              <div className="power-alert alert-warning">
                <span className="alert-icon">⚠️</span>
                <span>{t('growattWarning')}: {inverter.warn_text || inverter.warning_code}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
