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

      // Redirect to home page on success
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
        <div style={styles.card}>
          <div style={styles.titleContainer}>
            <img src="/logo.webp" alt="" style={styles.logo} />
            <h1 style={styles.h1}>Microbin Console</h1>
          </div>
          <p style={styles.sub}>请输入密码以继续</p>
          
          <form onSubmit={onLogin} style={styles.form}>
            <label style={styles.label}>
              密码
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                style={styles.input}
                autoFocus
              />
            </label>

            {error ? <div style={styles.errorText}>{error}</div> : null}

            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0b1020 0%, #070a12 60%, #05060a 100%)',
    color: '#e8eaf0',
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: { 
    maxWidth: 420, 
    width: '100%',
  },
  card: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 32,
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(8px)',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  h1: { 
    margin: 0, 
    fontSize: 28, 
    letterSpacing: 0.2,
  },
  sub: { 
    margin: '8px 0 24px', 
    color: '#aab2c5', 
    fontSize: 14,
    textAlign: 'center',
  },
  form: { display: 'grid', gap: 16 },
  label: { display: 'grid', gap: 8, fontSize: 13, color: '#cfd6e6' },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: '#e8eaf0',
    outline: 'none',
    fontSize: 15,
  },
  errorText: { 
    color: '#ff9aa2', 
    fontSize: 13,
    marginTop: -8,
  },
  primaryBtn: {
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
    color: 'white',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 500,
  },
};
