import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { cn } from '../utils';

export default function Navbar() {
  const { t, lang, setLang, theme, toggleTheme, bn } = useApp();
  const { pathname } = useLocation();
  const onAdmin = pathname.startsWith('/admin');
  const onPower = pathname.startsWith('/power');

  return (
    <header className="navbar">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-text">
            {t('appName')}
            <small>{t('appSub')}</small>
          </span>
        </Link>
        <nav className="nav-actions">
          <Link to="/" className={cn('nav-link', !onAdmin && !onPower && 'active')}>
            {t('home')}
          </Link>
          <Link to="/power" className={cn('nav-link', onPower && 'active')}>
            ⚡ {t('powerDashboard')}
          </Link>
          <Link to="/admin" className={cn('nav-link', onAdmin && 'active')}>
            <span className="nav-lock">🔐</span> {t('admin')}
          </Link>
          <span className="nav-sep" />
          <button type="button" className="icon-btn" onClick={() => setLang(bn ? 'en' : 'bn')} title="Language">
            {bn ? 'EN' : 'বাং'}
          </button>
          <button type="button" className="icon-btn" onClick={toggleTheme} title="Theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </nav>
      </div>
    </header>
  );
}