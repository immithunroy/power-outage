import { useApp } from '../context/AppContext';
import { fmtDateTime, formatDuration, cn } from '../utils';

export default function OutageTable({ outages, limit }) {
  const { t, lang } = useApp();
  const rows = outages ? outages.slice(0, limit || outages.length) : [];

  return (
    <div>
      <h3 className="section-title">{t('recentOutages')}</h3>
      {!rows.length ? (
        <div className="no-outages">{t('noOutages')} 🎉</div>
      ) : (
        <div className="table-wrap">
          <table className="outage-table">
            <thead>
              <tr>
                <th>{t('started')}</th>
                <th>{t('ended')}</th>
                <th>{t('duration')}</th>
                <th>{t('generator')}</th>
                <th>{t('statusCol')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const ongoing = !o.endedAt;
                return (
                  <tr key={o._id}>
                    <td data-label={t('started')}>{fmtDateTime(o.startedAt, lang)}</td>
                    <td data-label={t('ended')}>{ongoing ? '—' : fmtDateTime(o.endedAt, lang)}</td>
                    <td data-label={t('duration')}>
                      {ongoing ? (
                        <span className="badge ongoing">{t('ongoingBadge')}</span>
                      ) : (
                        formatDuration(o.durationMs, lang)
                      )}
                    </td>
                    <td data-label={t('generator')}>
                      {o.generatorMs ? formatDuration(o.generatorMs, lang) : t('notConsumed')}
                    </td>
                    <td data-label={t('statusCol')}>
                      <span className={cn('status-chip', ongoing ? 'chip-down' : 'chip-up')}>
                        {ongoing ? t('ongoingBadge') : t('recovered')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}