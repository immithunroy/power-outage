import { useState, useEffect } from 'react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip energy-tooltip">
      <div className="tt-title">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="tt-row">
          <span className="tt-dot" style={{ background: p.color }} />
          {p.name}: <strong>{Number(p.value).toFixed(2)} kWh</strong>
        </div>
      ))}
    </div>
  );
}

export default function HistoricalData() {
  const { t, digits: D } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.growattHistorical('', '', date)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [date]);

  const chartData = data?.historical?.map((h) => ({
    time: h.time || h.dateTime || '',
    pv: Number(h.pv || h.pvEnergy || 0),
    load: Number(h.load || h.loadEnergy || 0),
    gridImport: Number(h.gridImport || h.eToUser || 0),
    gridExport: Number(h.gridExport || h.eToGrid || 0),
    batteryCharge: Number(h.batteryCharge || h.eCharge || 0),
    batteryDischarge: Number(h.batteryDischarge || h.eDischarge || 0),
  })) || [];

  return (
    <div className="card historical-card">
      <div className="historical-header">
        <h3 className="section-title">📅 {t('historicalData')}</h3>
        <input
          type="date"
          className="date-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
        />
      </div>

      {loading ? (
        <div className="chart-loading">{t('initializing')}</div>
      ) : chartData.length === 0 ? (
        <div className="chart-empty">{t('chartAllUp')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="time"
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
            <Bar dataKey="pv" name={t('pvEnergy')} fill="var(--warn)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar dataKey="gridImport" name={t('gridImportHist')} fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar dataKey="load" name={t('loadEnergyHist')} fill="var(--text)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Line type="monotone" dataKey="batteryCharge" name={t('batteryChargeHist')} stroke="var(--success)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="batteryDischarge" name={t('batteryDischargeHist')} stroke="var(--danger)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
