'use client';

import { useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  SearchIcon,
} from '@/app/components/Icons';
import {
  buildShortUrl,
  getLinkPathError,
  getLinkTarget,
  normalizeLinkPath,
} from '@/lib/link-path';
import type {
  ApiError,
  LinkRecord,
  PublicApiTarget,
} from '@/lib/link-types';

interface CreateLinkPanelProps {
  target: PublicApiTarget | null;
  onManage: (path: string) => void;
}

function getTargetUrlError(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '请输入目标地址';

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return '目标地址必须以 http:// 或 https:// 开头';
    }
    if (url.search || url.hash) {
      return '当前后台暂不支持目标地址中的查询参数或锚点';
    }
  } catch {
    return '请输入有效的目标地址';
  }

  return '';
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).error === 'string'
  );
}

export function CreateLinkPanel({
  target,
  onManage,
}: CreateLinkPanelProps) {
  const [path, setPath] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [subdomainLength, setSubdomainLength] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LinkRecord | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);

  const normalizedPath = useMemo(() => normalizeLinkPath(path), [path]);
  const pathError = useMemo(() => getLinkPathError(path), [path]);
  const targetUrlError = useMemo(
    () => getTargetUrlError(targetUrl),
    [targetUrl],
  );
  const lengthError =
    !Number.isInteger(subdomainLength)
      || subdomainLength < 3
      || subdomainLength > 32
      ? '随机字符长度必须是 3 至 32 的整数'
      : '';

  const previewShortUrl =
    target && normalizedPath
      ? buildShortUrl(target.redirectBaseUrl, normalizedPath)
      : '';
  const resultShortUrl =
    target && result
      ? buildShortUrl(target.redirectBaseUrl, result.path)
      : '';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    setCopied(false);

    const validationError =
      (!target ? '请选择运行环境' : '')
      || pathError
      || targetUrlError
      || lengthError;

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: target?.id,
          path: normalizedPath,
          targetUrl: targetUrl.trim(),
          randomSubdomain: true,
          subdomainLength,
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(isApiError(payload) ? payload.error : '创建短链失败，请稍后重试');
        return;
      }

      setResult(payload as LinkRecord);
    } catch {
      setError('网络连接失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyShortUrl() {
    if (!resultShortUrl) return;

    try {
      await navigator.clipboard.writeText(resultShortUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError('无法复制短链，请手动选择链接地址');
    }
  }

  function downloadQrCode() {
    const svg = qrRef.current;
    if (!svg) return;

    const blob = new Blob(
      [new XMLSerializer().serializeToString(svg)],
      { type: 'image/svg+xml' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${result?.path || 'short-link'}-qrcode.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="create-workspace">
      <section className="panel create-panel" aria-labelledby="create-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">新建链接</p>
            <h2 id="create-title">创建随机跳转短链</h2>
            <p>填写短链路径和目标地址，管理令牌只会在服务端使用。</p>
          </div>
        </div>

        <form className="link-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="link-path">短链路径</label>
            <div className="input-prefix-group">
              <span aria-hidden="true">
                {target?.redirectBaseUrl.replace(/^https?:\/\//, '') || '未选择环境'}/
              </span>
              <input
                id="link-path"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="例如：download/app"
                autoComplete="off"
                aria-describedby={path && pathError
                  ? 'link-path-help link-path-error'
                  : 'link-path-help'}
                aria-invalid={Boolean(path && pathError)}
              />
            </div>
            <p id="link-path-help" className="field-help">
              {previewShortUrl || '支持多级路径，最长 128 个字符'}
            </p>
            {path && pathError ? (
              <p id="link-path-error" className="field-error">{pathError}</p>
            ) : null}
          </div>

          <div className="form-field">
            <label htmlFor="target-url">目标地址</label>
            <input
              id="target-url"
              type="url"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://example.com/download/app.apk"
              aria-describedby={targetUrl && targetUrlError
                ? 'target-url-help target-url-error'
                : 'target-url-help'}
              aria-invalid={Boolean(targetUrl && targetUrlError)}
            />
            <p id="target-url-help" className="field-help">
              当前版本暂不支持保留查询参数或页面锚点。
            </p>
            {targetUrl && targetUrlError ? (
              <p id="target-url-error" className="field-error">{targetUrlError}</p>
            ) : null}
          </div>

          <fieldset className="mode-fieldset">
            <legend>跳转方式</legend>
            <div className="toggle-card mode-summary">
              <span>
                <strong>随机二级域名</strong>
                <small>当前后台仅支持此模式；每次访问都会生成新的目标子域名。</small>
              </span>
              <span className="mode-status">已启用</span>
            </div>

            <div className="inline-field">
              <label htmlFor="subdomain-length">随机字符长度</label>
              <input
                id="subdomain-length"
                type="number"
                min={3}
                max={32}
                step={1}
                value={subdomainLength}
                onChange={(event) => setSubdomainLength(Number(event.target.value))}
              />
              <span>位</span>
            </div>

            {lengthError ? (
              <p className="field-error">{lengthError}</p>
            ) : null}
          </fieldset>

          {error ? (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          ) : null}

          <div className="form-actions">
            <button
              className="button button-primary"
              type="submit"
              disabled={submitting || !target}
            >
              <LinkIcon />
              {submitting ? '正在创建…' : '创建短链'}
            </button>
            <span className="action-hint">创建后可前往“链接管理”查询或删除。</span>
          </div>
        </form>
      </section>

      <aside className="panel result-panel" aria-live="polite">
        {result ? (
          <>
            <div className="success-badge">
              <CheckIcon />
              创建成功
            </div>
            <div className="result-heading">
              <h2>短链已生成</h2>
              <p>现在可以复制、打开或进入管理页继续操作。</p>
            </div>

            <dl className="detail-list">
              <div>
                <dt>短链地址</dt>
                <dd>
                  <a href={resultShortUrl} target="_blank" rel="noreferrer">
                    {resultShortUrl}
                  </a>
                </dd>
              </div>
              <div>
                <dt>跳转方式</dt>
                <dd>
                  随机二级域名（{result.subdomainLength ?? subdomainLength} 位）
                </dd>
              </div>
              <div>
                <dt>目标地址</dt>
                <dd className="break-all">{getLinkTarget(result)}</dd>
              </div>
              <div>
                <dt>响应状态</dt>
                <dd>{result.statusCode ?? 302}</dd>
              </div>
            </dl>

            <div className="result-actions">
              <button className="button button-primary" type="button" onClick={copyShortUrl}>
                <CopyIcon />
                {copied ? '已复制' : '复制短链'}
              </button>
              <a
                className="button button-secondary"
                href={resultShortUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLinkIcon />
                打开短链
              </a>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => onManage(result.path)}
              >
                <SearchIcon />
                查看详情
              </button>
            </div>

            <div className="qr-block">
              <div>
                <h3>短链二维码</h3>
                <p>扫码即可访问当前短链。</p>
              </div>
              <div className="qr-code">
                <QRCodeSVG
                  ref={qrRef}
                  value={resultShortUrl}
                  size={156}
                  bgColor="#ffffff"
                  fgColor="#111827"
                  level="M"
                />
              </div>
              <button className="button button-secondary" type="button" onClick={downloadQrCode}>
                下载二维码
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon">
              <LinkIcon />
            </span>
            <h2>等待创建短链</h2>
            <p>创建成功后，这里会显示短链、跳转信息和二维码。</p>
          </div>
        )}
      </aside>
    </div>
  );
}
