import { useCallback, useEffect, useState } from 'react';
import { api, setToken, getToken } from '../api';
import { useApp } from '../context/AppContext';
import OutageTable from '../components/OutageTable';
import { downloadBlob, digits, cn } from '../utils';

const blankForm = {
  target: '',
  generatorTarget: '',
  ipsTarget: '',
  method: 'ping',
  port: 443,
  intervalSec: 30,
  confirmDown: 1,
  confirmUp: 1,
  timeoutSec: 5,
};

const blankGrowattForm = {
  enabled: false,
  apiToken: '',
  serverUrl: 'https://openapi.growatt.com',
  plantId: '',
  deviceSn: '',
  deviceType: 'sph',
  batteryCapacityKwh: 16,
  batteryDoD: 80,
  reserveSoc: 20,
  pollingIntervalSec: 300,
};

export default function Admin() {
  const { t, lang } = useApp();
  const [authed, setAuthed] = useState(null);
  const [pw, setPw] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [logging, setLogging] = useState(false);

  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(null);
  const [testRes, setTestRes] = useState(null);
  const [testBusy, setTestBusy] = useState(false);
  const [outages, setOutages] = useState([]);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const [growattForm, setGrowattForm] = useState(blankGrowattForm);
  const [growattBusy, setGrowattBusy] = useState(false);
  const [growattTestRes, setGrowattTestRes] = useState(null);
  const [growattTestBusy, setGrowattTestBusy] = useState(false);
  const [growattDiscoverRes, setGrowattDiscoverRes] = useState(null);
  const [growattDiscoverBusy, setGrowattDiscoverBusy] = useState(false);
  const [showGrowattToken, setShowGrowattToken] = useState(false);

  const notify = (msg, status = 'ok') => {
    setFlash({ msg, status });
    setTimeout(() => setFlash(null), 4000);
  };

  const refresh = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setForm({
        target: s.target,
        generatorTarget: s.generatorTarget,
        ipsTarget: s.ipsTarget,
        method: s.method,
        port: s.port,
        intervalSec: Math.round(s.intervalMs / 1000),
        confirmDown: s.confirmDown,
        confirmUp: s.confirmUp,
        timeoutSec: Math.round(s.timeoutMs / 1000),
      });
    } catch (e) {
      notify(t('errorGeneric'), 'err');
    }
    try {
      const hs = await api.history(10);
      setOutages(hs.outages || []);
    } catch {
      /* ignore */
    }
    try {
      const gs = await api.getGrowattSettings();
      setGrowattForm({
        enabled: gs.enabled || false,
        apiToken: '',
        serverUrl: gs.serverUrl || 'https://openapi.growatt.com',
        plantId: gs.plantId || '',
        deviceSn: gs.deviceSn || '',
        deviceType: gs.deviceType || 'sph',
        batteryCapacityKwh: gs.batteryCapacityKwh || 16,
        batteryDoD: gs.batteryDoD || 80,
        reserveSoc: gs.reserveSoc || 20,
        pollingIntervalSec: gs.pollingIntervalSec || 300,
      });
    } catch {
      /* ignore */
    }
  }, [t]);

  useEffect(() => {
    if (!getToken()) {
      setAuthed(false);
      return;
    }
    api
      .verify()
      .then(() => {
        setAuthed(true);
        refresh();
      })
      .catch(() => {
        setToken(null);
        setAuthed(false);
      });
  }, [refresh]);

  async function doLogin(e) {
    e.preventDefault();
    setLogging(true);
    setLoginErr('');
    try {
      const res = await api.login(pw);
      setToken(res.token);
      setAuthed(true);
      refresh();
    } catch {
      setLoginErr(t('invalidCredentials'));
    } finally {
      setLogging(false);
    }
  }

  function doLogout() {
    setToken(null);
    setAuthed(false);
    setPw('');
  }

  async function saveSettings(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.updateSettings({
        target: form.target,
        generatorTarget: form.generatorTarget,
        ipsTarget: form.ipsTarget,
        method: form.method,
        port: Number(form.port),
        intervalMs: Number(form.intervalSec) * 1000,
        timeoutMs: Number(form.timeoutSec) * 1000,
        confirmDown: Number(form.confirmDown),
        confirmUp: Number(form.confirmUp),
      });
      notify(t('savedOk'));
    } catch (err) {
      notify(err.message || t('errorGeneric'), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setTestBusy(true);
    setTestRes(null);
    try {
      const r = await api.testPing();
      setTestRes(r);
    } catch (err) {
      setTestRes({ ok: false, center: null, latency: null, error: err.message });
    } finally {
      setTestBusy(false);
    }
  }

  async function changePwd(e) {
    e.preventDefault();
    setPwBusy(true);
    try {
      await api.changePassword(curPw, newPw);
      setCurPw('');
      setNewPw('');
      notify(t('pwChanged'));
    } catch (err) {
      notify(err.message || t('errorGeneric'), 'err');
    } finally {
      setPwBusy(false);
    }
  }

  async function clearHistory() {
    if (!window.confirm(t('clearConfirm'))) return;
    try {
      await api.clearHistory();
      setOutages([]);
      notify(t('historyCleared'));
    } catch (err) {
      notify(err.message || t('errorGeneric'), 'err');
    }
  }

  async function exportCsv() {
    try {
      const blob = await api.exportCSV();
      downloadBlob(blob, 'outages.csv');
    } catch {
      notify(t('errorGeneric'), 'err');
    }
  }

  const setGrowatt = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setGrowattForm((f) => ({ ...f, [k]: val }));
  };

  async function saveGrowattSettings(e) {
    e.preventDefault();
    setGrowattBusy(true);
    try {
      const payload = { ...growattForm };
      if (!payload.apiToken) delete payload.apiToken;
      await api.updateGrowattSettings(payload);
      notify(t('savedOk'));
    } catch (err) {
      notify(err.message || t('errorGeneric'), 'err');
    } finally {
      setGrowattBusy(false);
    }
  }

  async function testGrowattConnection() {
    setGrowattTestBusy(true);
    setGrowattTestRes(null);
    try {
      const r = await api.testGrowatt();
      setGrowattTestRes(r);
    } catch (err) {
      setGrowattTestRes({ connected: false, error: err.message });
    } finally {
      setGrowattTestBusy(false);
    }
  }

  async function discoverGrowattDevices() {
    setGrowattDiscoverBusy(true);
    setGrowattDiscoverRes(null);
    try {
      const r = await api.discoverGrowatt();
      setGrowattDiscoverRes(r);
    } catch (err) {
      setGrowattDiscoverRes({ ok: false, error: err.message });
    } finally {
      setGrowattDiscoverBusy(false);
    }
  }

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="page admin-login">
        <form className="card login-card" onSubmit={doLogin}>
          <div className="login-head">
            <span className="login-icon">🔐</span>
            <h2 className="section-title">{t('loginTitle')}</h2>
            <p className="section-sub">{t('loginSub')}</p>
          </div>
          <label className="field">
            <span>{t('password')}</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </label>
          {loginErr && <div className="form-error">{loginErr}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={logging || !pw}>
            {logging ? t('loggingIn') + '…' : t('login')}
          </button>
        </form>
      </div>
    );
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="page admin">
      <div className="admin-head">
        <div>
          <h2 className="section-title">🔐 {t('admin')}</h2>
          <p className="section-sub">{t('probeSettingsSub')}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={doLogout}>
          {t('logout')}
        </button>
      </div>

      {flash && <div className={cn('toast', flash.status === 'err' ? 'toast-down' : 'toast-up')}>{flash.msg}</div>}

      <div className="admin-grid">
        <div className="admin-col">
          <form className="card" onSubmit={saveSettings}>
            <h3 className="section-title">{t('probeSettings')}</h3>
            <label className="field">
              <span>{t('targetLabel')}</span>
              <input type="text" value={form.target} onChange={set('target')} placeholder={t('targetPh')} required />
            </label>

            <label className="field">
              <span>{t('generatorConnectedHost')}</span>
              <input
                type="text"
                value={form.generatorTarget}
                onChange={set('generatorTarget')}
                placeholder="192.168.1.5"
              />
            </label>

            <label className="field">
              <span>{t('ipsConnectedHost')}</span>
              <input
                type="text"
                value={form.ipsTarget}
                onChange={set('ipsTarget')}
                placeholder="192.168.1.1"
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>{t('method')}</span>
                <select value={form.method} onChange={set('method')}>
                  <option value="ping">{t('methodPing')}</option>
                  <option value="tcp">{t('methodTcp')}</option>
                </select>
              </label>
              {form.method === 'tcp' && (
                <label className="field">
                  <span>{t('portLabel')}</span>
                  <input type="number" min="1" max="65535" value={form.port} onChange={set('port')} />
                </label>
              )}
            </div>

            <div className="field-row">
              <label className="field">
                <span>{t('intervalLabel')}</span>
                <input type="number" min="5" value={form.intervalSec} onChange={set('intervalSec')} />
              </label>
              <label className="field">
                <span>{t('confirmDownLabel')}</span>
                <input type="number" min="1" max="10" value={form.confirmDown} onChange={set('confirmDown')} />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>{t('confirmUpLabel')}</span>
                <input type="number" min="1" max="10" value={form.confirmUp} onChange={set('confirmUp')} />
              </label>
              <label className="field">
                <span>Timeout (s)</span>
                <input type="number" min="1" value={form.timeoutSec} onChange={set('timeoutSec')} />
              </label>
            </div>

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t('saving') + '…' : t('saveSettings')}
            </button>
          </form>

          <div className="card">
            <h3 className="section-title">{t('testNow')}</h3>
            <button type="button" className="btn btn-secondary" onClick={runTest} disabled={testBusy}>
              {testBusy ? t('testing') + '…' : t('testNow')}
            </button>
            {testRes &&
              (testRes.hosts ? (
                <div className="test-hosts">
                  {['grid', 'generator', 'ips'].map((key) => {
                    const h = testRes.hosts[key];
                    if (!h) return null;
                    const nameKey = key === 'grid' ? 'gridName' : key === 'generator' ? 'generatorName' : 'ipsName';
                    return (
                      <div
                        key={key}
                        className={cn(
                          'test-host',
                          h.configured === false ? 'test-na' : h.up ? 'test-ok' : 'test-fail'
                        )}
                      >
                        <span className="th-name">{t(nameKey)}</span>
                        <span className="th-target">{h.target || t('notConfigured')}</span>
                        {h.configured === false ? (
                          <span className="th-status">{t('statusUnknown')}</span>
                        ) : (
                          <>
                            <span className="th-status">{h.up ? t('statusOn') : t('statusOff')}</span>
                            <span className="th-lat">{h.latency != null ? `${digits(h.latency, lang)} ms` : '—'}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={cn('test-result', testRes.ok ? 'test-ok' : 'test-fail')}>
                  {testRes.ok ? t('testOk') : (testRes.error ? `${t('testFail')} (${testRes.error})` : t('testFail'))}
                  {testRes.ok && testRes.latency != null && (
                    <span className="test-latency">{digits(testRes.latency, lang)} ms</span>
                  )}
                  {testRes.settings && (
                    <div className="test-settings">
                      {testRes.settings.target} · {testRes.settings.method}
                      {testRes.settings.port}
                    </div>
                  )}
                </div>
              ))}
          </div>

          <div className="card">
            <h3 className="section-title">{t('changePassword')}</h3>
            <form onSubmit={changePwd}>
              <label className="field">
                <span>{t('currentPassword')}</span>
                <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
              </label>
              <label className="field">
                <span>{t('newPassword')}</span>
                <input
                  type="password"
                  value={newPw}
                  minLength={6}
                  onChange={(e) => setNewPw(e.target.value)}
                />
              </label>
              <button type="submit" className="btn btn-secondary" disabled={pwBusy || !curPw || newPw.length < 6}>
                {pwBusy ? '…' : t('changePw')}
              </button>
            </form>
          </div>

          <div className="card growatt-card">
            <h3 className="section-title">☀️ {t('growattIntegration')}</h3>
            <p className="section-sub">{t('growattSettings')}</p>

            <form onSubmit={saveGrowattSettings}>
              <label className="field field-checkbox">
                <input
                  type="checkbox"
                  checked={growattForm.enabled}
                  onChange={setGrowatt('enabled')}
                />
                <span>{t('growattEnable')}</span>
              </label>

              <label className="field">
                <span>{t('growattToken')}</span>
                <div className="field-with-toggle">
                  <input
                    type={showGrowattToken ? 'text' : 'password'}
                    value={growattForm.apiToken}
                    onChange={setGrowatt('apiToken')}
                    placeholder={t('growattTokenPh')}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowGrowattToken(!showGrowattToken)}
                  >
                    {showGrowattToken ? '🙈' : '👁️'}
                  </button>
                </div>
              </label>

              <label className="field">
                <span>{t('growattServer')}</span>
                <select value={growattForm.serverUrl} onChange={setGrowatt('serverUrl')}>
                  <option value="https://openapi.growatt.com">Global (openapi.growatt.com)</option>
                  <option value="https://openapi-us.growatt.com">North America (openapi-us.growatt.com)</option>
                  <option value="https://openapi-cn.growatt.com">China (openapi-cn.growatt.com)</option>
                  <option value="http://openapi-au.growatt.com">Australia/NZ (openapi-au.growatt.com)</option>
                </select>
              </label>

              <div className="field-row">
                <label className="field">
                  <span>{t('growattPlantId')}</span>
                  <input type="text" value={growattForm.plantId} onChange={setGrowatt('plantId')} placeholder="Optional" />
                </label>
                <label className="field">
                  <span>{t('growattDeviceSn')}</span>
                  <input type="text" value={growattForm.deviceSn} onChange={setGrowatt('deviceSn')} placeholder="Optional" />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>{t('growattDeviceType')}</span>
                  <select value={growattForm.deviceType} onChange={setGrowatt('deviceType')}>
                    <option value="sph">SPH (Hybrid)</option>
                    <option value="max">MAX Series</option>
                    <option value="min">MIN/TLX Series</option>
                    <option value="storage">Storage/Battery</option>
                    <option value="noah">NOAH/NEXA</option>
                    <option value="wit">WIT Devices</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t('growattBatteryCapacity')}</span>
                  <input type="number" min="0" step="0.1" value={growattForm.batteryCapacityKwh} onChange={setGrowatt('batteryCapacityKwh')} />
                </label>
                <label className="field">
                  <span>{t('growattDoD')}</span>
                  <input type="number" min="10" max="100" value={growattForm.batteryDoD} onChange={setGrowatt('batteryDoD')} />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>{t('growattReserve')}</span>
                  <input type="number" min="0" max="100" value={growattForm.reserveSoc} onChange={setGrowatt('reserveSoc')} />
                </label>
                <label className="field">
                  <span>{t('growattPolling')}</span>
                  <input type="number" min="60" value={growattForm.pollingIntervalSec} onChange={setGrowatt('pollingIntervalSec')} />
                </label>
              </div>

              <div className="growatt-actions">
                <button type="submit" className="btn btn-primary" disabled={growattBusy}>
                  {growattBusy ? t('saving') + '…' : t('saveSettings')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={testGrowattConnection} disabled={growattTestBusy}>
                  {growattTestBusy ? t('testing') + '…' : t('growattTest')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={discoverGrowattDevices} disabled={growattDiscoverBusy}>
                  {growattDiscoverBusy ? '…' : t('growattDiscover')}
                </button>
              </div>
            </form>

            {growattTestRes && (
              <div className={cn('test-result', growattTestRes.connected ? 'test-ok' : 'test-fail')}>
                {growattTestRes.connected ? (
                  <>
                    <span>✅ {t('growattConnected')}</span>
                    {growattTestRes.plantName && <span>{t('growattPlantName')}: {growattTestRes.plantName}</span>}
                    {growattTestRes.inverterModel && <span>{t('growattInverterModel')}: {growattTestRes.inverterModel}</span>}
                    {growattTestRes.batteryModel && <span>{t('growattBatteryModel')}: {growattTestRes.batteryModel}</span>}
                  </>
                ) : (
                  <span>❌ {growattTestRes.error || t('growattDisconnected')}</span>
                )}
              </div>
            )}

            {growattDiscoverRes && growattDiscoverRes.ok && (
              <div className="growatt-discover">
                {growattDiscoverRes.plants?.length > 0 && (
                  <div className="discover-section">
                    <h4>Plants</h4>
                    {growattDiscoverRes.plants.map((p) => (
                      <div key={p.plantId} className="discover-item">
                        <span>{p.plantName || p.plantId}</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGrowattForm((f) => ({ ...f, plantId: p.plantId }))}>
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {growattDiscoverRes.devices?.length > 0 && (
                  <div className="discover-section">
                    <h4>Devices</h4>
                    {growattDiscoverRes.devices.map((d) => (
                      <div key={d.deviceSn} className="discover-item">
                        <span>{d.alias || d.deviceSn} ({d.deviceType})</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGrowattForm((f) => ({ ...f, deviceSn: d.deviceSn }))}>
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card danger-card">
            <h3 className="section-title">{t('dangerZone')}</h3>
            <div className="danger-actions">
              <button type="button" className="btn btn-ghost" onClick={exportCsv}>
                📥 {t('exportCSV')}
              </button>
              <button type="button" className="btn btn-danger" onClick={clearHistory} disabled={busy}>
                🗑 {t('clearHistory')}
              </button>
            </div>
          </div>
        </div>

        <div className="admin-col">
          <div className="card">
            <OutageTable outages={outages} limit={10} />
          </div>
        </div>
      </div>
    </div>
  );
}