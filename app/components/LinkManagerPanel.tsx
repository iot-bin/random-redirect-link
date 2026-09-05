'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LinkIcon,
  RefreshIcon,
  SearchIcon,
} from '@/app/components/Icons';
import { LinkDetailsPanel } from '@/app/components/LinkDetailsPanel';
import { LinkList } from '@/app/components/LinkList';
import {
  buildShortUrl,
  encodeLinkPath,
  getLinkPathError,
  getLinkPrefixError,
  normalizeLinkPath,
  normalizeLinkPrefix,
} from '@/lib/link-path';
import type {
  DeleteLinkResponse,
  LinkBatchAction,
  LinkBatchFailure,
  LinkBatchResponse,
  LinkListResponse,
  LinkRecord,
  LinkUpdateInput,
  PublicApiTarget,
} from '@/lib/link-types';
import {
  translateApiError,
  translateValidationError,
} from '@/lib/i18n/errors';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { PageSize } from '@/lib/console-preferences';

interface LinkManagerPanelProps {
  target: PublicApiTarget | null;
  pageSize: PageSize;
  initialPath?: string;
}

type BatchFeedback =
  | {
    kind: 'result';
    action: LinkBatchAction;
    succeededCount: number;
    failed: LinkBatchFailure[];
  }
  | {
    kind: 'uncertain';
    action: LinkBatchAction;
    requestedCount: number;
  };

function isLinkRecord(value: unknown): value is LinkRecord {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).path === 'string'
    && (value as Record<string, unknown>).path !== ''
  );
}

function parseLinkListResponse(value: unknown): LinkListResponse | null {
  if (typeof value !== 'object' || value === null) return null;

  const response = value as Record<string, unknown>;
  if (!Array.isArray(response.items) || !response.items.every(isLinkRecord)) {
    return null;
  }
  if (response.nextCursor !== null && typeof response.nextCursor !== 'string') {
    return null;
  }

  return {
    items: response.items,
    nextCursor: response.nextCursor,
  };
}

function isDeleteLinkResponse(value: unknown): value is DeleteLinkResponse {
  if (typeof value !== 'object' || value === null) return false;

  const response = value as Record<string, unknown>;
  return response.deleted === true && typeof response.path === 'string';
}

function parseLinkBatchResponse(value: unknown): LinkBatchResponse | null {
  if (typeof value !== 'object' || value === null) return null;

  const response = value as Record<string, unknown>;
  if (
    response.action !== 'enable'
    && response.action !== 'disable'
    && response.action !== 'delete'
  ) {
    return null;
  }
  if (!Array.isArray(response.succeeded) || !Array.isArray(response.failed)) {
    return null;
  }

  const succeeded = response.succeeded.map((entry) => {
    if (typeof entry !== 'object' || entry === null) return null;
    const result = entry as Record<string, unknown>;
    if (typeof result.path !== 'string' || !result.path) return null;
    if (result.item !== undefined && !isLinkRecord(result.item)) return null;
    return {
      path: result.path,
      ...(isLinkRecord(result.item) ? { item: result.item } : {}),
    };
  });

  const failed = response.failed.map((entry) => {
    if (typeof entry !== 'object' || entry === null) return null;
    const result = entry as Record<string, unknown>;
    if (
      typeof result.path !== 'string'
      || typeof result.code !== 'string'
      || typeof result.error !== 'string'
    ) {
      return null;
    }
    return {
      path: result.path,
      code: result.code,
      error: result.error,
    };
  });

  if (succeeded.some((entry) => entry === null) || failed.some((entry) => entry === null)) {
    return null;
  }

  return {
    action: response.action,
    succeeded: succeeded.filter((entry) => entry !== null),
    failed: failed.filter((entry) => entry !== null),
  };
}

