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
} from 'recharts';
import { useApp } from '../context/AppContext';
import { fmtTime, fmtDate } from '../utils';

export function cssVar(name) {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;
  } catch {
    return undefined;
  }
}

export function PeriodChart({ report, themeKey }) {
  const { t, lang, digits: D } = useApp();
  const isHourly = report && report.period === 'day';

  const data = useMemo(() => {
    if (!report) return [];
    return (report.buckets || []).map((b) => ({
      from: b.from,
      to: b.to,
      outageMs: b.outageMs,
      count: b.count,
      minutes: Math.round((b.outageMs / 60000) * 10) / 10,
      label: isHourly
        ? D(fmtTime(b.from, lang, { hour: '2-digit' }).replace(/^0/, ''))
        : fmtDate(b.from, lang, { day: '2-digit', month: 'short' }),
    }));
  }, [report, lang, isHourly, D]);

  if (!report) {
    return <div className="chart-empty">{t('initializing')}</div>;
  }

  const downColor = cssVar('--danger') || '#ef4444';
  const countColor = cssVar('--primary') || '#3b82f6';
  const gridColor = cssVar('--border') || '#e2e8f0';
  const textColor = cssVar('--muted') || '#64748b';
  const hoverColor = cssVar('--hover') || 'rgba(148,163,184,.15)';
  const tooltipBg = cssVar('--card') || '#ffffff';
  const tooltipBorder = cssVar('--border') || '#e2e8f0';
  const tooltipText = cssVar('--text') || '#0f172a';

  const CustomTip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const b = payload[0].payload;
    return (
      <div className="chart-tooltip" style={{ background: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}>
        <div className="tt-title">{b.label}</div>
        <div className="tt-row">
          <span className="tt-dot" style={{ background: downColor }} />
          {t('tooltipOutage')}: <strong>{b.minutes} min</strong>
        </div>
        <div className="tt-row">
          <span className="tt-dot" style={{ background: countColor }} />
          {t('outageCount')}: <strong>{D(b.count)}</strong>
        </div>
      </div>
    );
  };

  return (
    <div className="chart-wrap" key={themeKey}>
      <h3 className="section-title">{t('chartLabel')}</h3>
      {data.length === 0 || data.every((b) => b.outageMs === 0) ? (
        <div className="chart-all-up">{t('chartAllUp')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: textColor, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: textColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => D(v)}
            />
            <YAxis yAxisId="right" orientation="right" hide domain={[0, (dataMax) => Math.max(2, dataMax)]} />
            <Tooltip content={<CustomTip />} cursor={{ fill: hoverColor }} />
            <Bar yAxisId="left" dataKey="minutes" fill={downColor} radius={[4, 4, 0, 0]} maxBarSize={34} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="count"
              stroke={countColor}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: downColor }} /> minutes down
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: countColor }} /> {t('outageCount')}
        </span>
      </div>
    </div>
  );
}

export function TimelineChart({ points, themeKey }) {
  const { t, lang, digits: D } = useApp();

  if (!points || !points.length) {
    return <div className="chart-empty">{t('initializing')}</div>;
  }

  const upColor = cssVar('--success') || '#22c55e';
  const downColor = cssVar('--danger') || '#ef4444';

  return (
    <div className="chart-wrap" key={themeKey}>
      <h3 className="section-title">{t('timelineTitle')}</h3>
      <div className="timeline-bars" role="img">
        {points.map((p, i) => {
          const ratio = p.downRatio || 0;
          const colorRatio =
            ratio <= 0 ? upColor : ratio >= 1 ? downColor : `rgba(239,68,68,${0.4 + ratio * 0.6})`;
          const tip = `${fmtTime(p.t, lang)} — ${D(Math.round(ratio * 100))}%`;
          return <div key={i} className="tl-seg" style={{ background: colorRatio }} title={tip} />;
        })}
      </div>
      <div className="chart-legend timeline-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: upColor }} /> {t('gridAvailable')}
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: downColor }} /> {t('loadShedding')}
        </span>
      </div>
    </div>
  );
}