import { useApp } from '../context/AppContext';
import { digits, formatDuration, cn } from '../utils';

function SOCBar({ soc, reserve }) {
  const usable = Math.max(0, soc - reserve);
  return (
    <div className="soc-bar-wrap">
      <div className="soc-bar">
        <div
          className="soc-bar-fill"
          style={{ width: `${soc}%` }}
        />
        {reserve > 0 && (
          <div
            className="soc-bar-reserve"
            style={{ width: `${reserve}%` }}
          />
        )}
      </div>
      <div className="soc-bar-labels">
        <span>{digits(soc)}%</span>
        {reserve > 0 && <span className="soc-reserve-label">Reserve: {digits(reserve)}%</span>}
      </div>
    </div>
  );
}

export default function BatteryStatus({ status }) {
  const { t, lang, digits: D } = useApp();

  if (!status || !status.battery) {
    return (
      <div className="card battery-card">
        <h3 className="section-title">{t('batterySOC')}</h3>
        <div className="battery-empty">{t('initializing')}</div>
      </div>
    );
  }

  const bat = status.battery;
  const backup = status.backup;
  const soc = bat.soc || 0;
  const reserve = status.settings?.reserveSoc || 20;
  const usableCapacity = bat.usableCapacityKwh || 0;
  const remainingKwh = bat.remainingUsableKwh || 0;
  const power = bat.power || 0;
  const isCharging = power > 0;
  const isDischarging = power < 0;

  let chargeState = 'idle';
  let chargeColor = 'var(--muted)';
  if (isCharging) { chargeState = 'charging'; chargeColor = 'var(--success)'; }
  else if (isDischarging) { chargeState = 'discharging'; chargeColor = 'var(--warn)'; }

  return (
    <div className="card battery-card">
      <div className="battery-header">
        <h3 className="section-title">🔋 {t('batterySOC')}</h3>
        <span className={cn('battery-state-badge', `state-${chargeState}`)}>
          {chargeState === 'charging' ? t('batteryCharge') : chargeState === 'discharging' ? t('batteryDischarge') : t('batteryIdle')}
        </span>
      </div>

      <div className="battery-body">
        <div className="battery-gauge">
          <div className="gauge-circle">
            <svg viewBox="0 0 120 120" className="gauge-svg">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke={chargeColor}
                strokeWidth="8"
                strokeDasharray={`${soc * 3.267} 326.7`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="gauge-center">
              <span className="gauge-value">{D(soc)}</span>
              <span className="gauge-unit">%</span>
            </div>
          </div>
        </div>

        <div className="battery-info">
          <SOCBar soc={soc} reserve={reserve} />

          <div className="battery-stats">
            <div className="bstat">
              <span className="bstat-label">{t('batteryPower')}</span>
              <span className={cn('bstat-value', isCharging && 'text-success', isDischarging && 'text-warn')}>
                {isCharging ? '+' : isDischarging ? '' : ''}{D(Math.round(Math.abs(power)))}W
              </span>
            </div>
            <div className="bstat">
              <span className="bstat-label">{t('batteryRemaining')}</span>
              <span className="bstat-value">{D(remainingKwh.toFixed(1))} kWh</span>
            </div>
            <div className="bstat">
              <span className="bstat-label">{t('batteryUsable')}</span>
              <span className="bstat-value">{D(usableCapacity.toFixed(1))} kWh</span>
            </div>
            {backup?.remaining_display && (
              <div className="bstat">
                <span className="bstat-label">{t('backupRuntime')}</span>
                <span className="bstat-value bstat-highlight">{backup.remaining_display}</span>
              </div>
            )}
            {bat.temperature > 0 && (
              <div className="bstat">
                <span className="bstat-label">Temp</span>
                <span className="bstat-value">{D(bat.temperature.toFixed(1))}°C</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {bat.health && bat.health !== 'good' && (
        <div className={cn('battery-alert', `alert-${bat.health}`)}>
          {bat.health === 'fault' ? t('growattFault') : t('growattWarning')}
        </div>
      )}
    </div>
  );
}
