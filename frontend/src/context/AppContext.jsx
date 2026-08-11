import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations';
import { digits, toBn } from '../utils';

const AppContext = createContext(null);

function initialTheme() {
  const saved = localStorage.getItem('outage_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  const [lang, setLang] = useState(() => localStorage.getItem('outage_lang') || 'en');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('outage_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    localStorage.setItem('outage_lang', lang);
  }, [lang]);

  const value = useMemo(() => {
    const dict = translations[lang] || translations.en;
    const t = (key) => dict[key] ?? translations.en[key] ?? key;
    return {
      theme,
      lang,
      bn: lang === 'bn',
      t,
      digits: (n) => digits(n, lang),
      toBn,
      setLang,
      setTheme,
      toggleTheme: () => setTheme((cur) => (cur === 'dark' ? 'light' : 'dark')),
    };
  }, [theme, lang]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}