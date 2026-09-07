import { useApp } from '../context/AppContext';
import { cn } from '../utils';

function SettingRow({ label, value, type }) {
  let display = value;
  if (type === 'bool') display = value ? '✓' : '✗';
  else if (type === 'pct') display = `${value}%`;
  else if (type === 'power') display = `${value}W`;
  else if (type === 'time' && value) display = value;

  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <span className={cn('setting-value', type === 'bool' && (value ? 'text-success' : 'text-muted'))}>
        {display || '—'}
      </span>
    </div>
  );
}

export default function InverterDetails({ deviceDetails }) {
  const { t, digits: D } = useApp();

  if (!deviceDetails?.details) return null;

  const d = deviceDetails.details;
  const device = d.inv?.[0] || d.storage?.[0] || d.max?.[0] ||
    d.sph?.[0] || d.spa?.[0] || d.min?.[0] || d.wit?.[0] || d.noah?.[0];

  if (!device) return null;

  return (
    <div className="card inverter-details-card">
      <h3 className="section-title">⚙️ {t('inverterDetails')}</h3>

      <div className="inverter-grid">
        <div className="inverter-section">
          <h4 className="info-section-title">{t('inverterSettings')}</h4>
          <SettingRow label={t('acChargeEnabled')} value={device.ac_charge_enable} type="bool" />
          <SettingRow label={t('chargePowerLimit')} value={device.charge_power_command} type="pct" />
          <SettingRow label={t('dischargePowerLimit')} value={device.discharge_power_command} type="pct" />
          <SettingRow label={t('exportLimit')} value={device.export_limit} type="power" />
          <SettingRow label={t('offGridMode')} value={device.spa_off_grid_enable || device.mix_off_grid_enable} type="bool" />
          <SettingRow label={t('epsEnabled')} value={device.eps_fun_en} type="bool" />
          <SettingRow label={t('vppOpen')} value={device.vpp_open} type="bool" />
        </div>

        <div className="inverter-section">
          <h4 className="info-section-title">{t('inverterStatus')}</h4>
          <SettingRow label={t('inverterMode')} value={device.status_text || device.status} />
          <SettingRow label={t('inverterTemp')} value={device.ipm_temperature ? `${D(device.ipm_temperature)}°C` : device.temperature ? `${D(device.temperature)}°C` : '—'} />
          <SettingRow label="SOC" value={device.capacity != null ? `${device.capacity}%` : device.bmsSoc ? `${device.bmsSoc}%` : '—'} />
          <SettingRow label={t('batteryPower')} value={device.p_charge ? `+${D(device.p_charge)}W` : device.p_discharge ? `${D(device.p_discharge)}W` : '—'} />
          {device.priority_choose != null && (
            <SettingRow
              label={t('priorityChoose')}
              value={device.priority_choose === 0 ? t('loadFirst') : device.priority_choose === 1 ? t('batteryFirst') : t('gridFirst')}
            />
          )}
          <SettingRow label="E Today" value={device.e_today != null ? `${D(device.e_today)} kWh` : '—'} />
          <SettingRow label="E Total" value={device.e_total != null ? `${D(device.e_total)} kWh` : '—'} />
        </div>

        {(device.forced_charge_time_start1 || device.forced_discharge_time_start1 || device.charge_time1) && (
          <div className="inverter-section inverter-schedule">
            <h4 className="info-section-title">{t('chargeSchedule')}</h4>
            {device.forced_charge_time_start1 && (
              <SettingRow label={t('forceChargeTime')} value={`${device.forced_charge_time_start1} → ${device.forced_charge_time_stop1}`} type="time" />
            )}
            {device.forced_discharge_time_start1 && (
              <SettingRow label={t('forceDischargeTime')} value={`${device.forced_discharge_time_start1} → ${device.forced_discharge_time_stop1}`} type="time" />
            )}
            {device.charge_time1 && (
              <SettingRow label={t('gridChargeTime')} value={`${device.charge_time1}`} type="time" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
