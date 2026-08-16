import {
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
} from '@/app/components/Icons';
import { buildShortUrl, getLinkTarget } from '@/lib/link-path';
import type { LinkRecord } from '@/lib/link-types';

interface LinkListProps {
  items: LinkRecord[];
  redirectBaseUrl: string;
  selectedPath?: string;
  loading: boolean;
  emptyMessage: string;
  onSelect: (record: LinkRecord) => void;
  onCopy: (record: LinkRecord) => void;
}

interface LinkActionsProps {
  record: LinkRecord;
  shortUrl: string;
  onSelect: (record: LinkRecord) => void;
  onCopy: (record: LinkRecord) => void;
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

function LinkActions({
  record,
  shortUrl,
  onSelect,
  onCopy,
}: LinkActionsProps) {
  return (
    <div className="table-actions">
      <button
        className="icon-button icon-button-small"
        type="button"
        title="查看详情"
        onClick={() => onSelect(record)}
      >
        <LinkIcon />
        <span className="sr-only">查看“{record.path}”详情</span>
      </button>
      <button
        className="icon-button icon-button-small"
        type="button"
        title="复制短链"
        onClick={() => onCopy(record)}
      >
        <CopyIcon />
        <span className="sr-only">复制“{record.path}”短链</span>
      </button>
      <a
        className="icon-button icon-button-small"
        href={shortUrl}
        target="_blank"
        rel="noreferrer"
        title="打开短链"
      >
        <ExternalLinkIcon />
        <span className="sr-only">打开“{record.path}”短链</span>
      </a>
    </div>
  );
}

export function LinkList({
  items,
  redirectBaseUrl,
  selectedPath,
  loading,
  emptyMessage,
  onSelect,
  onCopy,
}: LinkListProps) {
  if (loading && items.length === 0) {
    return (
      <div className="list-state" role="status">
        <span className="loading-dot" />
        <p>正在读取链接列表…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="list-state">
        <span className="empty-state-icon"><LinkIcon /></span>
        <h3>没有可显示的链接</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={loading ? 'link-list-content is-loading' : 'link-list-content'}>
      <div className="link-table-wrap">
        <table className="link-table">
          <caption className="sr-only">当前环境中的短链列表</caption>
          <thead>
            <tr>
              <th scope="col">状态</th>
              <th scope="col">短链路径</th>
              <th scope="col">目标地址</th>
              <th scope="col">更新时间</th>
              <th scope="col"><span className="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((record) => {
              const shortUrl = buildShortUrl(redirectBaseUrl, record.path);
              const selected = record.path === selectedPath;

              return (
                <tr key={record.path} className={selected ? 'is-selected' : undefined}>
                  <td>
                    <span className={record.enabled === false ? 'status-badge status-off' : 'status-badge'}>
                      {record.enabled === false ? '停用' : '启用'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="path-select-button"
                      type="button"
                      onClick={() => onSelect(record)}
                      title={record.path}
                    >
                      {record.path}
                    </button>
                    <span className="table-secondary" title={shortUrl}>{shortUrl}</span>
                  </td>
                  <td>
                    <span className="table-target" title={getLinkTarget(record)}>
                      {getLinkTarget(record) || '—'}
                    </span>
                  </td>
                  <td className="table-date">{formatDate(record.updatedAt ?? record.createdAt)}</td>
                  <td>
                    <LinkActions
                      record={record}
                      shortUrl={shortUrl}
                      onSelect={onSelect}
                      onCopy={onCopy}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="link-card-list">
        {items.map((record) => {
          const shortUrl = buildShortUrl(redirectBaseUrl, record.path);
          const selected = record.path === selectedPath;

          return (
            <article
              key={record.path}
              className={selected ? 'link-card is-selected' : 'link-card'}
            >
              <div className="link-card-heading">
                <button
                  className="path-select-button"
                  type="button"
                  onClick={() => onSelect(record)}
                >
                  {record.path}
                </button>
                <span className={record.enabled === false ? 'status-badge status-off' : 'status-badge'}>
                  {record.enabled === false ? '停用' : '启用'}
                </span>
              </div>
              <dl>
                <div>
                  <dt>目标地址</dt>
                  <dd>{getLinkTarget(record) || '—'}</dd>
                </div>
                <div>
                  <dt>更新时间</dt>
                  <dd>{formatDate(record.updatedAt ?? record.createdAt)}</dd>
                </div>
              </dl>
              <LinkActions
                record={record}
                shortUrl={shortUrl}
                onSelect={onSelect}
                onCopy={onCopy}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}
