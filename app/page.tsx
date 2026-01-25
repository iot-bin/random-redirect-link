'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type CreateResponse =
    | { path: string; targetUrl: string }
    | { error: string; detail?: string };

type ApiTargetOption = {
  alias: string;
  label: string;
};

function normalizePath(input: string) {
  // English comment: normalize user input path
  const s = (input || '').trim();
  const noLeading = s.startsWith('/') ? s.slice(1) : s;
  const noTrailing = noLeading.replace(/\/+$/, '');
  return noTrailing;
}

export default function Home() {
  const router = useRouter();
  const [path, setPath] = useState('hello3');
  const [targetUrl, setTargetUrl] = useState('https://example.com');
  const [apiTarget, setApiTarget] = useState('');
  const [apiTargets, setApiTargets] = useState<ApiTargetOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const normalizedPath = useMemo(() => normalizePath(path), [path]);
  const shortUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_REDIRECT_BASE_URL || 'https://link.microbin.dev';
    return normalizedPath ? `${base}/${encodeURI(normalizedPath)}` : '';
  }, [normalizedPath]);

  // Fetch available API targets on mount
  useEffect(() => {
    async function fetchTargets() {
      try {
        const res = await fetch('/api/targets');
        if (res.ok) {
          const data = await res.json();
          const targets = data.targets || [];
          setApiTargets(targets);
          
          // Auto-select if only one target available
          if (targets.length === 1) {
            setApiTarget(targets[0].alias);
          }
        }
      } catch (err) {
        console.error('Failed to fetch API targets:', err);
      }
    }
    
    fetchTargets();
  }, []);

  // Configurable site information
  const siteTitle = process.env.NEXT_PUBLIC_SITE_TITLE || 'Microbin Console';
  const siteSubtitle = process.env.NEXT_PUBLIC_SITE_SUBTITLE || '创建自定义路径短链接（301 跳转）';
  const headerLinkText = process.env.NEXT_PUBLIC_HEADER_LINK_TEXT || 'link.microbin.dev';
  const headerLinkHref = process.env.NEXT_PUBLIC_HEADER_LINK_HREF || 'https://link.microbin.dev';

  const pathError = useMemo(() => {
    if (!normalizedPath) return 'Path 不能为空';
    if (normalizedPath.length > 128) return 'Path 过长（建议 <= 128）';
    if (normalizedPath.includes('..')) return 'Path 不能包含 ..';
    if (normalizedPath.includes('//')) return 'Path 不能包含连续的 //';
    return '';
  }, [normalizedPath]);

  const urlError = useMemo(() => {
    const u = targetUrl.trim();
    if (!u) return 'Target URL 不能为空';
    if (!(u.startsWith('https://') || u.startsWith('http://'))) return 'Target URL 必须以 http:// 或 https:// 开头';
    return '';
  }, [targetUrl]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCopied(false);
    setResp(null);

    if (pathError || urlError) {
      setResp({ error: '表单校验失败，请检查输入' });
      return;
    }

    setLoading(true);
    try {
      const requestBody: { path: string; targetUrl: string; apiTarget?: string } = {
        path: normalizedPath,
        targetUrl: targetUrl.trim(),
      };
      
      // Include apiTarget if selected
      if (apiTarget) {
        requestBody.apiTarget = apiTarget;
      }
      
      const r = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = (await r.json().catch(() => ({}))) as CreateResponse;

      if (!r.ok) {
        setResp(data && 'error' in data ? data : { error: `创建失败：${r.status}` });
        return;
      }

      setResp(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResp({ error: '网络错误', detail: message });
    } finally {
      setLoading(false);
    }
  }

  async function onCopy() {
    if (!shortUrl) return;
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  async function onLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
      <div style={styles.page}>
        <div style={styles.container}>
          <header style={styles.header}>
            <div>
              <h1 style={styles.h1}>{siteTitle}</h1>
              <p style={styles.sub}>{siteSubtitle}</p>
            </div>
            <div style={styles.headerRight}>
              <a href={headerLinkHref} target="_blank" rel="noreferrer" style={styles.linkMuted}>
                {headerLinkText}
              </a>
              <button onClick={onLogout} style={styles.logoutBtn} className="logout-btn">
                <span className="logout-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6M10.6667 11.3333L14 8M14 8L10.6667 4.66667M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className="logout-text">退出登录</span>
              </button>
            </div>
          </header>

          <section style={styles.card}>
            <form onSubmit={onCreate} style={styles.form}>
              <div style={styles.row}>
                <label style={styles.label}>
                  Path
                  <input
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="hello 或 foo/bar"
                      style={styles.input}
                  />
                  <div style={styles.hint}>
                    生成链接：<code style={styles.code}>{shortUrl || '（请先输入 path）'}</code>
                  </div>
                  {pathError ? <div style={styles.errorText}>{pathError}</div> : null}
                </label>
              </div>

              <div style={styles.row}>
                <label style={styles.label}>
                  Target URL
                  <input
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://example.com"
                      style={styles.input}
                  />
                  {urlError ? <div style={styles.errorText}>{urlError}</div> : null}
                </label>
              </div>

              {apiTargets.length > 1 ? (
                <div style={styles.row}>
                  <label style={styles.label}>
                    API 域名/管理端
                    <select
                        value={apiTarget}
                        onChange={(e) => setApiTarget(e.target.value)}
                        style={styles.select}
                        required
                        aria-label="选择 API 域名"
                    >
                      <option value="" disabled>
                        -- 请选择 API 域名 --
                      </option>
                      {apiTargets.map((t) => (
                        <option key={t.alias} value={t.alias}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <div style={styles.hint}>
                      选择要创建短链接的后端 API 服务
                    </div>
                  </label>
                </div>
              ) : null}

              <div style={styles.actions}>
                <button type="submit" disabled={loading} style={styles.primaryBtn}>
                  {loading ? '创建中...' : '创建短链'}
                </button>

                {shortUrl ? (
                    <button type="button" onClick={onCopy} style={styles.secondaryBtn}>
                      {copied ? '已复制' : '复制短链'}
                    </button>
                ) : null}
              </div>
            </form>
          </section>

          {resp ? (
              <section style={{ ...styles.card, marginTop: 16 }}>
                {'error' in resp ? (
                    <div>
                      <div style={styles.badgeError}>创建失败</div>
                      <div style={styles.resultTitle}>{resp.error}</div>
                      {resp.detail ? <pre style={styles.pre}>{resp.detail}</pre> : null}
                      <div style={styles.hint}>如果提示 409，表示 path 已被占用。</div>
                    </div>
                ) : (
                    <div>
                      <div style={styles.badgeOk}>创建成功</div>
                      <div style={styles.resultTitle}>你的短链已生成</div>
                      <div style={styles.kv}>
                        <div style={styles.k}>Short URL</div>
                        <div style={styles.v}>
                          <a href={shortUrl} target="_blank" rel="noreferrer" style={styles.link}>
                            {shortUrl}
                          </a>
                        </div>
                      </div>
                      <div style={styles.kv}>
                        <div style={styles.k}>Target URL</div>
                        <div style={styles.v}>
                          <a href={resp.targetUrl} target="_blank" rel="noreferrer" style={styles.linkMuted}>
                            {resp.targetUrl}
                          </a>
                        </div>
                      </div>
                      <div style={styles.actions}>
                        <button type="button" onClick={onCopy} style={styles.primaryBtn}>
                          {copied ? '已复制' : '复制短链'}
                        </button>
                      </div>
                    </div>
                )}
              </section>
          ) : null}

          <footer style={styles.footer}>
            <span style={styles.footerText}>提示：301 会被浏览器缓存，path 不建议频繁修改目标地址。</span>
          </footer>
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
  },
  container: { maxWidth: 820, margin: '0 auto' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 16,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  logoutBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e8eaf0',
    cursor: 'pointer',
    fontSize: 12,
    whiteSpace: 'nowrap',
    minHeight: 36,
  },
  h1: { margin: 0, fontSize: 28, letterSpacing: 0.2 },
  sub: { margin: '6px 0 0', color: '#aab2c5', fontSize: 14 },
  card: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 18,
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(8px)',
  },
  form: { display: 'grid', gap: 14 },
  row: { display: 'grid', gap: 6 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: '#cfd6e6' },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: '#e8eaf0',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: '#e8eaf0',
    outline: 'none',
    cursor: 'pointer',
  },
  hint: { color: '#aab2c5', fontSize: 12, lineHeight: 1.5 },
  code: {
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.10)',
    padding: '2px 6px',
    borderRadius: 8,
  },
  errorText: { color: '#ff9aa2', fontSize: 12 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 },
  primaryBtn: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
    color: 'white',
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e8eaf0',
    cursor: 'pointer',
  },
  badgeOk: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.15)',
    border: '1px solid rgba(34,197,94,0.35)',
    color: '#7ee0a3',
    fontSize: 12,
    marginBottom: 10,
  },
  badgeError: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#ff9aa2',
    fontSize: 12,
    marginBottom: 10,
  },
  resultTitle: { fontSize: 16, marginBottom: 10 },
  kv: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    gap: 10,
    alignItems: 'start',
    marginTop: 10,
  },
  k: { color: '#aab2c5', fontSize: 12, paddingTop: 2 },
  v: { fontSize: 14 },
  link: { color: '#93c5fd', textDecoration: 'none' },
  linkMuted: { color: '#aab2c5', textDecoration: 'none' },
  pre: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.10)',
    overflow: 'auto',
  },
  footer: { marginTop: 18, padding: 6 },
  footerText: { color: '#7f8aa6', fontSize: 12 },
};