'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CopyIcon,
  ExternalLinkIcon,
  SearchIcon,
  TrashIcon,
} from '@/app/components/Icons';
import {
  buildShortUrl,
  encodeLinkPath,
  getLinkPathError,
  getLinkTarget,
  normalizeLinkPath,
} from '@/lib/link-path';
import type {
  ApiError,
  DeleteLinkResponse,
  LinkRecord,
  PublicApiTarget,
} from '@/lib/link-types';

interface LinkManagerPanelProps {
  target: PublicApiTarget | null;
  initialPath?: string;
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).error === 'string'
  );
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function LinkManagerPanel({
  target,
  initialPath = '',
}: LinkManagerPanelProps) {
  const [path, setPath] = useState(initialPath);
  const [record, setRecord] = useState<LinkRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const shortUrl = useMemo(
    () => (target && record ? buildShortUrl(target.redirectBaseUrl, record.path) : ''),
    [record, target],
  );

  const lookup = useCallback(
    async (input: string, signal?: AbortSignal) => {
      const normalizedPath = normalizeLinkPath(input);
      const pathError = getLinkPathError(normalizedPath);

      setError('');
      setNotice('');
      setCopied(false);

      if (!target) {
        setRecord(null);
        setError('请选择运行环境');
        return;
      }
      if (pathError) {
        setRecord(null);
        setError(pathError);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `/api/links/${encodeLinkPath(normalizedPath)}?targetId=${encodeURIComponent(target.id)}`,
          { cache: 'no-store', signal },
        );
        const payload: unknown = await response.json().catch(() => ({}));

        if (!response.ok) {
          setRecord(null);
          setError(isApiError(payload) ? payload.error : '查询失败，请稍后重试');
          return;
        }

        setRecord(payload as LinkRecord);
        setPath(normalizedPath);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        setRecord(null);
        setError('网络连接失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    },
    [target],
  );

  useEffect(() => {
    if (!initialPath) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void lookup(initialPath, controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [initialPath, lookup]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(path);
  }

  async function copyShortUrl() {
    if (!shortUrl) return;

    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError('无法复制短链，请手动选择链接地址');
    }
  }

  async function deleteLink() {
    if (!target || !record) return;

    const confirmed = window.confirm(
      `确定要从“${target.name}”删除短链“${record.path}”吗？此操作无法撤销。`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(
        `/api/links/${encodeLinkPath(record.path)}?targetId=${encodeURIComponent(target.id)}`,
        { method: 'DELETE' },
      );
      const payload: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(isApiError(payload) ? payload.error : '删除失败，请稍后重试');
        return;
      }

      const result = payload as DeleteLinkResponse;
      setRecord(null);
      setNotice(`短链“${result.path}”已删除`);
    } catch {
      setError('网络连接失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="manager-workspace">
      <section className="panel lookup-panel" aria-labelledby="lookup-title">
        <div className="panel-heading panel-heading-row">
          <div>
            <p className="eyebrow">精确查询</p>
            <h2 id="lookup-title">按短链路径查询</h2>
            <p>查询当前环境中的真实后台记录，然后复制、打开或删除。</p>
          </div>
          <span className="environment-pill">{target?.name ?? '未选择环境'}</span>
        </div>

        <form className="lookup-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="lookup-path">短链路径</label>
            <div className="lookup-input-row">
              <input
                id="lookup-path"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="例如：download/app"
                autoComplete="off"
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={loading || !target}
              >
                <SearchIcon />
                {loading ? '正在查询…' : '查询链接'}
              </button>
            </div>
            <p className="field-help">
              当前 Lambda 支持按路径精确查询；全量列表和分页需要后续升级后台。
            </p>
          </div>
        </form>

        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        {notice ? <div className="alert alert-success" role="status">{notice}</div> : null}
      </section>

      <section className="panel manager-result" aria-live="polite">
        {record ? (
          <>
            <div className="manager-result-header">
              <div>
                <span className={record.enabled === false ? 'status-badge status-off' : 'status-badge'}>
                  {record.enabled === false ? '已停用' : '已启用'}
                </span>
                <h2>{record.path}</h2>
                <p>{target?.redirectBaseUrl}</p>
              </div>
              <div className="compact-actions">
                <button className="icon-button" type="button" onClick={copyShortUrl} title="复制短链">
                  <CopyIcon />
                  <span className="sr-only">{copied ? '已复制' : '复制短链'}</span>
                </button>
                <a
                  className="icon-button"
                  href={shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="打开短链"
                >
                  <ExternalLinkIcon />
                  <span className="sr-only">打开短链</span>
                </a>
              </div>
            </div>

            <dl className="detail-grid">
              <div>
                <dt>短链地址</dt>
                <dd><a href={shortUrl} target="_blank" rel="noreferrer">{shortUrl}</a></dd>
              </div>
              <div>
                <dt>目标地址</dt>
                <dd className="break-all">{getLinkTarget(record) || '—'}</dd>
              </div>
              <div>
                <dt>跳转方式</dt>
                <dd>
                  {record.randomSubdomain
                    ? `随机二级域名（${record.subdomainLength ?? 10} 位）`
                    : '固定地址'}
                </dd>
              </div>
              <div>
                <dt>响应状态</dt>
                <dd>{record.statusCode ?? 302}</dd>
              </div>
              <div>
                <dt>创建时间</dt>
                <dd>{formatDate(record.createdAt)}</dd>
              </div>
              <div>
                <dt>更新时间</dt>
                <dd>{formatDate(record.updatedAt)}</dd>
              </div>
            </dl>

            <div className="danger-zone">
              <div>
                <h3>删除短链</h3>
                <p>删除后，访问该路径将立即返回未找到。</p>
              </div>
              <button
                className="button button-danger"
                type="button"
                onClick={deleteLink}
                disabled={deleting}
              >
                <TrashIcon />
                {deleting ? '正在删除…' : '删除短链'}
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state manager-empty">
            <span className="empty-state-icon"><SearchIcon /></span>
            <h2>尚未选择链接</h2>
            <p>输入短链路径进行查询，结果会显示在这里。</p>
          </div>
        )}
      </section>
    </div>
  );
}
