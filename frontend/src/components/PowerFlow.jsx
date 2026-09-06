import { useApp } from '../context/AppContext';
import { digits, cn } from '../utils';

function FlowArrow({ from, to, power, active, color }) {
  if (!active || power <= 0) return null;
  return (
    <div className={cn('flow-arrow', `flow-${from}-${to}`, 'flow-active')}>
      <div className="flow-line" style={{ background: color }} />
      <div className="flow-power">{digits(Math.round(power))}W</div>
    </div>
  );
}

function FlowNode({ icon, label, value, unit, active, color }) {
  return (
    <div className={cn('flow-node', active && 'flow-node-active')}>
      <div className="flow-node-icon" style={{ color }}>{icon}</div>
      <div className="flow-node-label">{label}</div>
      <div className="flow-node-value">
        {value != null ? `${digits(Math.round(value))}${unit}` : '—'}
      </div>
    </div>
  );
}

export default function PowerFlow({ status }) {
  const { t } = useApp();

  if (!status || status.error) {
    return (
      <div className="card power-flow-card">
        <h3 className="section-title">{t('powerFlow')}</h3>
        <div className="flow-empty">
          {status?.error || t('initializing')}
        </div>
      </div>
    );
  }

  const solar = status.power?.solar || 0;
  const gridImport = status.power?.grid_import || 0;
  const gridExport = status.power?.grid_export || 0;
  const load = status.power?.load || 0;
  const battCharge = status.power?.battery_charge || 0;
  const battDischarge = status.power?.battery_discharge || 0;

  const solarActive = solar > 0;
  const gridActive = gridImport > 0 || gridExport > 0;
  const battActive = battCharge > 0 || battDischarge > 0;
  const loadActive = load > 0;

  const solarToLoad = Math.min(solar, load);
  const solarToBattery = solar > load ? solar - load : 0;
  const gridToLoad = gridImport;
  const battToLoad = battDischarge;

  return (
    <div className="card power-flow-card">
      <h3 className="section-title">{t('powerFlow')}</h3>

      <div className="flow-diagram">
        <div className="flow-top">
          <FlowNode
            icon="☀️"
            label={t('solarPower')}
            value={solar}
            unit="W"
            active={solarActive}
            color="var(--warn)"
          />
        </div>

        <div className="flow-arrows-down">
          {solarActive && loadActive && solarToLoad > 0 && (
            <div className="flow-path flow-path-center">
              <div className="flow-arrow-v flow-arrow-solar-load" />
              <span className="flow-label">{solarToLoad}W → Load</span>
            </div>
          )}
          {solarActive && battActive && solarToBattery > 0 && (
            <div className="flow-path flow-path-right">
              <div className="flow-arrow-v flow-arrow-solar-batt" />
              <span className="flow-label">{solarToBattery}W → Battery</span>
            </div>
          )}
        </div>

        <div className="flow-middle">
          <FlowNode
            icon="⚡"
            label={t('gridStatus')}
            value={gridImport > 0 ? gridImport : gridExport > 0 ? -gridExport : 0}
            unit="W"
            active={gridActive}
            color={gridImport > 0 ? 'var(--primary)' : 'var(--success)'}
          />

          <div className="flow-inverter">
            <div className="flow-inverter-box">
              <span className="flow-inverter-icon">⚙️</span>
              <span className="flow-inverter-label">Inverter</span>
            </div>
          </div>

          <FlowNode
            icon="🏠"
            label={t('loadPower')}
            value={load}
            unit="W"
            active={loadActive}
            color="var(--text)"
          />
        </div>

        <div className="flow-arrows-down">
          {gridActive && gridImport > 0 && loadActive && (
            <div className="flow-path flow-path-left">
              <div className="flow-arrow-v flow-arrow-grid-load" />
              <span className="flow-label">{gridToLoad}W → Load</span>
            </div>
          )}
          {battActive && battDischarge > 0 && loadActive && (
            <div className="flow-path flow-path-right">
              <div className="flow-arrow-v flow-arrow-batt-load" />
              <span className="flow-label">{battToLoad}W → Load</span>
            </div>
          )}
        </div>

        <div className="flow-bottom">
          <FlowNode
            icon="🔋"
            label={t('batterySOC')}
            value={status.battery?.soc || 0}
            unit="%"
            active={battActive}
            color={battCharge > 0 ? 'var(--success)' : battDischarge > 0 ? 'var(--warn)' : 'var(--muted)'}
          />
        </div>
      </div>

      <div className="flow-legend">
        <span className="flow-legend-item">
          <span className="flow-legend-dot" style={{ background: 'var(--warn)' }} />
          {t('solarPower')}
        </span>
        <span className="flow-legend-item">
          <span className="flow-legend-dot" style={{ background: 'var(--primary)' }} />
          {t('gridStatus')}
        </span>
        <span className="flow-legend-item">
          <span className="flow-legend-dot" style={{ background: 'var(--text)' }} />
          {t('loadPower')}
        </span>
        <span className="flow-legend-item">
          <span className="flow-legend-dot" style={{ background: 'var(--success)' }} />
          {t('batterySOC')}
        </span>
      </div>
    </div>
  );
}
