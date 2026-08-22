'use client';

import { useMemo, useState } from 'react';
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
import { translateValidationError } from '@/lib/i18n/errors';
import { useLocale } from '@/lib/i18n/LocaleProvider';

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
  const { locale, t } = useLocale();
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }), [locale]);
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

  function formatDate(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
  }

  if (!record) {
    return (
      <section className="panel manager-result manager-detail" aria-live="polite">
        <div className="empty-state manager-empty">
          <span className="empty-state-icon"><SearchIcon /></span>
          <h2>{t('details.emptyTitle')}</h2>
          <p>{t('details.emptyDescription')}</p>
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
      setFormError(translateValidationError(targetUrlError, t));
      return;
    }

    const parsedLength = Number(subdomainLength);
    const lengthError = getSubdomainLengthError(parsedLength);
    if (lengthError) {
      setFormError(translateValidationError(lengthError, t));
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
            <p className="eyebrow">{t('details.editEyebrow')}</p>
            <h2>{record.path}</h2>
            <p>{t('details.editDescription')}</p>
          </div>
        </div>

        <form className="edit-link-form" onSubmit={handleSave}>
          <div className="form-field">
            <label htmlFor="edit-target-url">{t('details.targetUrl')}</label>
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
              <label htmlFor="edit-status-code">{t('details.statusCode')}</label>
              <select
                id="edit-status-code"
                value={statusCode}
                onChange={(event) => setStatusCode(
                  event.target.value === '301' ? 301 : 302,
                )}
                disabled={updating}
              >
                <option value="302">{t('details.temporaryRedirect')}</option>
                <option value="301">{t('details.permanentRedirect')}</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="edit-subdomain-length">{t('details.subdomainLength')}</label>
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
              <strong>{t('details.enableLink')}</strong>
              <small>{t('details.disableHelp')}</small>
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
              {updating ? t('details.saving') : t('details.save')}
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={updating}
              onClick={() => setEditing(false)}
            >
              {t('common.cancel')}
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
            {record.enabled === false ? t('details.statusDisabled') : t('details.statusEnabled')}
          </span>
          <h2>{record.path}</h2>
          <p>{target?.name ?? t('common.noEnvironment')}</p>
        </div>
        <div className="compact-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => setEditing(true)}
            title={t('details.edit')}
            disabled={updating || deleting}
          >
            <EditIcon />
            <span className="sr-only">{t('details.edit')}</span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => onCopy(record)}
            title={t('details.copy')}
          >
            <CopyIcon />
            <span className="sr-only">{copied ? t('details.copied') : t('details.copy')}</span>
          </button>
          <a
            className="icon-button"
            href={shortUrl}
            target="_blank"
            rel="noreferrer"
            title={t('details.open')}
          >
            <ExternalLinkIcon />
            <span className="sr-only">{t('details.open')}</span>
          </a>
        </div>
      </div>

      <dl className="detail-grid">
        <div>
          <dt>{t('details.shortUrl')}</dt>
          <dd><a href={shortUrl} target="_blank" rel="noreferrer">{shortUrl}</a></dd>
        </div>
        <div>
          <dt>{t('details.targetUrl')}</dt>
          <dd className="break-all">{getLinkTarget(record) || '—'}</dd>
        </div>
        <div>
          <dt>{t('details.mode')}</dt>
          <dd>
            {record.randomSubdomain
              ? t('details.randomMode', { length: record.subdomainLength ?? 10 })
              : t('details.fixedMode')}
          </dd>
        </div>
        <div>
          <dt>{t('details.responseStatus')}</dt>
          <dd>{record.statusCode ?? 302}</dd>
        </div>
        <div>
          <dt>{t('details.createdAt')}</dt>
          <dd>{formatDate(record.createdAt)}</dd>
        </div>
        <div>
          <dt>{t('details.updatedAt')}</dt>
          <dd>{formatDate(record.updatedAt)}</dd>
        </div>
      </dl>

      <div className="status-control-zone">
        <div>
          <h3>{record.enabled === false ? t('details.enableLink') : t('details.disableLink')}</h3>
          <p>
            {record.enabled === false
              ? t('details.enableDescription')
              : t('details.disableDescription')}
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
            ? t('details.updating')
            : record.enabled === false ? t('details.enableLink') : t('details.disableLink')}
        </button>
      </div>

      <div className="danger-zone">
        <div>
          <h3>{t('details.deleteTitle')}</h3>
          <p>{t('details.deleteDescription')}</p>
        </div>
        <button
          className="button button-danger"
          type="button"
          onClick={() => onDelete(record)}
          disabled={deleting}
        >
          <TrashIcon />
          {deleting ? t('details.deleting') : t('details.delete')}
        </button>
      </div>
    </section>
  );
}
