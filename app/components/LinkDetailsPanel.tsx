import {
  CopyIcon,
  ExternalLinkIcon,
  SearchIcon,
  TrashIcon,
} from '@/app/components/Icons';
import { buildShortUrl, getLinkTarget } from '@/lib/link-path';
import type { LinkRecord, PublicApiTarget } from '@/lib/link-types';

interface LinkDetailsPanelProps {
  target: PublicApiTarget | null;
  record: LinkRecord | null;
  deleting: boolean;
  copied: boolean;
  onCopy: (record: LinkRecord) => void;
  onDelete: (record: LinkRecord) => void;
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
  copied,
  onCopy,
  onDelete,
}: LinkDetailsPanelProps) {
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
