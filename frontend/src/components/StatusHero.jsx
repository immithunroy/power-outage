import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useApp } from '../context/AppContext';
import { elapsedClock, fmtTime, fmtPercent, cn } from '../utils';
import { cssVar } from './Charts';

function AvailabilityPie({ pct }) {
  const { t, lang } = useApp();
  const upColor = cssVar('--success') || '#22c55e';
  const downColor = cssVar('--danger') || '#ef4444';
  const mutedColor = cssVar('--muted') || '#94a3b8';
  const cardBg = cssVar('--card') || '#ffffff';
  const border = cssVar('--border') || '#e2e8f0';
  const textColor = cssVar('--text') || '#0f172a';

  const hasVal = pct !== null && pct !== undefined && !Number.isNaN(pct);
  const data = hasVal
    ? [
        { name: t('gridAvailable'), value: pct },
        { name: t('loadShedding'), value: Math.max(0, 100 - pct) },
      ]
    : [{ name: t('unknown'), value: 100 }];

  return (
    <div className="availability-pie">
      <div className="pie-wrap">
        <PieChart width={200} height={200}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="86%"
            paddingAngle={hasVal && data[1].value > 0 ? 2 : 0}
            stroke="none"
          >
            {hasVal ? (
              <>
                <Cell key="up" fill={upColor} />
                <Cell key="down" fill={downColor} />
              </>
            ) : (
              <Cell key="na" fill={mutedColor} />
            )}
          </Pie>
          <Tooltip
            contentStyle={{
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: 10,
              color: textColor,
              fontSize: 12.5,
            }}
          />
        </PieChart>
        <div className="pie-center">
          <strong>{hasVal ? fmtPercent(pct, lang) : '—'}</strong>
        </div>
      </div>
      <div className="pie-legend">
        {hasVal ? (
          <>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: upColor }} />
              {t('gridAvailable')} · {fmtPercent(pct, lang)}
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: downColor }} />
              {t('loadShedding')} · {fmtPercent(Math.max(0, 100 - pct), lang)}
            </span>
          </>
        ) : (
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: mutedColor }} />
            {t('unknown')}
          </span>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div className="hero-meta-item">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}

function DigitalClock({ now }) {
  const { lang, digits } = useApp();
  const d = new Date(now);
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  const pad = (n) => String(n).padStart(2, '0');
  const hh = digits(pad(h));
  const mm = digits(pad(d.getMinutes()));
  return (
    <div className="digital-clock">
      <div className="dc-time">
        {hh}
        <span className="dc-sep">:</span>
        {mm}
      </div>
      <div className="dc-ampm">{ampm}</div>
    </div>
  );
}

function relative(ts, now, t, digits) {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor((now - new Date(ts).getTime()) / 1000));
  if (s < 5) return t('justNow');
  if (s < 60) return `${digits(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${digits(m)}m`;
  const h = Math.floor(m / 60);
  return `${digits(h)}h`;
}

export default function StatusHero({ status, now }) {
  const { t, lang, digits } = useApp();
  const up = status?.up ?? null;
  const cls = up === null ? 'pending' : up ? 'up' : 'down';
  const currentOutage = status?.currentOutage || null;
  const elapsed = currentOutage ? Math.max(0, now - new Date(currentOutage.startedAt).getTime()) : 0;

  const isTcp = status?.method === 'tcp';
  const methodLabel = isTcp ? `${t('methodTcp')} :${digits(status?.port ?? 443)}` : t('methodPing');

  return (
    <section className={cn('hero card', cls)}>
      <div className="hero-status">
        <div className="hero-badge">
          <span className={cn('pulse-dot', cls === 'pending' && 'dim')} />
          {t('liveIndicator')}
        </div>

        {up === null ? (
          <>
            <h1 className="hero-title">{t('initializing')}</h1>
            <p className="hero-msg">{t('tagline')}</p>
          </>
        ) : up ? (
          <>
            <h1 className="hero-title">✓ {t('gridAvailable')}</h1>
            <p className="hero-msg">{t('gridAvailableMsg')}</p>
          </>
        ) : (
          <>
            <h1 className="hero-title">⚠ {t('loadShedding')}</h1>
            <p className="hero-msg">{t('loadSheddingMsg')}</p>
          </>
        )}

        {currentOutage && (
          <div className="hero-timer">
            <span className="timer-label">{t('ongoingDuration')}</span>
            <strong className="timer-val">{elapsedClock(elapsed, lang)}</strong>
            <span className="timer-since">
              {t('since')} {fmtTime(currentOutage.startedAt, lang)}
            </span>
          </div>
        )}

        <div className="hero-meta">
          <Meta label={t('lastChecked')} value={relative(status?.lastChecked, now, t, digits)} />
          <Meta label={t('target')} value={status?.target || '—'} />
          <Meta label={t('method')} value={methodLabel} />
        </div>
      </div>

      <div className="hero-clock">
        <DigitalClock now={now} />
      </div>

      <div className="hero-side">
        <div className="hero-side-item">
          <AvailabilityPie pct={status?.last24h?.availability ?? null} />
          <p className="hero-side-label">{t('uptime24h')}</p>
        </div>
      </div>
    </section>
  );
}