export function LinkManagerPanel({
  target,
  pageSize,
  initialPath = '',
}: LinkManagerPanelProps) {
  const { t } = useLocale();
  const tRef = useRef(t);
  const [searchInput, setSearchInput] = useState(initialPath);
  const [activePrefix, setActivePrefix] = useState('');
  const [items, setItems] = useState<LinkRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<LinkRecord | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [listLoading, setListLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [deletingPath, setDeletingPath] = useState('');
  const [updatingPath, setUpdatingPath] = useState('');
  const [batchAction, setBatchAction] = useState<LinkBatchAction | null>(null);
  const [batchFeedback, setBatchFeedback] = useState<BatchFeedback | null>(null);
  const [pendingDeletePaths, setPendingDeletePaths] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [listError, setListError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedPath, setCopiedPath] = useState('');
  const copyTimerRef = useRef<number | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const showRecord = useCallback((record: LinkRecord) => {
    setSelectedRecord(record);
    if (window.matchMedia('(max-width: 1320px)').matches) {
      window.requestAnimationFrame(() => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const requestPage = useCallback(
    async (
      cursor: string | null,
      prefix: string,
      signal?: AbortSignal,
    ): Promise<LinkListResponse | null> => {
      if (!target) {
        setItems([]);
        setNextCursor(null);
        setListError(tRef.current('common.chooseEnvironment'));
        return null;
      }

      setListLoading(true);
      setListError('');

      const query = new URLSearchParams({
        targetId: target.id,
        limit: String(pageSize),
      });
      if (cursor) query.set('cursor', cursor);
      if (prefix) query.set('prefix', prefix);

      try {
        const response = await fetch(`/api/links?${query.toString()}`, {
          cache: 'no-store',
          signal,
        });
        const payload: unknown = await response.json().catch(() => ({}));

        if (!response.ok) {
          setListError(translateApiError(payload, tRef.current, 'manager.listLoadFailed'));
          return null;
        }

        const result = parseLinkListResponse(payload);
        if (!result) {
          setListError(tRef.current('manager.invalidList'));
          return null;
        }

        setItems(result.items);
        setNextCursor(result.nextCursor);
        setSelectedPaths([]);
        setPendingDeletePaths([]);
        return result;
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return null;
        }
        setListError(tRef.current('common.networkError'));
        return null;
      } finally {
        setListLoading(false);
      }
    },
    [pageSize, target],
  );

  const lookupExact = useCallback(
    async (input: string, signal?: AbortSignal) => {
      const path = normalizeLinkPath(input);
      const pathError = getLinkPathError(path);

      setSearchError('');
      setNotice('');

      if (!target) {
        setSearchError(tRef.current('common.chooseEnvironment'));
        return;
      }
      if (pathError) {
        setSearchError(translateValidationError(pathError, tRef.current));
        return;
      }

      setLookupLoading(true);
      try {
        const response = await fetch(
          `/api/links/${encodeLinkPath(path)}?targetId=${encodeURIComponent(target.id)}`,
          { cache: 'no-store', signal },
        );
        const payload: unknown = await response.json().catch(() => ({}));

        if (!response.ok) {
          setSearchError(translateApiError(payload, tRef.current, 'manager.queryFailed'));
          return;
        }
        if (!isLinkRecord(payload)) {
          setSearchError(tRef.current('manager.invalidRecord'));
          return;
        }

        showRecord(payload);
        setSearchInput(path);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        setSearchError(tRef.current('common.networkError'));
      } finally {
        setLookupLoading(false);
      }
    },
    [showRecord, target],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
      setSelectedRecord(null);
      setSelectedPaths([]);
      void requestPage(null, '', controller.signal);
      if (initialPath) void lookupExact(initialPath, controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [initialPath, lookupExact, requestPage]);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
  }, []);

  function getBatchActionLabel(action: LinkBatchAction) {
    if (action === 'enable') return t('manager.actionEnable');
    if (action === 'disable') return t('manager.actionDisable');
    return t('manager.actionDelete');
  }

  async function applyPrefix() {
    const prefix = normalizeLinkPrefix(searchInput);

    setSearchError('');
    setNotice('');

    if (prefix) {
      const prefixError = getLinkPrefixError(prefix);
      if (prefixError) {
        setSearchError(translateValidationError(prefixError, t));
        return;
      }
    }

    const result = await requestPage(null, prefix);
    if (!result) return;

    setActivePrefix(prefix);
    setSearchInput(prefix);
    setCursorStack([null]);
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void applyPrefix();
  }

  async function handlePreviousPage() {
    if (cursorStack.length <= 1) return;

    const previousCursor = cursorStack[cursorStack.length - 2] ?? null;
    const result = await requestPage(previousCursor, activePrefix);
    if (result) setCursorStack((current) => current.slice(0, -1));
  }

  async function handleNextPage() {
    if (!nextCursor) return;

    const cursor = nextCursor;
    const result = await requestPage(cursor, activePrefix);
    if (result) setCursorStack((current) => [...current, cursor]);
  }

  async function copyShortUrl(record: LinkRecord) {
    if (!target) return;

    try {
      await navigator.clipboard.writeText(
        buildShortUrl(target.redirectBaseUrl, record.path),
      );
      setCopiedPath(record.path);
      setNotice(t('manager.copiedNotice', { path: record.path }));
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedPath('');
        setNotice('');
      }, 1_800);
    } catch {
      setSearchError(t('manager.copyFailed'));
    }
  }

  async function updateLink(
    record: LinkRecord,
    update: LinkUpdateInput,
  ): Promise<boolean> {
    if (!target) return false;

    setUpdatingPath(record.path);
    setSearchError('');
    setNotice('');

    try {
      const response = await fetch(
        `/api/links/${encodeLinkPath(record.path)}?targetId=${encodeURIComponent(target.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetId: target.id, ...update }),
        },
      );
      const payload: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSearchError(translateApiError(payload, t, 'manager.updateFailed'));
        return false;
      }
      if (!isLinkRecord(payload)) {
        setSearchError(t('manager.invalidUpdate'));
        return false;
      }

      const updatedRecord = payload;
      setItems((current) => current.map((item) => (
        item.path === updatedRecord.path ? updatedRecord : item
      )));
      setSelectedRecord((current) => (
        current?.path === updatedRecord.path ? updatedRecord : current
      ));
      setNotice(t('manager.updatedNotice', { path: updatedRecord.path }));
      return true;
    } catch {
      setSearchError(t('common.networkError'));
      return false;
    } finally {
      setUpdatingPath('');
    }
  }

  function toggleSelection(path: string) {
    setPendingDeletePaths([]);
    setSelectedPaths((current) => (
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path]
    ));
  }

  function toggleAllVisible() {
    setPendingDeletePaths([]);
    const visiblePaths = items.map((record) => record.path);
    const allSelected = visiblePaths.every((path) => selectedPaths.includes(path));
    setSelectedPaths(allSelected ? [] : visiblePaths);
  }

  async function runBatchAction(
    action: LinkBatchAction,
    paths: string[] = selectedPaths,
    deleteConfirmed = false,
  ) {
    if (!target || paths.length === 0) return;

    const requestedPaths = [...paths];
    if (action === 'delete' && !deleteConfirmed) {
      setBatchFeedback(null);
      setPendingDeletePaths(requestedPaths);
      return;
    }

    setPendingDeletePaths([]);
    setBatchAction(action);
    setBatchFeedback(null);
    setSearchError('');
    setNotice('');

    const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
    const reconcilePage = async () => {
      const refreshed = await requestPage(currentCursor, activePrefix);
      if (
        action === 'delete'
        && refreshed?.items.length === 0
        && cursorStack.length > 1
      ) {
        const previousCursor = cursorStack[cursorStack.length - 2] ?? null;
        const previousPage = await requestPage(previousCursor, activePrefix);
        if (previousPage) setCursorStack((current) => current.slice(0, -1));
      }
    };

    try {
      const response = await fetch('/api/links/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: target.id,
          action,
          paths: requestedPaths,
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSearchError(translateApiError(payload, t, 'manager.batchFailed'));
        setBatchFeedback({
          kind: 'uncertain',
          action,
          requestedCount: requestedPaths.length,
        });
        await reconcilePage();
        return;
      }

      const result = parseLinkBatchResponse(payload);
      if (!result) {
        setSearchError(t('manager.invalidBatch'));
        setBatchFeedback({
          kind: 'uncertain',
          action,
          requestedCount: requestedPaths.length,
        });
        await reconcilePage();
        return;
      }

      const successfulPaths = new Set(result.succeeded.map((entry) => entry.path));
      const updatedItems = new Map(
        result.succeeded
          .filter((entry) => entry.item)
          .map((entry) => [entry.path, entry.item as LinkRecord]),
      );

      setSelectedRecord((current) => {
        if (!current || !successfulPaths.has(current.path)) return current;
        if (action === 'delete') return null;
        return updatedItems.get(current.path) ?? current;
      });
      setItems((current) => current
        .filter((record) => action !== 'delete' || !successfulPaths.has(record.path))
        .map((record) => updatedItems.get(record.path) ?? record));
      setBatchFeedback({
        kind: 'result',
        action,
        succeededCount: result.succeeded.length,
        failed: result.failed,
      });

      await reconcilePage();
      setSelectedPaths(result.failed.map((entry) => entry.path));
    } catch {
      setSearchError(t('common.networkError'));
      setBatchFeedback({
        kind: 'uncertain',
        action,
        requestedCount: requestedPaths.length,
      });
      await reconcilePage();
    } finally {
      setBatchAction(null);
    }
  }

  async function deleteLink(record: LinkRecord) {
    if (!target) return;

    const confirmed = window.confirm(
      t('manager.deleteConfirm', {
        environment: target.name,
        path: record.path,
      }),
    );
    if (!confirmed) return;

    setDeletingPath(record.path);
    setSearchError('');
    setNotice('');

    try {
      const response = await fetch(
        `/api/links/${encodeLinkPath(record.path)}?targetId=${encodeURIComponent(target.id)}`,
        { method: 'DELETE' },
      );
      const payload: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSearchError(translateApiError(payload, t, 'manager.deleteFailed'));
        return;
      }

      if (!isDeleteLinkResponse(payload)) {
        setSearchError(t('manager.invalidDelete'));
        return;
      }

      const result = payload;
      setSelectedRecord((current) => (
        current?.path === result.path ? null : current
      ));
      setItems((current) => current.filter((item) => item.path !== result.path));
      setNotice(t('manager.deletedNotice', { path: result.path }));

      const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
      const refreshed = await requestPage(currentCursor, activePrefix);

      if (refreshed?.items.length === 0 && cursorStack.length > 1) {
        const previousCursor = cursorStack[cursorStack.length - 2] ?? null;
        const previousPage = await requestPage(previousCursor, activePrefix);
        if (previousPage) setCursorStack((current) => current.slice(0, -1));
      }
    } catch {
      setSearchError(t('common.networkError'));
    } finally {
      setDeletingPath('');
    }
  }

  const pageNumber = cursorStack.length;
  const emptyMessage = activePrefix
    ? t('manager.emptyPrefix', { prefix: activePrefix })
    : t('manager.emptyAll');

  return (
    <div className="manager-workspace">
      <section className="panel lookup-panel" aria-labelledby="lookup-title">
        <div className="panel-heading panel-heading-row">
          <div>
            <p className="eyebrow">{t('manager.eyebrow')}</p>
            <h2 id="lookup-title">{t('manager.title')}</h2>
            <p>{t('manager.description')}</p>
          </div>
          <span className="environment-pill">{target?.name ?? t('common.noEnvironment')}</span>
        </div>

        <form className="lookup-form" onSubmit={handleFilterSubmit}>
          <div className="form-field">
            <label htmlFor="lookup-path">{t('manager.pathOrPrefix')}</label>
            <div className="manager-search-row">
              <input
                id="lookup-path"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t('manager.searchPlaceholder')}
                autoComplete="off"
                aria-invalid={searchError ? true : undefined}
                aria-describedby={searchError ? 'lookup-help lookup-error' : 'lookup-help'}
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={listLoading || !target}
              >
                <SearchIcon />
                {listLoading ? t('manager.filtering') : t('manager.filter')}
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={lookupLoading || !target}
                onClick={() => void lookupExact(searchInput)}
              >
                <LinkIcon />
                {lookupLoading ? t('manager.querying') : t('manager.exactQuery')}
              </button>
            </div>
            <p className="field-help" id="lookup-help">
              {t('manager.searchHelp')}
            </p>
          </div>
        </form>

        {searchError ? (
          <div className="alert alert-error" id="lookup-error" role="alert">
            {searchError}
          </div>
        ) : null}
      </section>

      {notice ? <div className="alert alert-success" role="status">{notice}</div> : null}

      <div className="manager-browser">
        <section
          className="panel link-browser-panel"
          aria-labelledby="link-list-title"
          aria-busy={listLoading}
        >
          <header className="link-browser-header">
            <div>
              <p className="eyebrow">{t('manager.listEyebrow')}</p>
              <h2 id="link-list-title">
                {activePrefix
                  ? t('manager.prefixTitle', { prefix: activePrefix })
                  : t('manager.allLinks')}
              </h2>
              <p role="status">{t('manager.pageSummary', {
                page: pageNumber,
                count: items.length,
              })}</p>
            </div>
            <button
              className="icon-button"
              type="button"
              title={t('manager.refresh')}
              aria-label={t('manager.refresh')}
              disabled={listLoading || !target}
              onClick={() => void requestPage(
                cursorStack[cursorStack.length - 1] ?? null,
                activePrefix,
              )}
            >
              <RefreshIcon />
            </button>
          </header>

          {listError ? (
            <div className="list-alert">
              <div className="alert alert-error" role="alert">{listError}</div>
            </div>
          ) : null}

          {selectedPaths.length > 0 ? (
            <div className="bulk-toolbar" role="region" aria-label={t('manager.bulkRegion')}>
              <div>
                <strong>{t('manager.selectedCount', { count: selectedPaths.length })}</strong>
                <button
                  className="bulk-clear-button"
                  type="button"
                  disabled={batchAction !== null || listLoading}
                  onClick={() => {
                    setSelectedPaths([]);
                    setPendingDeletePaths([]);
                  }}
                >
                  {t('manager.clearSelection')}
                </button>
              </div>
              <div className="bulk-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={batchAction !== null || listLoading}
                  onClick={() => void runBatchAction('enable')}
                >
                  {batchAction === 'enable' ? t('manager.enabling') : t('manager.bulkEnable')}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={batchAction !== null || listLoading}
                  onClick={() => void runBatchAction('disable')}
                >
                  {batchAction === 'disable' ? t('manager.disabling') : t('manager.bulkDisable')}
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  disabled={batchAction !== null || listLoading}
                  onClick={() => void runBatchAction('delete')}
                >
                  {batchAction === 'delete' ? t('manager.deleting') : t('manager.bulkDelete')}
                </button>
              </div>
            </div>
          ) : null}

          {pendingDeletePaths.length > 0 ? (
            <div className="batch-confirmation" role="alert">
              <div>
                <strong>{t('manager.batchDeleteReviewTitle')}</strong>
                <p>{t('manager.batchDeleteConfirm', { count: pendingDeletePaths.length })}</p>
                <ul className="batch-path-list">
                  {pendingDeletePaths.slice(0, 5).map((path) => (
                    <li key={path}>{path}</li>
                  ))}
                </ul>
                {pendingDeletePaths.length > 5 ? (
                  <p>{t('manager.batchMorePaths', {
                    count: pendingDeletePaths.length - 5,
                  })}</p>
                ) : null}
              </div>
              <div className="batch-confirmation-actions">
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => void runBatchAction('delete', pendingDeletePaths, true)}
                >
                  {t('manager.batchConfirmDelete')}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setPendingDeletePaths([])}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : null}

          {batchFeedback ? (
            <div
              className={batchFeedback.kind === 'uncertain'
                ? 'batch-feedback is-uncertain'
                : batchFeedback.failed.length > 0
                  ? 'batch-feedback has-failures'
                  : 'batch-feedback is-success'}
              role={batchFeedback.kind === 'uncertain'
                || batchFeedback.failed.length > 0 ? 'alert' : 'status'}
            >
              <div className="batch-feedback-heading">
                <div>
                  <strong>
                    {batchFeedback.kind === 'uncertain'
                      ? t('manager.batchUnknownTitle')
                      : t('manager.batchResultTitle', {
                        action: getBatchActionLabel(batchFeedback.action),
                      })}
                  </strong>
                  <p>
                    {batchFeedback.kind === 'uncertain'
                      ? t('manager.batchUnknownDescription', {
                        count: batchFeedback.requestedCount,
                      })
                      : t('manager.batchResultSummary', {
                        succeeded: batchFeedback.succeededCount,
                        failed: batchFeedback.failed.length,
                      })}
                  </p>
                </div>
                <button
                  className="bulk-clear-button"
                  type="button"
                  onClick={() => setBatchFeedback(null)}
                >
                  {t('manager.batchDismiss')}
                </button>
              </div>

              {batchFeedback.kind === 'result' && batchFeedback.failed.length > 0 ? (
                <>
                  <ul className="batch-failure-list">
                    {batchFeedback.failed.slice(0, 5).map((failure) => (
                      <li key={failure.path}>
                        <code>{failure.path}</code>
                        <span>{translateApiError(
                          failure,
                          t,
                          'manager.batchFailed',
                        )}</span>
                      </li>
                    ))}
                  </ul>
                  {batchFeedback.failed.length > 5 ? (
                    <p>{t('manager.batchMoreFailures', {
                      count: batchFeedback.failed.length - 5,
                    })}</p>
                  ) : null}
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={batchAction !== null || listLoading}
                    onClick={() => void runBatchAction(
                      batchFeedback.action,
                      batchFeedback.failed.map((failure) => failure.path),
                      true,
                    )}
                  >
                    {t('manager.batchRetryFailed')}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          <LinkList
            items={items}
            redirectBaseUrl={target?.redirectBaseUrl ?? ''}
            selectedPath={selectedRecord?.path}
            loading={listLoading}
            emptyMessage={emptyMessage}
            selectedPaths={selectedPaths}
            onSelect={showRecord}
            onCopy={(record) => void copyShortUrl(record)}
            onToggleSelection={toggleSelection}
            onToggleAll={toggleAllVisible}
          />

          <nav className="pagination-controls" aria-label={t('manager.pagination')}>
            <button
              className="button button-secondary"
              type="button"
              disabled={cursorStack.length <= 1 || listLoading}
              onClick={() => void handlePreviousPage()}
            >
              <ChevronLeftIcon />
              {t('manager.previous')}
            </button>
            <span>{t('manager.page', { page: pageNumber })}</span>
            <button
              className="button button-secondary"
              type="button"
              disabled={!nextCursor || listLoading}
              onClick={() => void handleNextPage()}
            >
              {t('manager.next')}
              <ChevronRightIcon />
            </button>
          </nav>
        </section>

        <div
          ref={detailsRef}
          className={selectedRecord
            ? 'manager-detail-shell has-record'
            : 'manager-detail-shell'}
        >
          <LinkDetailsPanel
            key={`${target?.id ?? 'none'}:${selectedRecord?.path ?? 'empty'}:${selectedRecord?.updatedAt ?? ''}`}
            target={target}
            record={selectedRecord}
            deleting={deletingPath === selectedRecord?.path}
            updating={updatingPath === selectedRecord?.path}
            copied={copiedPath === selectedRecord?.path}
            onCopy={(record) => void copyShortUrl(record)}
            onClose={() => setSelectedRecord(null)}
            onDelete={(record) => void deleteLink(record)}
            onUpdate={updateLink}
          />
        </div>
      </div>
    </div>
  );
}
