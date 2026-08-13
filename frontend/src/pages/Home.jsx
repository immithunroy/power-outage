import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import StatusHero from '../components/StatusHero';
import PowerSources from '../components/PowerSources';
import { PeriodChart, TimelineChart } from '../components/Charts';
import OutageTable from '../components/OutageTable';
import { fmtDate, fmtPercent, formatDuration, downsample, cn } from '../utils';

const PERIODS = ['day', 'week', 'month', 'quarter', 'all'];

const CARD_META = {
  outageCount: { icon: '⏱️' },
  totalDownTime: { icon: '⏳', highlight: true },
  availability: { icon: '📶' },
  longestOutage: { icon: '🛑' },
  avgOutage: { icon: '📏' },
};

export default function Home() {
  const { t, lang, theme, digits } = useApp();
  const [now, setNow] = useState(Date.now());
  const [status, setStatus] = useState(null);
  const [report, setReport] = useState(null);
  const [genReport, setGenReport] = useState(null);
  const [points, setPoints] = useState(null);
  const [genPoints, setGenPoints] = useState(null);
  const [outages, setOutages] = useState([]);
  const [period, setPeriod] = useState('day');
  const [genPeriod, setGenPeriod] = useState('day');
  const [histPeriod, setHistPeriod] = useState('all');
  const [toast, setToast] = useState(null);
  const toastRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const notify = useCallback((msg, type) => {
    toastRef.current += 1;
    const id = toastRef.current;
    setToast({ id, msg, type });
    setTimeout(() => {
      setToast((cur) => (cur && cur.id === id ? null : cur));
    }, 5000);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus((prev) => {
        if (prev && prev.up !== null && s.up !== null && prev.up !== s.up) {
          notify(
            s.up ? t('gridAvailable') : t('loadShedding'),
            s.up ? 'up' : 'down'
          );
        }
        return s;
      });
    } catch {
      /* keep last known status */
    }
  }, [notify, t]);

  useEffect(() => {
    loadStatus();
    const id = setInterval(loadStatus, 5000);
    return () => clearInterval(id);
  }, [loadStatus]);

  useEffect(() => {
    api
      .stats(period)
      .then(setReport)
      .catch(() => {});
  }, [period]);

  useEffect(() => {
    api
      .stats(genPeriod, 'generator')
      .then(setGenReport)
      .catch(() => {});
  }, [genPeriod]);

  useEffect(() => {
    const load = async () => {
      try {
        const tl = await api.timeline('grid');
        setPoints(downsample(tl.points, 288));
      } catch {
        /* ignore */
      }
      try {
        const gt = await api.timeline('generator');
        setGenPoints(downsample(gt.points, 288));
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .history(15, undefined, histPeriod)
      .then((hs) => {
        if (alive) setOutages(hs.outages || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [histPeriod]);

  const summary = report?.summary || null;
  const genSummary = genReport?.summary || null;
  const windowLabel =
    report && summary
      ? `${fmtDate(report.windowStart, lang)} – ${fmtDate(report.end, lang)}`
      : '—';

  return (
    <div className="page home">
      {toast && (
        <div className={cn('toast', toast.type === 'up' ? 'toast-up' : 'toast-down')}>
          {toast.type === 'up' ? '✅' : '⚠️'} {toast.msg}
        </div>
      )}

      <StatusHero status={status} now={now} />

      <PowerSources />

      <section className="card reports">
        <div className="reports-head">
          <div className="reports-title">
            <h2 className="section-title">{t('reportsTitle')}</h2>
            <p className="section-sub">{t('reportsSub')}</p>
          </div>
          <div className="period-tabs" role="tablist">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                className={cn('period-tab', period === p && 'active')}
                onClick={() => setPeriod(p)}
              >
                {t(`period${p[0].toUpperCase()}${p.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="stats-grid">
          {summary && (
            <>
              {Object.entries(CARD_META).map(([key, meta]) => {
                let value = '—';
                if (key === 'outageCount') value = digits(summary.outageCount);
                else if (key === 'totalDownTime') value = formatDuration(summary.totalOutageMs, lang);
                else if (key === 'availability') value = fmtPercent(summary.availability, lang);
                else if (key === 'longestOutage') value = formatDuration(summary.longestOutageMs, lang);
                else if (key === 'avgOutage') value = formatDuration(summary.avgOutageMs, lang);
                return (
                  <div key={key} className={cn('stat-card', meta.highlight && 'highlight-red')}>
                    <span className="stat-icon">{meta.icon}</span>
                    <span className="stat-value">{value}</span>
                    <span className="stat-label">{t(key)}</span>
                  </div>
                );
              })}
              <div className="stat-card">
                <span className="stat-icon">🗓️</span>
                <span className="stat-value stat-value-sm">{windowLabel}</span>
                <span className="stat-label">{t('windowCovered')}</span>
              </div>
            </>
          )}
        </div>

        <PeriodChart report={report} themeKey={theme} />
      </section>

      <section className="card">
        <TimelineChart points={points} themeKey={theme} />
      </section>

      <section className="card reports">
        <div className="reports-head">
          <div className="reports-title">
            <h2 className="section-title">⚙️ {t('genRunReport')}</h2>
            <p className="section-sub">{t('genRunReportSub')}</p>
          </div>
          <div className="period-tabs" role="tablist">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={genPeriod === p}
                className={cn('period-tab', genPeriod === p && 'active')}
                onClick={() => setGenPeriod(p)}
              >
                {t(`period${p[0].toUpperCase()}${p.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="stats-grid">
          {genSummary && (
            <>
              <div className="stat-card highlight-green">
                <span className="stat-icon">⏱️</span>
                <span className="stat-value">{formatDuration(genSummary.totalOutageMs, lang)}</span>
                <span className="stat-label">{t('genRunTime')}</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">🔄</span>
                <span className="stat-value">{digits(genSummary.outageCount)}</span>
                <span className="stat-label">{t('genRunCount')}</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">📈</span>
                <span className="stat-value">{formatDuration(genSummary.longestOutageMs, lang)}</span>
                <span className="stat-label">{t('genLongestRun')}</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">📏</span>
                <span className="stat-value">{formatDuration(genSummary.avgOutageMs, lang)}</span>
                <span className="stat-label">{t('genAvgRun')}</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">🧭</span>
                <span className="stat-value">{fmtPercent(genSummary.occupancyPct, lang)}</span>
                <span className="stat-label">{t('genOnPercent')}</span>
              </div>
            </>
          )}
        </div>

        <PeriodChart
          report={genReport}
          themeKey={`${theme}-gen`}
          title={t('genOnPercent')}
          tooltipLabel={t('genOnPercent')}
          metricLabel={t('chartMinutesRunning')}
          emptyMsg={t('chartNoRun')}
        />
      </section>

      <section className="card">
        <TimelineChart
          points={genPoints}
          themeKey={`${theme}-gen-tl`}
          title={t('genTimelineTitle')}
          upLabel={t('genOff')}
          downLabel={t('genRunning')}
        />
      </section>

      <section className="card reports">
        <div className="reports-head">
          <div className="reports-title">
            <h2 className="section-title">{t('recentOutages')}</h2>
            <p className="section-sub">{t('recentOutagesSub')}</p>
          </div>
          <div className="period-tabs" role="tablist">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={histPeriod === p}
                className={cn('period-tab', histPeriod === p && 'active')}
                onClick={() => setHistPeriod(p)}
              >
                {t(`period${p[0].toUpperCase()}${p.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>
        <OutageTable outages={outages} limit={12} />
      </section>

      <footer className="footer">{t('footerNote')}</footer>
    </div>
  );
}
