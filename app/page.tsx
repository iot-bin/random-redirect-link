'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

type CreateResponse =
    | {
  path: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  statusCode?: number;
  randomSubdomain?: boolean;
  subdomainLength?: number;
  targetBaseUrl?: string;
  targetPath?: string;
  // Admin API currently returns these fields; keep targetUrl optional for compatibility
  targetUrl?: string;
}
    | { error: string; detail?: string };

interface ApiTarget {
  id: string;
  name: string;
  redirectBaseUrl: string;
}

interface TargetsResponse {
  targets: ApiTarget[];
  defaultTargetId: string | null;
}

function normalizePath(input: string) {
  // English comment: normalize user input path
  const s = (input || '').trim();
  const noLeading = s.startsWith('/') ? s.slice(1) : s;
  const noTrailing = noLeading.replace(/\/+$/, '');
  return noTrailing;
}

// Read branding configuration from environment variables at module level
const SITE_SUBTITLE = process.env.NEXT_PUBLIC_SITE_SUBTITLE || process.env.SITE_SUBTITLE || '创建自定义路径短链接（跳转）';

export default function Home() {
  const router = useRouter();
  const [path, setPath] = useState('hello3');
  const [targetUrl, setTargetUrl] = useState('https://example.com');

  // API Target selection
  const [apiTargets, setApiTargets] = useState<ApiTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [loadingTargets, setLoadingTargets] = useState(true);

  // New controls
  const [randomSubdomain, setRandomSubdomain] = useState(true);
  const [subdomainLength, setSubdomainLength] = useState(5);

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Load available API targets on mount
  useEffect(() => {
    async function loadTargets() {
      try {
        const res = await fetch('/api/targets');
        if (res.ok) {
          const data: TargetsResponse = await res.json();
          setApiTargets(data.targets);
          if (data.defaultTargetId) {
            setSelectedTargetId(data.defaultTargetId);
          } else if (data.targets.length > 0) {
            setSelectedTargetId(data.targets[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load API targets:', err);
      } finally {
        setLoadingTargets(false);
      }
    }
    loadTargets();
  }, []);

  // Get current selected target
  const selectedTarget = useMemo(() => {
    return apiTargets.find(t => t.id === selectedTargetId);
  }, [apiTargets, selectedTargetId]);

  // Get redirect base URL from selected target
  const redirectBaseUrl = useMemo(() => {
    return selectedTarget?.redirectBaseUrl || '';
  }, [selectedTarget]);

  const normalizedPath = useMemo(() => normalizePath(path), [path]);
  const shortUrl = useMemo(() => {
    return normalizedPath && redirectBaseUrl ? `${redirectBaseUrl}/${encodeURI(normalizedPath)}` : '';
  }, [normalizedPath, redirectBaseUrl]);

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

  const randomError = useMemo(() => {
    if (!randomSubdomain) return '';
    if (!Number.isFinite(subdomainLength)) return '随机长度必须是数字';
    if (subdomainLength < 3 || subdomainLength > 32) return '随机长度建议 3~32';
    return '';
  }, [randomSubdomain, subdomainLength]);

  const targetError = useMemo(() => {
    if (!selectedTargetId) return 'Please select an API target';
    return '';
  }, [selectedTargetId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCopied(false);
    setResp(null);

    if (pathError || urlError || randomError || targetError) {
      setResp({ error: '表单校验失败，请检查输入' });
      return;
    }

    setLoading(true);
    try {
      const r = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: selectedTargetId,
          path: normalizedPath,
          targetUrl: targetUrl.trim(),
          randomSubdomain,
          subdomainLength,
        }),
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

  const qrRef = useRef<SVGSVGElement>(null);

  async function onLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function onDownloadQR() {
    const svg = qrRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qrcode.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
      <div style={styles.page}>
        <div style={styles.container}>
          <header style={styles.header}>
            <div style={styles.headerLeft}>
              <img src="/logo.webp" alt="Microbin Console" style={styles.logo} />
              <div>
                <h1 className="page-title" style={styles.h1}>Microbin Console</h1>
                <p className="page-subtitle" style={styles.sub}>{SITE_SUBTITLE}</p>
              </div>
            </div>
            <div style={styles.headerRight}>
              {selectedTarget ? (
                  <a href={selectedTarget.redirectBaseUrl} target="_blank" rel="noreferrer" style={styles.linkMuted}>
                    {selectedTarget.redirectBaseUrl.replace(/^https?:\/\//, '')}
                  </a>
              ) : (
                  <span style={styles.linkMuted}>Loading...</span>
              )}
              <button onClick={onLogout} className="logout-btn">
                <span className="logout-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span className="logout-text">退出登录</span>
              </button>
            </div>
          </header>

          <section style={styles.card}>
            <form onSubmit={onCreate} style={styles.form}>
              {/* API Target Selector */}
              <div style={styles.row}>
                <label style={styles.label}>
                  API / 环境选择
                  {loadingTargets ? (
                      <div style={styles.hint}>加载中...</div>
                  ) : apiTargets.length === 0 ? (
                      <div style={styles.errorText}>
                        未配置 API 目标。请在服务器端配置 API_TARGETS 环境变量。
                      </div>
                  ) : (
                      <select
                          value={selectedTargetId}
                          onChange={(e) => setSelectedTargetId(e.target.value)}
                          style={styles.select}
                      >
                        {apiTargets.map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.name}
                            </option>
                        ))}
                      </select>
                  )}
                  {selectedTarget && (
                      <div style={styles.hint}>
                        短链域名: {selectedTarget.redirectBaseUrl}
                      </div>
                  )}
                  {targetError ? <div style={styles.errorText}>{targetError}</div> : null}
                </label>
              </div>

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
                    生成链接： <code style={styles.code}>{shortUrl || '（请先输入 path）'}</code>
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
                      placeholder="https://example.com/168.apk"
                      style={styles.input}
                  />
                  {urlError ? <div style={styles.errorText}>{urlError}</div> : null}
                </label>
              </div>

              {/* New: random subdomain controls */}
              <div style={styles.row}>
                <label style={styles.label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                        type="checkbox"
                        checked={randomSubdomain}
                        onChange={(e) => setRandomSubdomain(e.target.checked)}
                    />
                    <span>每次访问随机二级域名（推荐用于分流/变更域名场景）</span>
                  </div>

                  {randomSubdomain ? (
                      <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ color: '#aab2c5', fontSize: 12 }}>随机长度</span>
                        <input
                            type="number"
                            value={subdomainLength}
                            min={3}
                            max={32}
                            onChange={(e) => setSubdomainLength(Number(e.target.value))}
                            style={{ ...styles.input, width: 140 }}
                        />
                      </div>
                  ) : null}

                  {randomError ? <div style={styles.errorText}>{randomError}</div> : null}
                  <div style={styles.hint}>
                    提示：为确保&ldquo;每次访问都不同&rdquo;，跳转会使用 302 并禁用缓存。
                  </div>
                </label>
              </div>

              <div style={styles.actions}>
                <button type="submit" disabled={loading || loadingTargets || apiTargets.length === 0} style={styles.primaryBtn}>
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
                        <div style={styles.k}>Mode</div>
                        <div style={styles.v}>
                          {resp.randomSubdomain ? `Random subdomain (len=${resp.subdomainLength ?? '-'})` : 'Fixed'}
                        </div>
                      </div>

                      <div style={styles.kv}>
                        <div style={styles.k}>Target</div>
                        <div style={styles.v}>
                          <code style={styles.code}>
                            {(resp.targetBaseUrl ?? '') + (resp.targetPath ?? '') || resp.targetUrl || ''}
                          </code>
                        </div>
                      </div>

                      <div style={styles.actions}>
                        <button type="button" onClick={onCopy} style={styles.primaryBtn}>
                          {copied ? '已复制' : '复制短链'}
                        </button>
                      </div>

                      <div style={styles.qrSection}>
                        <div style={styles.k}>二维码</div>
                        <div style={styles.qrWrapper}>
                          <QRCodeSVG ref={qrRef} value={shortUrl} size={160} bgColor="#ffffff" fgColor="#000000" level="M" />
                        </div>
                        <button type="button" onClick={onDownloadQR} style={styles.secondaryBtn}>
                          下载二维码
                        </button>
                      </div>
                    </div>
                )}
              </section>
          ) : null}

          <footer style={styles.footer}>
          <span style={styles.footerText}>
            提示：随机二级域模式会禁用缓存以保证每次访问都随机，成本会比纯缓存 301 更高。
          </span>
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
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    flex: '1 1 auto',
    flexWrap: 'wrap',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    flexShrink: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    flex: '0 1 auto',
  },
  h1: { margin: 0, fontSize: 24, letterSpacing: 0.2 },
  sub: { margin: '4px 0 0', color: '#aab2c5', fontSize: 14 },
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
    maxWidth: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: '#e8eaf0',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    maxWidth: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.25)',
    color: '#e8eaf0',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  hint: { color: '#aab2c5', fontSize: 12, lineHeight: 1.5 },
  code: {
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.10)',
    padding: '2px 6px',
    borderRadius: 8,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
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
    gridTemplateColumns: 'minmax(80px, 120px) 1fr',
    gap: 10,
    alignItems: 'start',
    marginTop: 10,
  },
  k: { color: '#aab2c5', fontSize: 12, paddingTop: 2 },
  v: { 
    fontSize: 14,
    minWidth: 0,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  link: { 
    color: '#93c5fd', 
    textDecoration: 'none',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  linkMuted: { 
    color: '#aab2c5', 
    textDecoration: 'none',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
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
  qrSection: { marginTop: 16, display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: 10 },
  qrWrapper: { padding: 12, background: '#ffffff', borderRadius: 10, display: 'inline-block' },
};
