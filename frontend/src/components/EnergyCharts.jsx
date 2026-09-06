import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { fmtDate, cn } from '../utils';

const PERIODS = [
  { key: 'day', tKey: 'period24h' },
  { key: 'week', tKey: 'period7d' },
  { key: 'month', tKey: 'period30d' },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip energy-tooltip">
      <div className="tt-title">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="tt-row">
          <span className="tt-dot" style={{ background: p.color }} />
          {p.name}: <strong>{Number(p.value).toFixed(1)} kWh</strong>
        </div>
      ))}
    </div>
  );
}

export default function EnergyCharts({ energy, period, onPeriodChange }) {
  const { t, lang, digits: D } = useApp();

  const data = useMemo(() => {
    if (!energy || !energy.points) return [];
    return energy.points.map((p) => ({
      name: p.date || '',
      label: fmtDate(p.date, lang, { day: '2-digit', month: 'short' }),
      solar: Number(p.solar) || 0,
      gridImport: Number(p.grid_import) || 0,
      gridExport: Number(p.grid_export) || 0,
      load: Number(p.load) || 0,
      batteryCharge: Number(p.battery_charge) || 0,
      batteryDischarge: Number(p.battery_discharge) || 0,
    }));
  }, [energy, lang]);

  if (!energy || energy.error) {
    return (
      <div className="card energy-chart-card">
        <h3 className="section-title">{t('energyHistory')}</h3>
        <div className="chart-empty">{energy?.error || t('initializing')}</div>
      </div>
    );
  }

  return (
    <div className="card energy-chart-card">
      <div className="energy-chart-header">
        <h3 className="section-title">{t('energyHistory')}</h3>
        <div className="period-tabs" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              className={cn('period-tab', period === p.key && 'active')}
              onClick={() => onPeriodChange(p.key)}
            >
              {t(p.tKey)}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="chart-empty">{t('chartAllUp')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
            />
            <YAxis
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => D(v)}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--hover)' }} />
            <Legend />
            <Bar dataKey="solar" name={t('solarPower')} fill="var(--warn)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="gridImport" name={t('gridImport')} fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="load" name={t('loadPower')} fill="var(--text)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line type="monotone" dataKey="batteryDischarge" name={t('batteryDischarge')} stroke="var(--danger)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="batteryCharge" name={t('batteryCharge')} stroke="var(--success)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
