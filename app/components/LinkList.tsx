'use client';

import { LifecycleBadge, LifecycleDates } from './LinkLifecycle';
import { useEffect, useMemo, useRef } from 'react';
import {
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
} from '@/app/components/Icons';
import { buildShortUrl, getLinkTarget } from '@/lib/link-path';
import type { LinkRecord } from '@/lib/link-types';
import { useLocale } from '@/lib/i18n/LocaleProvider';

interface LinkListProps {
  items: LinkRecord[];
  redirectBaseUrl: string;
  selectedPath?: string;
  loading: boolean;
  emptyMessage: string;
  selectedPaths: string[];
  onSelect: (record: LinkRecord) => void;
  onCopy: (record: LinkRecord) => void;
  onToggleSelection: (path: string) => void;
  onToggleAll: () => void;
}

interface SelectionCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}

interface LinkActionsProps {
  record: LinkRecord;
  shortUrl: string;
  onSelect: (record: LinkRecord) => void;
  onCopy: (record: LinkRecord) => void;
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: SelectionCheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      className="selection-checkbox"
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={onChange}
    />
  );
}

function LinkActions({
  record,
  shortUrl,
  onSelect,
  onCopy,
}: LinkActionsProps) {
  const { t } = useLocale();

  return (
    <div className="table-actions">
      <button
        className="icon-button icon-button-small"
        type="button"
        title={t('list.viewDetails')}
        onClick={() => onSelect(record)}
      >
        <LinkIcon />
        <span className="sr-only">{t('list.viewDetailsFor', { path: record.path })}</span>
      </button>
      <button
        className="icon-button icon-button-small"
        type="button"
        title={t('list.copy')}
        onClick={() => onCopy(record)}
      >
        <CopyIcon />
        <span className="sr-only">{t('list.copyFor', { path: record.path })}</span>
      </button>
      <a
        className="icon-button icon-button-small"
        href={shortUrl}
        target="_blank"
        rel="noreferrer"
        title={t('list.open')}
      >
        <ExternalLinkIcon />
        <span className="sr-only">{t('list.openFor', { path: record.path })}</span>
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
  selectedPaths,
  onSelect,
  onCopy,
  onToggleSelection,
  onToggleAll,
}: LinkListProps) {
  const { locale, t } = useLocale();
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Singapore',
    timeZoneName: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }), [locale]);

  function formatDate(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
  }

  if (loading && items.length === 0) {
    return (
      <div className="list-state" role="status">
        <span className="loading-dot" />
        <p>{t('list.loading')}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="list-state">
        <span className="empty-state-icon"><LinkIcon /></span>
        <h3>{t('list.emptyTitle')}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const selectedPathSet = new Set(selectedPaths);
  const allSelected = items.every((record) => selectedPathSet.has(record.path));
  const someSelected = items.some((record) => selectedPathSet.has(record.path));

  return (
    <div className={loading ? 'link-list-content is-loading' : 'link-list-content'}>
      <div className="link-table-wrap">
        <table className="link-table">
          <caption className="sr-only">{t('list.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">
                <SelectionCheckbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  label={t('list.selectAll')}
                  onChange={onToggleAll}
                />
              </th>
              <th scope="col">{t('list.status')}</th>
              <th scope="col">{t('list.path')}</th>
              <th scope="col">{t('list.target')}</th>
              <th scope="col">{t('list.updatedAt')}</th>
              <th scope="col"><span className="sr-only">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((record) => {
              const shortUrl = buildShortUrl(redirectBaseUrl, record.path);
              const selected = record.path === selectedPath;

              return (
                <tr key={record.path} className={selected ? 'is-selected' : undefined}>
                  <td>
                    <SelectionCheckbox
                      checked={selectedPathSet.has(record.path)}
                      label={t('list.selectOne', { path: record.path })}
                      onChange={() => onToggleSelection(record.path)}
                    />
                  </td>
                  <td>
                    <LifecycleBadge record={record} />
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
                    <LifecycleDates record={record} />
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
                <div className="link-card-select">
                  <SelectionCheckbox
                    checked={selectedPathSet.has(record.path)}
                    label={t('list.selectOne', { path: record.path })}
                    onChange={() => onToggleSelection(record.path)}
                  />
                  <button
                    className="path-select-button"
                    type="button"
                    onClick={() => onSelect(record)}
                  >
                    {record.path}
                  </button>
                </div>
                <LifecycleBadge record={record} />
              </div>
              <LifecycleDates record={record} />
              <dl>
                <div>
                  <dt>{t('list.target')}</dt>
                  <dd>{getLinkTarget(record) || '—'}</dd>
                </div>
                <div>
                  <dt>{t('list.updatedAt')}</dt>
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
