'use client';

import { useSyncExternalStore } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';

type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setTheme: (preference: ThemePreference) => void;
  toggle: () => void;
}

const THEME_CHANGE_EVENT = 'short-link-console-theme-change';
let volatileThemePreference: ThemePreference | null = null;

function getSavedPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light';
  if (volatileThemePreference !== null) return volatileThemePreference;

  try {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || saved === 'system' ? saved : 'light';
  } catch {
    return 'light';
  }
}

function getResolvedTheme(): Theme {
  const preference = getSavedPreference();
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

function getThemeSnapshot(): `${ThemePreference}:${Theme}` {
  return `${getSavedPreference()}:${getResolvedTheme()}`;
}

function subscribeToTheme(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function handleChange() {
    document.documentElement.dataset.theme = getResolvedTheme();
    onStoreChange();
  }
  window.addEventListener('storage', handleChange);
  window.addEventListener(THEME_CHANGE_EVENT, handleChange);
  mediaQuery.addEventListener('change', handleChange);

  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(THEME_CHANGE_EVENT, handleChange);
    mediaQuery.removeEventListener('change', handleChange);
  };
}

export function useTheme(): ThemeContextValue {
  const snapshot = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    (): `${ThemePreference}:${Theme}` => 'light:light',
  );
  const [preference, theme] = snapshot.split(':') as [ThemePreference, Theme];

  function setTheme(nextPreference: ThemePreference) {
    const nextTheme = nextPreference === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : nextPreference;
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('theme', nextPreference);
      volatileThemePreference = null;
    } catch {
      // The visual theme still works when browser storage is unavailable.
      volatileThemePreference = nextPreference;
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  function toggle() {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }

  return { theme, preference, setTheme, toggle };
}

export function ThemeToggle({ extraClass }: { extraClass?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useLocale();
  const label = theme === 'light' ? t('theme.toDark') : t('theme.toLight');
  const cls = extraClass ? `theme-toggle-btn ${extraClass}` : 'theme-toggle-btn';

  return (
    <button type="button" onClick={toggle} className={cls} title={label} aria-label={label}>
      {theme === 'light' ? (
        /* Moon — switch to dark */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        /* Sun — switch to light */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  );
}
