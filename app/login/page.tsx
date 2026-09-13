'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeToggle } from '../components/ThemeProvider';
import { getApiErrorKey } from '@/lib/i18n/errors';
import type { MessageKey } from '@/lib/i18n/messages';
import { useLocale } from '@/lib/i18n/LocaleProvider';

function getSafeReturnPath(): string {
  const requestedPath = new URLSearchParams(window.location.search).get('from');
  if (!requestedPath || !requestedPath.startsWith('/') || requestedPath.startsWith('//')) {
    return '/';
  }

  try {
    const returnUrl = new URL(requestedPath, window.location.origin);
    if (returnUrl.origin !== window.location.origin) return '/';
    return `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
  } catch {
    return '/';
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [username, setUsername] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<'none' | 'request' | 'confirm'>('none');
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const error = errorKey ? t(errorKey) : '';

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    
    if (!username.trim() || (recovery !== 'request' && challenge !== 'SOFTWARE_TOKEN_MFA' && !password)) {
      setErrorKey('auth.required');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(recovery === 'none' ? '/api/auth/login' : '/api/auth/recovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, challenge: challenge || undefined, code,
          action: recovery === 'confirm' ? 'confirm' : 'request' }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrorKey(getApiErrorKey(data, 'login.failed'));
        return;
      }
      if (recovery === 'request') { setRecovery('confirm'); setPassword(''); setNotice('auth.codeSent'); return; }
      if (recovery === 'confirm') { setRecovery('none'); setPassword(''); setNotice('auth.passwordChanged'); return; }
      if (data.challenge) { setChallenge(data.challenge); setPassword(''); setCode(''); return; }

      router.replace(getSafeReturnPath());
      router.refresh();
    } catch {
      setErrorKey('login.networkError');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div className="login-toolbar">
        <LanguageSwitcher compact />
        <ThemeToggle />
      </div>
      <div style={styles.container}>
        <div style={styles.logoRow}>
          <Image
            src="/logo.webp"
            alt=""
            width={48}
            height={48}
            style={styles.logo}
            priority
          />
        </div>
        <h1 style={styles.h1}>{t('login.welcome')}</h1>
        <p style={styles.sub}>{t('login.description')}</p>

        <div style={styles.card}>
          <form onSubmit={onLogin} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label htmlFor="console-username" style={styles.fieldLabel}>{t('auth.email')}</label>
              <input id="console-username" type="email" value={username} onChange={e => setUsername(e.target.value)}
                disabled={Boolean(challenge) || recovery === 'confirm'} autoComplete="username" required
                style={styles.input} autoFocus />
            </div>
            {challenge === 'NEW_PASSWORD_REQUIRED' ? <p role="status">{t('auth.newPasswordHelp')}</p> : null}
            {recovery !== 'request' && challenge !== 'SOFTWARE_TOKEN_MFA' ? <div style={styles.fieldGroup}>
              <label htmlFor="console-password" style={styles.fieldLabel}>{t(challenge === 'NEW_PASSWORD_REQUIRED' || recovery === 'confirm' ? 'auth.newPassword' : 'login.password')}</label>
              <input
                id="console-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                style={styles.input}
                autoComplete={challenge === 'NEW_PASSWORD_REQUIRED' || recovery === 'confirm' ? 'new-password' : 'current-password'}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
                required
              />
            </div> : null}
            {challenge === 'SOFTWARE_TOKEN_MFA' || recovery === 'confirm' ? <div style={styles.fieldGroup}>
              <label htmlFor="auth-code" style={styles.fieldLabel}>{t('auth.code')}</label>
              <input id="auth-code" inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={e => setCode(e.target.value)} required style={styles.input} />
            </div> : null}
            {notice ? <p role="status">{t(notice)}</p> : null}
            {error ? (
              <div id="login-error" role="alert" style={styles.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={loading} style={loading ? { ...styles.primaryBtn, opacity: 0.7, cursor: 'not-allowed' } : styles.primaryBtn}>
              {loading ? t('login.submitting') : t(recovery === 'request' ? 'auth.sendCode' : recovery === 'confirm' || challenge ? 'auth.continue' : 'login.submit')}
            </button>
            <button type="button" className="button button-secondary" disabled={loading} onClick={() => {
              setRecovery(recovery === 'none' && !challenge ? 'request' : 'none');
              setChallenge(''); setPassword(''); setCode(''); setErrorKey(null); setNotice(null);
            }}>{t(recovery === 'none' && !challenge ? 'auth.forgotPassword' : 'auth.back')}</button>
          </form>
        </div>

        <p style={styles.footer}>{t('login.footer')}</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--background)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  container: {
    maxWidth: 400,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoRow: {
    marginBottom: 24,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  h1: {
    margin: '0 0 8px',
    fontSize: 24,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    textAlign: 'center',
    color: 'var(--text-primary)',
  },
  sub: {
    margin: '0 0 32px',
    color: 'var(--text-secondary)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  card: {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
    letterSpacing: '0.01em',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--background)',
    color: 'var(--text-primary)',
    outline: 'none',
    fontSize: 14,
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 6,
    background: 'var(--error-bg)',
    border: '1px solid var(--error-border)',
    color: 'var(--error-text)',
    fontSize: 13,
  },
  primaryBtn: {
    width: '100%',
    padding: '9px 16px',
    borderRadius: 6,
    border: '1px solid var(--accent)',
    background: 'var(--accent)',
    color: 'var(--accent-fg)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '0.01em',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  footer: {
    marginTop: 32,
    color: 'var(--text-muted)',
    fontSize: 12,
    textAlign: 'center',
  },
};
