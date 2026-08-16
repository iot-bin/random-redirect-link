'use client';

import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const THEME_CHANGE_EVENT = 'short-link-console-theme-change';

function getSavedTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  try {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

export function useTheme(): ThemeContextValue {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getSavedTheme,
    (): Theme => 'light',
  );

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // The visual theme still works when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return { theme, toggle };
}

export function ThemeToggle({ extraClass }: { extraClass?: string }) {
  const { theme, toggle } = useTheme();
  const label = theme === 'light' ? '切换到深色模式' : '切换到浅色模式';
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
