'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
  SearchIcon,
} from '@/app/components/Icons';
import { DetailsDrawer } from '@/app/components/DetailsDrawer';
import { LinkDetailsPanel } from '@/app/components/LinkDetailsPanel';
import { LinkList } from '@/app/components/LinkList';
import { DropdownSelect } from '@/app/components/DropdownSelect';
import {
  buildShortUrl,
  encodeLinkPath,
  getLinkPathError,
  normalizeLinkPath,
  normalizeLinkPrefix,
} from '@/lib/link-path';
import type {
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
  view?: 'links' | 'trash';
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

const defaultSearchOptions = { match: 'contains', state: 'all', sort: 'path-asc' };
type SearchOptions = typeof defaultSearchOptions;

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

function parseLinkBatchResponse(value: unknown): LinkBatchResponse | null {
  if (typeof value !== 'object' || value === null) return null;

  const response = value as Record<string, unknown>;
  if (
    response.action !== 'enable'
    && response.action !== 'disable'
    && response.action !== 'delete'
    && response.action !== 'restore'
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
  view = 'links',
}: LinkManagerPanelProps) {
  const { t } = useLocale();
  const tRef = useRef(t);
  const [searchInput, setSearchInput] = useState(initialPath);
  const [activePrefix, setActivePrefix] = useState('');
  const [searchOptions, setSearchOptions] = useState(defaultSearchOptions);
  const activeOptionsRef = useRef(defaultSearchOptions);
  const listRequestRef = useRef(0);
  const [items, setItems] = useState<LinkRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<LinkRecord | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [listLoading, setListLoading] = useState(false);
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
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pendingDeletePaths.length) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    confirmationRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
    confirmationRef.current?.focus({ preventScroll: true });
  }, [pendingDeletePaths.length]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const showRecord = useCallback((record: LinkRecord) => {
    setSelectedRecord(record);
  }, []);

  const requestPage = useCallback(
    async (
      cursor: string | null,
      prefix: string,
      signal?: AbortSignal,
      options: SearchOptions = activeOptionsRef.current,
    ): Promise<LinkListResponse | null> => {
      const requestId = ++listRequestRef.current;
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
        view,
      });
      if (cursor) query.set('cursor', cursor);
      if (prefix) query.set('q', prefix);
      for (const [key, value] of Object.entries(options)) query.set(key, value);

      try {
        const response = await fetch(`/api/links?${query.toString()}`, {
          cache: 'no-store',
          signal,
        });
        const payload: unknown = await response.json().catch(() => ({}));
        if (signal?.aborted || requestId !== listRequestRef.current) return null;

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
        if (signal?.aborted || requestId !== listRequestRef.current) return null;
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return null;
        }
        setListError(tRef.current('common.networkError'));
        return null;
      } finally {
        if (requestId === listRequestRef.current) setListLoading(false);
      }
    },
    [pageSize, target, view],
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
      }
    },
    [showRecord, target],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
      setSelectedRecord(null);
      setSelectedPaths([]);
      activeOptionsRef.current = defaultSearchOptions;
      setSearchOptions(defaultSearchOptions);
      setActivePrefix('');
      setSearchInput(initialPath);
      setCursorStack([null]);
      void requestPage(null, '', controller.signal);
      if (initialPath) void lookupExact(initialPath, controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
      ++listRequestRef.current;
    };
  }, [initialPath, lookupExact, requestPage]);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
  }, []);

  function getBatchActionLabel(action: LinkBatchAction) {
    if (action === 'restore') return t('life.restore');
    if (action === 'enable') return t('manager.actionEnable');
    if (action === 'disable') return t('manager.actionDisable');
    return t('manager.actionDelete');
  }

  async function applyPrefix(reset = false) {
    const options = reset ? defaultSearchOptions : searchOptions;
    let prefix = reset ? '' : searchInput.trim();
    if (options.match === 'prefix') prefix = normalizeLinkPrefix(prefix);
    if (options.match === 'exact') prefix = normalizeLinkPath(prefix);

    setSearchError('');
    setNotice('');

    if (prefix.length > 512 || /[\u0000-\u001f\u007f]/.test(prefix)) {
      setSearchError(t('manager.invalidSearch'));
      return;
    }

    const result = await requestPage(null, prefix, undefined, options);
    if (!result) return;

    activeOptionsRef.current = options;
    setSearchOptions(options);
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
    if (!target?.canWrite) return false;

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
      if (update.restore) {
        setSelectedRecord(null);
        await requestPage(cursorStack[cursorStack.length - 1] ?? null, activePrefix);
        if (view === 'trash') setItems(current => current.filter(item => item.path !== record.path));
        setNotice(t('life.restored', { path: record.path }));
        return true;
      }
      setItems((current) => current.map((item) => (
        item.path === updatedRecord.path ? updatedRecord : item
      )));
      setSelectedRecord((current) => (
        current?.path === updatedRecord.path ? updatedRecord : current
      ));
      await requestPage(cursorStack[cursorStack.length - 1] ?? null, activePrefix);
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
    if (!target?.canWrite) return;
    setPendingDeletePaths([]);
    setSelectedPaths((current) => (
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path]
    ));
  }

  function toggleAllVisible() {
    if (!target?.canWrite) return;
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
    if (!target?.canWrite || paths.length === 0) return;

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
        ['delete', 'restore'].includes(action)
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
        if (action === 'delete' || action === 'restore') return null;
        return updatedItems.get(current.path) ?? current;
      });
      setItems((current) => current
        .filter((record) => !['delete', 'restore'].includes(action) || !successfulPaths.has(record.path))
        .map((record) => updatedItems.get(record.path) ?? record));
      setBatchFeedback({
        kind: 'result',
        action,
        succeededCount: result.succeeded.length,
        failed: result.failed,
      });

      await reconcilePage();
      // A just-written item can still appear in the eventually consistent GSI.
      setItems(current => current
        .filter(record => !['delete', 'restore'].includes(action) || !successfulPaths.has(record.path))
        .map(record => updatedItems.get(record.path) ?? record));
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
    setSelectedRecord(null);
    await runBatchAction('delete', [record.path]);
  }

  const pageNumber = cursorStack.length;
  const emptyMessage = nextCursor ? t('manager.searchContinue') : t('manager.noMatches');

  return (
    <div className="manager-workspace">
      <section className="panel lookup-panel" aria-labelledby="lookup-title">
        <h2 id="lookup-title" className="sr-only">{t('manager.title')}</h2>

        <form className="lookup-form" onSubmit={handleFilterSubmit}>
          <div className="form-field">
            <label className="sr-only" htmlFor="lookup-path">{t('manager.searchLabel')}</label>
            <div className="manager-search-row">
              <input
                id="lookup-path"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t('manager.searchPlaceholder')}
                autoComplete="off"
                maxLength={512}
                disabled={batchAction !== null || Boolean(updatingPath)}
                aria-invalid={searchError ? true : undefined}
                aria-describedby={searchError ? 'lookup-help lookup-error' : 'lookup-help'}
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={listLoading || batchAction !== null || Boolean(updatingPath) || !target}
              >
                <SearchIcon />
                {listLoading ? t('manager.filtering') : t('manager.filter')}
              </button>
            </div>
            <div className="manager-search-options">
              <div className="form-field"><span>{t('manager.matchMode')}</span>
                <DropdownSelect ariaLabel={t('manager.matchMode')} value={searchOptions.match}
                  disabled={listLoading || batchAction !== null || Boolean(updatingPath)}
                  options={[
                    { value: 'contains', label: t('manager.matchContains') },
                    { value: 'prefix', label: t('manager.matchPrefix') },
                    { value: 'exact', label: t('manager.matchExact') },
                  ]} onChange={match => setSearchOptions(current => ({ ...current, match }))} />
              </div>
              <div className="form-field"><span>{t('manager.stateFilter')}</span>
                <DropdownSelect ariaLabel={t('manager.stateFilter')} value={searchOptions.state}
                  disabled={listLoading || batchAction !== null || Boolean(updatingPath)}
                  options={[
                    { value: 'all', label: t('manager.allStates') },
                    ...(view === 'trash' ? [{ value: 'deleted', label: t('life.deleted') }] : [
                      { value: 'active', label: t('life.active') },
                      { value: 'disabled', label: t('life.disabled') },
                      { value: 'scheduled', label: t('life.scheduled') },
                      { value: 'expired', label: t('life.expired') },
                    ]),
                    { value: 'purged', label: t('life.purged') },
                  ]} onChange={state => setSearchOptions(current => ({ ...current, state }))} />
              </div>
              <div className="form-field"><span>{t('manager.sortLabel')}</span>
                <DropdownSelect ariaLabel={t('manager.sortLabel')} value={searchOptions.sort}
                  disabled={listLoading || batchAction !== null || Boolean(updatingPath)}
                  options={[
                    { value: 'path-asc', label: t('manager.sortAsc') },
                    { value: 'path-desc', label: t('manager.sortDesc') },
                  ]} onChange={sort => setSearchOptions(current => ({ ...current, sort }))} />
              </div>
              <button className="button button-secondary" type="button"
                disabled={listLoading || batchAction !== null || Boolean(updatingPath) || !target}
                onClick={() => void applyPrefix(true)}>{t('manager.resetSearch')}</button>
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
              <h2 id="link-list-title">
                {activePrefix
                  ? t('manager.prefixTitle', { prefix: activePrefix })
                  : view === 'trash' ? t('life.trash') : t('manager.allLinks')}
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
                  disabled={!target?.canWrite || batchAction !== null || listLoading}
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
                  disabled={!target?.canWrite || batchAction !== null || listLoading}
                  hidden={view === 'trash'}
                  onClick={() => void runBatchAction('enable')}
                >
                  {batchAction === 'enable' ? t('manager.enabling') : t('manager.bulkEnable')}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!target?.canWrite || batchAction !== null || listLoading}
                  hidden={view === 'trash'}
                  onClick={() => void runBatchAction('disable')}
                >
                  {batchAction === 'disable' ? t('manager.disabling') : t('manager.bulkDisable')}
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  disabled={!target?.canWrite || batchAction !== null || listLoading}
                  hidden={view === 'trash'}
                  onClick={() => void runBatchAction('delete')}
                >
                  {batchAction === 'delete' ? t('manager.deleting') : t('manager.bulkDelete')}
                </button>
                {view === 'trash' ? <button className="button button-primary" type="button" disabled={!target?.canWrite || batchAction !== null || listLoading} onClick={() => void runBatchAction('restore')}>{t('life.restore')}</button> : null}
              </div>
            </div>
          ) : null}

          {pendingDeletePaths.length > 0 ? (
            <div className="batch-confirmation" role="alert" ref={confirmationRef} tabIndex={-1}>
              <div>
                <strong>{t('manager.batchDeleteReviewTitle')}</strong>
                <p>{target?.name}</p>
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
                    disabled={!target?.canWrite || batchAction !== null || listLoading}
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
            selectionDisabled={!target?.canWrite}
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

        <DetailsDrawer open={Boolean(selectedRecord)} onClose={() => setSelectedRecord(null)}>
          {selectedRecord ? (
            <LinkDetailsPanel
              key={`${target?.id ?? 'none'}:${selectedRecord?.path ?? 'empty'}:${selectedRecord?.updatedAt ?? ''}`}
              target={target}
              record={selectedRecord}
              deleting={batchAction !== null}
              updating={updatingPath === selectedRecord?.path}
              copied={copiedPath === selectedRecord?.path}
              onCopy={(record) => void copyShortUrl(record)}
              onDelete={(record) => void deleteLink(record)}
              onUpdate={updateLink}
              updateError={searchError}
            />
          ) : null}
        </DetailsDrawer>
      </div>
    </div>
  );
}
