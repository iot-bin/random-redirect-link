'use client';

import { useState } from 'react';
import {
  CopyIcon,
  EditIcon,
  ExternalLinkIcon,
  PowerIcon,
  SearchIcon,
  TrashIcon,
} from '@/app/components/Icons';
import { buildShortUrl, getLinkTarget } from '@/lib/link-path';
import type {
  LinkRecord,
  LinkUpdateInput,
  PublicApiTarget,
} from '@/lib/link-types';
import {
  getSubdomainLengthError,
  getTargetUrlError,
} from '@/lib/link-validation';

interface LinkDetailsPanelProps {
  target: PublicApiTarget | null;
  record: LinkRecord | null;
  deleting: boolean;
  updating: boolean;
  copied: boolean;
  onCopy: (record: LinkRecord) => void;
  onDelete: (record: LinkRecord) => void;
  onUpdate: (record: LinkRecord, update: LinkUpdateInput) => Promise<boolean>;
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function LinkDetailsPanel({
  target,
  record,
  deleting,
  updating,
  copied,
  onCopy,
  onDelete,
  onUpdate,
}: LinkDetailsPanelProps) {
  const [editing, setEditing] = useState(false);
  const [targetUrl, setTargetUrl] = useState(record ? getLinkTarget(record) : '');
  const [statusCode, setStatusCode] = useState<301 | 302>(
    record?.statusCode === 301 ? 301 : 302,
  );
  const [subdomainLength, setSubdomainLength] = useState(
    String(record?.subdomainLength ?? 10),
  );
  const [enabled, setEnabled] = useState(record?.enabled !== false);
  const [formError, setFormError] = useState('');

  if (!record) {
    return (
      <section className="panel manager-result manager-detail" aria-live="polite">
        <div className="empty-state manager-empty">
          <span className="empty-state-icon"><SearchIcon /></span>
          <h2>尚未选择链接</h2>
          <p>从列表选择一条记录，或使用完整路径进行精确查询。</p>
        </div>
      </section>
    );
  }

  const shortUrl = target
    ? buildShortUrl(target.redirectBaseUrl, record.path)
    : '';

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    if (!record) return;

    const normalizedTargetUrl = targetUrl.trim();
    const targetUrlError = getTargetUrlError(normalizedTargetUrl);
    if (targetUrlError) {
      setFormError(targetUrlError);
      return;
    }

    const parsedLength = Number(subdomainLength);
    const lengthError = getSubdomainLengthError(parsedLength);
    if (lengthError) {
      setFormError(lengthError);
      return;
    }

    const saved = await onUpdate(record, {
      targetUrl: normalizedTargetUrl,
      statusCode,
      subdomainLength: parsedLength,
      enabled,
      expectedUpdatedAt: record.updatedAt,
    });

    if (saved) setEditing(false);
  }

  if (editing) {
    return (
      <section className="panel manager-result manager-detail" aria-live="polite">
        <div className="manager-result-header">
          <div>
            <p className="eyebrow">编辑短链</p>
            <h2>{record.path}</h2>
            <p>短链路径不可修改，保存后立即生效。</p>
          </div>
        </div>

        <form className="edit-link-form" onSubmit={handleSave}>
          <div className="form-field">
            <label htmlFor="edit-target-url">目标地址</label>
            <input
              id="edit-target-url"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              disabled={updating}
              autoComplete="url"
            />
          </div>

          <div className="edit-link-grid">
            <div className="form-field">
              <label htmlFor="edit-status-code">跳转状态码</label>
              <select
                id="edit-status-code"
                value={statusCode}
                onChange={(event) => setStatusCode(
                  event.target.value === '301' ? 301 : 302,
                )}
                disabled={updating}
              >
                <option value="302">302（临时跳转）</option>
                <option value="301">301（永久跳转）</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="edit-subdomain-length">随机字符长度</label>
              <input
                id="edit-subdomain-length"
                type="number"
                min="3"
                max="32"
                step="1"
                value={subdomainLength}
                onChange={(event) => setSubdomainLength(event.target.value)}
                disabled={updating}
              />
            </div>
          </div>

          <label className="toggle-card edit-status-toggle">
            <span>
              <strong>启用短链</strong>
              <small>停用后访问该路径将返回未找到。</small>
            </span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              disabled={updating}
            />
          </label>

          {formError ? <div className="alert alert-error" role="alert">{formError}</div> : null}

          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={updating}>
              {updating ? '正在保存…' : '保存修改'}
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={updating}
              onClick={() => setEditing(false)}
            >
              取消
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="panel manager-result manager-detail" aria-live="polite">
      <div className="manager-result-header">
        <div>
          <span className={record.enabled === false ? 'status-badge status-off' : 'status-badge'}>
            {record.enabled === false ? '已停用' : '已启用'}
          </span>
          <h2>{record.path}</h2>
          <p>{target?.name ?? '未选择环境'}</p>
        </div>
        <div className="compact-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => setEditing(true)}
            title="编辑短链"
            disabled={updating || deleting}
          >
            <EditIcon />
            <span className="sr-only">编辑短链</span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => onCopy(record)}
            title="复制短链"
          >
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

      <div className="status-control-zone">
        <div>
          <h3>{record.enabled === false ? '启用短链' : '停用短链'}</h3>
          <p>
            {record.enabled === false
              ? '启用后，该路径会恢复跳转。'
              : '停用后保留配置，但访问该路径将返回未找到。'}
          </p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          disabled={updating || deleting}
          onClick={() => void onUpdate(record, {
            enabled: record.enabled === false,
            expectedUpdatedAt: record.updatedAt,
          })}
        >
          <PowerIcon />
          {updating
            ? '正在更新…'
            : record.enabled === false ? '启用短链' : '停用短链'}
        </button>
      </div>

      <div className="danger-zone">
        <div>
          <h3>删除短链</h3>
          <p>删除后，访问该路径将立即返回未找到。</p>
        </div>
        <button
          className="button button-danger"
          type="button"
          onClick={() => onDelete(record)}
          disabled={deleting}
        >
          <TrashIcon />
          {deleting ? '正在删除…' : '删除短链'}
        </button>
      </div>
    </section>
  );
}
