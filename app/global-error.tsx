'use client';

import { useSyncExternalStore } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  normalizeLocale,
  type Locale,
} from '@/lib/i18n/config';
import { messages } from '@/lib/i18n/messages';

function subscribeToLocale() {
  return () => {};
}

function getServerLocale(): Locale {
  return DEFAULT_LOCALE;
}

function getBrowserLocale(): Locale {
  const prefix = `${LOCALE_COOKIE}=`;
  const cookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));

  if (!cookie) return DEFAULT_LOCALE;

  try {
    return normalizeLocale(decodeURIComponent(cookie.slice(prefix.length)));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getBrowserLocale,
    getServerLocale,
  );
  const copy = messages[locale];

  return (
    <html lang={locale}>
      <body style={styles.body}>
        <main style={styles.card} role="alert">
          <p style={styles.code}>500</p>
          <h1 style={styles.title}>{copy['error.title']}</h1>
          <p style={styles.description}>{copy['error.description']}</p>
          <button style={styles.button} type="button" onClick={reset}>
            {copy['error.retry']}
          </button>
        </main>
      </body>
    </html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    minHeight: '100vh',
    margin: 0,
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    boxSizing: 'border-box',
    background: '#f6f7f9',
    color: '#111827',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: 'min(100%, 520px)',
    padding: 32,
    boxSizing: 'border-box',
    border: '1px solid #d9dde5',
    borderRadius: 16,
    background: '#ffffff',
    textAlign: 'center',
  },
  code: {
    margin: '0 0 8px',
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.12em',
  },
  title: {
    margin: '0 0 12px',
    fontSize: 24,
  },
  description: {
    margin: '0 0 24px',
    color: '#4b5563',
    lineHeight: 1.6,
  },
  button: {
    minHeight: 40,
    padding: '0 16px',
    border: 0,
    borderRadius: 8,
    background: '#2563eb',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 600,
  },
};
