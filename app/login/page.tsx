'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    
    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setError(data?.error || '登录失败');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.logoRow}>
          <img src="/logo.webp" alt="Microbin Console" style={styles.logo} />
        </div>
        <h1 style={styles.h1}>欢迎回来</h1>
        <p style={styles.sub}>请输入密码以访问 Microbin Console</p>

        <div style={styles.card}>
          <form onSubmit={onLogin} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                style={styles.input}
                autoFocus
              />
            </div>

            {error ? (
              <div style={styles.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={loading} style={loading ? { ...styles.primaryBtn, opacity: 0.7, cursor: 'not-allowed' } : styles.primaryBtn}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>

        <p style={styles.footer}>Microbin Console &mdash; 短链管理系统</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#000000',
    color: '#ededed',
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
    color: '#ffffff',
  },
  sub: {
    margin: '0 0 32px',
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  card: {
    width: '100%',
    background: '#0a0a0a',
    border: '1px solid #333333',
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
    color: '#ededed',
    letterSpacing: '0.01em',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 6,
    border: '1px solid #333333',
    background: '#000000',
    color: '#ededed',
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
    background: 'rgba(255,80,80,0.08)',
    border: '1px solid rgba(255,80,80,0.25)',
    color: '#ff6b6b',
    fontSize: 13,
  },
  primaryBtn: {
    width: '100%',
    padding: '9px 16px',
    borderRadius: 6,
    border: '1px solid #ffffff',
    background: '#ffffff',
    color: '#000000',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '0.01em',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  footer: {
    marginTop: 32,
    color: '#444444',
    fontSize: 12,
    textAlign: 'center',
  },
};
