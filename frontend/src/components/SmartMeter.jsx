import { useApp } from '../context/AppContext';

function MeterValue({ label, value, unit }) {
  return (
    <div className="meter-value">
      <span className="meter-label">{label}</span>
      <span className="meter-number">
        {value != null ? `${value}` : '—'}
        {unit && <span className="meter-unit">{unit}</span>}
      </span>
    </div>
  );
}

export default function SmartMeter({ meterData }) {
  const { t, digits: D } = useApp();

  if (!meterData) return null;

  return (
    <div className="card smart-meter-card">
      <h3 className="section-title">📊 {t('smartMeter')}</h3>

      <div className="meter-grid">
        <div className="meter-phase">
          <h4 className="meter-phase-title">L1</h4>
          <MeterValue label={t('voltageL1')} value={meterData.voltageL1 ? D(Number(meterData.voltageL1).toFixed(1)) : '—'} unit="V" />
          <MeterValue label={t('currentL1')} value={meterData.currentL1 ? D(Number(meterData.currentL1).toFixed(2)) : '—'} unit="A" />
          <MeterValue label={t('activePower')} value={meterData.activePowerL1 ? D(Math.round(meterData.activePowerL1)) : '—'} unit="W" />
        </div>

        <div className="meter-phase">
          <h4 className="meter-phase-title">L2</h4>
          <MeterValue label={t('voltageL2')} value={meterData.voltageL2 ? D(Number(meterData.voltageL2).toFixed(1)) : '—'} unit="V" />
          <MeterValue label={t('currentL2')} value={meterData.currentL2 ? D(Number(meterData.currentL2).toFixed(2)) : '—'} unit="A" />
          <MeterValue label={t('activePower')} value={meterData.activePowerL2 ? D(Math.round(meterData.activePowerL2)) : '—'} unit="W" />
        </div>

        <div className="meter-phase">
          <h4 className="meter-phase-title">L3</h4>
          <MeterValue label={t('voltageL3')} value={meterData.voltageL3 ? D(Number(meterData.voltageL3).toFixed(1)) : '—'} unit="V" />
          <MeterValue label={t('currentL3')} value={meterData.currentL3 ? D(Number(meterData.currentL3).toFixed(2)) : '—'} unit="A" />
          <MeterValue label={t('activePower')} value={meterData.activePowerL3 ? D(Math.round(meterData.activePowerL3)) : '—'} unit="W" />
        </div>
      </div>

      <div className="meter-summary">
        <MeterValue label={t('activePower')} value={meterData.activeEnergy ? D(Number(meterData.activeEnergy).toFixed(1)) : '—'} unit="kWh" />
        <MeterValue label={t('reactivePower')} value={meterData.reactivePower ? D(Math.round(meterData.reactivePower)) : '—'} unit="VAR" />
        {meterData.timeText && (
          <MeterValue label={t('lastUpdate')} value={meterData.timeText} />
        )}
      </div>
    </div>
  );
}
