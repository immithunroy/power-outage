import { useApp } from '../context/AppContext';
import { cn } from '../utils';

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value || '—'}</span>
    </div>
  );
}

function WifiBar({ strength }) {
  const pct = Math.min(100, Math.max(0, strength || 0));
  let level = 'none';
  let color = 'var(--danger)';
  if (pct > 70) { level = 'excellent'; color = 'var(--success)'; }
  else if (pct > 50) { level = 'good'; color = 'var(--success)'; }
  else if (pct > 30) { level = 'fair'; color = 'var(--warn)'; }
  else if (pct > 0) { level = 'poor'; color = 'var(--danger)'; }

  return (
    <div className="wifi-strength">
      <div className="wifi-bars">
        {[20, 40, 60, 80, 100].map((h, i) => (
          <div
            key={i}
            className={cn('wifi-bar', pct >= h && 'wifi-bar-active')}
            style={{ height: `${h}%`, background: pct >= h ? color : 'var(--border)' }}
          />
        ))}
      </div>
      <span className="wifi-pct" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function DeviceInfo({ deviceDetails, deviceInfo, wifiStrength }) {
  const { t, digits: D } = useApp();

  if (!deviceDetails && !deviceInfo && !wifiStrength) {
    return null;
  }

  const details = deviceDetails?.details;
  const info = deviceInfo?.info;
  const wifi = wifiStrength?.wifi;

  const deviceData = details?.inv?.[0] || details?.storage?.[0] || details?.max?.[0] ||
    details?.sph?.[0] || details?.spa?.[0] || details?.min?.[0] ||
    details?.wit?.[0] || details?.sphs?.[0] || details?.noah?.[0] || {};

  const wifiPct = wifi?.wifiStrength || wifi?.wifi_strength || 0;

  return (
    <div className="card device-info-card">
      <h3 className="section-title">📡 {t('deviceInfo')}</h3>

      <div className="device-info-grid">
        <div className="device-info-section">
          <h4 className="info-section-title">{t('deviceInfo')}</h4>
          <InfoRow label={t('deviceModel')} value={deviceData.model_text || deviceData.model || info?.model} />
          <InfoRow label={t('deviceSerial')} value={deviceData.serial_num || deviceData.alias} />
          <InfoRow label={t('deviceFirmware')} value={deviceData.fw_version || info?.firmwareVersion} />
          <InfoRow label={t('deviceCommVersion')} value={deviceData.communication_version || info?.commVersion} />
          <InfoRow label={t('dataloggerSn')} value={deviceData.datalogger_sn || info?.dataloggerSn} />
          <InfoRow label={t('nominalPower')} value={deviceData.nominal_power ? `${D(deviceData.nominal_power)} W` : '—'} />
          <InfoRow label={t('creationDate')} value={deviceData.create_date || info?.createDate} />
          <InfoRow label={t('lastUpdate')} value={deviceData.last_update_time_text || info?.lastUpdate} />
          <InfoRow
            label={t('status')}
            value={
              <span className={cn('status-badge', deviceData.lost ? 'badge-danger' : 'badge-success')}>
                {deviceData.lost ? t('deviceLost') : t('deviceOnline')}
              </span>
            }
          />
        </div>

        <div className="device-info-section">
          <h4 className="info-section-title">{t('wifiStrength')}</h4>
          <WifiBar strength={wifiPct} />
          {wifi?.rssi != null && (
            <InfoRow label="RSSI" value={`${wifi.rssi} dBm`} />
          )}
          {wifi?.ssid && (
            <InfoRow label="SSID" value={wifi.ssid} />
          )}

          {info && (
            <>
              <h4 className="info-section-title" style={{ marginTop: '16px' }}>Device Info</h4>
              {info.plantName && <InfoRow label="Plant" value={info.plantName} />}
              {info.inverterModel && <InfoRow label="Inverter" value={info.inverterModel} />}
              {info.batteryModel && <InfoRow label="Battery" value={info.batteryModel} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
