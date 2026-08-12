import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { elapsedClock, cn } from '../utils';

const SOURCES = [
  { key: 'grid', tKey: 'gridName', sub: 'gridOnlyHost', icon: '🏙️' },
  { key: 'generator', tKey: 'generatorName', sub: 'generatorConnectedHost', icon: '⚙️' },
  { key: 'ips', tKey: 'ipsName', sub: 'ipsConnectedHost', icon: '🔌' },
];

export default function PowerSources() {
  const { t, lang, digits } = useApp();
  const [status, setStatus] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setStatus(await api.status());
      } catch {
        /* keep last known */
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const s = status || {};
  const gridDown = s.grid?.up === false;
  const gridRun = gridDown ? s.grid?.currentOutage : null;
  const genRun = s.generator?.currentRun;

  const live = (key) => {
    const m = s[key] || {};
    if (key === 'generator') {
      return { on: m.on, latency: m.latency, run: m.currentRun };
    }
    return { on: m.up, latency: m.latency, run: key === 'grid' ? m.currentOutage : null };
  };

  return (
    <section className="card power-card">
      <div className="reports-title">
        <h2 className="section-title">🔋 {t('powerSources')}</h2>
        <p className="section-sub">{t('powerSourcesSub')}</p>
      </div>

      <div className="power-grid">
        {SOURCES.map(({ key, tKey, sub, icon }) => {
          const { on, latency, run } = live(key);
          const state = on === true ? 'on' : on === false ? 'off' : 'unknown';
          const since = gridDown && run ? run.startedAt : null;
          return (
            <div key={key} className={cn('power-tile', `power-${key}`, state)}>
              <span className="power-icon">{icon}</span>
              <div className="power-info">
                <span className="power-name">{t(tKey)}</span>
                <span className="power-sub">{t(sub)}</span>
                <span className="power-status">
                  {state === 'on' ? `✓ ${t('statusOn')}` : state === 'off' ? `✕ ${t('statusOff')}` : t('statusUnknown')}
                </span>
                <span className="power-meta">
                  {since ? `${t('ongoingDuration')} ${elapsedClock(now - new Date(since).getTime(), lang)}` : ''}
                  {latency != null ? `${since ? ' · ' : ''}${digits(latency)}ms` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {gridDown && (
        <p className="power-note">
          ⚠ {t('gridDownRunning')}{' '}
          <strong>{elapsedClock(now - new Date(gridRun.startedAt).getTime(), lang)}</strong>
          {genRun && (
            <>
              {' '}· {t('generatorRunning')}{' '}
              <strong>{elapsedClock(now - new Date(genRun.startedAt).getTime(), lang)}</strong>
            </>
          )}
        </p>
      )}
    </section>
  );
}
