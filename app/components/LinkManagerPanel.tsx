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
  ApiError,
  DeleteLinkResponse,
  LinkBatchAction,
  LinkBatchResponse,
  LinkListResponse,
  LinkRecord,
  LinkUpdateInput,
  PublicApiTarget,
} from '@/lib/link-types';

interface LinkManagerPanelProps {
  target: PublicApiTarget | null;
  initialPath?: string;
}

const PAGE_SIZE = 25;

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).error === 'string'
  );
}

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
  initialPath = '',
}: LinkManagerPanelProps) {
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
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [listError, setListError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedPath, setCopiedPath] = useState('');
  const copyTimerRef = useRef<number | null>(null);

  const requestPage = useCallback(
    async (
      cursor: string | null,
      prefix: string,
      signal?: AbortSignal,
    ): Promise<LinkListResponse | null> => {
      if (!target) {
        setItems([]);
        setNextCursor(null);
        setListError('请选择运行环境');
        return null;
      }

      setListLoading(true);
      setListError('');

      const query = new URLSearchParams({
        targetId: target.id,
        limit: String(PAGE_SIZE),
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
          setListError(isApiError(payload) ? payload.error : '列表加载失败，请稍后重试');
          return null;
        }

        const result = parseLinkListResponse(payload);
        if (!result) {
          setListError('后台返回的列表格式无效，请稍后重试');
          return null;
        }

        setItems(result.items);
        setNextCursor(result.nextCursor);
        setSelectedPaths([]);
        return result;
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return null;
        }
        setListError('网络连接失败，请稍后重试');
        return null;
      } finally {
        setListLoading(false);
      }
    },
    [target],
  );

  const lookupExact = useCallback(
    async (input: string, signal?: AbortSignal) => {
      const path = normalizeLinkPath(input);
      const pathError = getLinkPathError(path);

      setSearchError('');
      setNotice('');

      if (!target) {
        setSearchError('请选择运行环境');
        return;
      }
      if (pathError) {
        setSearchError(pathError);
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
          setSearchError(isApiError(payload) ? payload.error : '查询失败，请稍后重试');
          return;
        }
        if (!isLinkRecord(payload)) {
          setSearchError('后台返回的链接格式无效，请稍后重试');
          return;
        }

        setSelectedRecord(payload);
        setSearchInput(path);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        setSearchError('网络连接失败，请稍后重试');
      } finally {
        setLookupLoading(false);
      }
    },
    [target],
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

  async function applyPrefix() {
    const prefix = normalizeLinkPrefix(searchInput);

    setSearchError('');
    setNotice('');

    if (prefix) {
      const prefixError = getLinkPrefixError(prefix);
      if (prefixError) {
        setSearchError(prefixError);
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
      setNotice(`已复制短链“${record.path}”`);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedPath('');
        setNotice('');
      }, 1_800);
    } catch {
      setSearchError('无法复制短链，请手动选择链接地址');
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
        setSearchError(isApiError(payload) ? payload.error : '更新失败，请稍后重试');
        return false;
      }
      if (!isLinkRecord(payload)) {
        setSearchError('后台返回的更新结果无效，请稍后重试');
        return false;
      }

      const updatedRecord = payload;
      setItems((current) => current.map((item) => (
        item.path === updatedRecord.path ? updatedRecord : item
      )));
      setSelectedRecord((current) => (
        current?.path === updatedRecord.path ? updatedRecord : current
      ));
      setNotice(`短链“${updatedRecord.path}”已更新`);
      return true;
    } catch {
      setSearchError('网络连接失败，请稍后重试');
      return false;
    } finally {
      setUpdatingPath('');
    }
  }

  function toggleSelection(path: string) {
    setSelectedPaths((current) => (
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path]
    ));
  }

  function toggleAllVisible() {
    const visiblePaths = items.map((record) => record.path);
    const allSelected = visiblePaths.every((path) => selectedPaths.includes(path));
    setSelectedPaths(allSelected ? [] : visiblePaths);
  }

  async function runBatchAction(action: LinkBatchAction) {
    if (!target || selectedPaths.length === 0) return;

    if (action === 'delete') {
      const confirmed = window.confirm(
        `确定要删除已选择的 ${selectedPaths.length} 条短链吗？此操作无法撤销。`,
      );
      if (!confirmed) return;
    }

    setBatchAction(action);
    setSearchError('');
    setNotice('');

    try {
      const response = await fetch('/api/links/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: target.id,
          action,
          paths: selectedPaths,
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSearchError(isApiError(payload) ? payload.error : '批量操作失败，请稍后重试');
        return;
      }

      const result = parseLinkBatchResponse(payload);
      if (!result) {
        setSearchError('后台返回的批量操作结果无效，请稍后重试');
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

      const actionLabel = action === 'enable'
        ? '启用'
        : action === 'disable' ? '停用' : '删除';
      setNotice(`批量${actionLabel}完成：成功 ${result.succeeded.length} 条`);
      if (result.failed.length > 0) {
        setSearchError(`另有 ${result.failed.length} 条操作失败，请刷新后重试`);
      }

      const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
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
    } catch {
      setSearchError('网络连接失败，请稍后重试');
    } finally {
      setBatchAction(null);
    }
  }

  async function deleteLink(record: LinkRecord) {
    if (!target) return;

    const confirmed = window.confirm(
      `确定要从“${target.name}”删除短链“${record.path}”吗？此操作无法撤销。`,
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
        setSearchError(isApiError(payload) ? payload.error : '删除失败，请稍后重试');
        return;
      }

      if (!isDeleteLinkResponse(payload)) {
        setSearchError('后台返回的删除结果无效，请稍后重试');
        return;
      }

      const result = payload;
      setSelectedRecord((current) => (
        current?.path === result.path ? null : current
      ));
      setItems((current) => current.filter((item) => item.path !== result.path));
      setNotice(`短链“${result.path}”已删除`);

      const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
      const refreshed = await requestPage(currentCursor, activePrefix);

      if (refreshed?.items.length === 0 && cursorStack.length > 1) {
        const previousCursor = cursorStack[cursorStack.length - 2] ?? null;
        const previousPage = await requestPage(previousCursor, activePrefix);
        if (previousPage) setCursorStack((current) => current.slice(0, -1));
      }
    } catch {
      setSearchError('网络连接失败，请稍后重试');
    } finally {
      setDeletingPath('');
    }
  }

  const pageNumber = cursorStack.length;
  const emptyMessage = activePrefix
    ? `没有路径以“${activePrefix}”开头的短链。`
    : '当前环境暂时没有短链记录。';

  return (
    <div className="manager-workspace">
      <section className="panel lookup-panel" aria-labelledby="lookup-title">
        <div className="panel-heading panel-heading-row">
          <div>
            <p className="eyebrow">列表与查询</p>
            <h2 id="lookup-title">浏览后台短链</h2>
            <p>留空显示全部链接，也可以按路径前缀筛选或精确定位。</p>
          </div>
          <span className="environment-pill">{target?.name ?? '未选择环境'}</span>
        </div>

        <form className="lookup-form" onSubmit={handleFilterSubmit}>
          <div className="form-field">
            <label htmlFor="lookup-path">路径或路径前缀</label>
            <div className="manager-search-row">
              <input
                id="lookup-path"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="留空显示全部，例如：download/"
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
                {listLoading ? '正在筛选…' : '筛选列表'}
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={lookupLoading || !target}
                onClick={() => void lookupExact(searchInput)}
              >
                <LinkIcon />
                {lookupLoading ? '正在查询…' : '精确查询'}
              </button>
            </div>
            <p className="field-help" id="lookup-help">
              列表按路径升序排列；前缀筛选区分大小写，精确查询需要完整路径。
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
              <p className="eyebrow">链接列表</p>
              <h2 id="link-list-title">
                {activePrefix ? `前缀：${activePrefix}` : '全部链接'}
              </h2>
              <p role="status">第 {pageNumber} 页 · 本页 {items.length} 条</p>
            </div>
            <button
              className="icon-button"
              type="button"
              title="刷新当前页"
              aria-label="刷新当前页"
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
            <div className="bulk-toolbar" role="region" aria-label="批量操作">
              <div>
                <strong>已选择 {selectedPaths.length} 条</strong>
                <button
                  className="bulk-clear-button"
                  type="button"
                  disabled={batchAction !== null || listLoading}
                  onClick={() => setSelectedPaths([])}
                >
                  取消选择
                </button>
              </div>
              <div className="bulk-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={batchAction !== null || listLoading}
                  onClick={() => void runBatchAction('enable')}
                >
                  {batchAction === 'enable' ? '正在启用…' : '批量启用'}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={batchAction !== null || listLoading}
                  onClick={() => void runBatchAction('disable')}
                >
                  {batchAction === 'disable' ? '正在停用…' : '批量停用'}
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  disabled={batchAction !== null || listLoading}
                  onClick={() => void runBatchAction('delete')}
                >
                  {batchAction === 'delete' ? '正在删除…' : '批量删除'}
                </button>
              </div>
            </div>
          ) : null}

          <LinkList
            items={items}
            redirectBaseUrl={target?.redirectBaseUrl ?? ''}
            selectedPath={selectedRecord?.path}
            loading={listLoading}
            emptyMessage={emptyMessage}
            selectedPaths={selectedPaths}
            onSelect={setSelectedRecord}
            onCopy={(record) => void copyShortUrl(record)}
            onToggleSelection={toggleSelection}
            onToggleAll={toggleAllVisible}
          />

          <nav className="pagination-controls" aria-label="链接列表分页">
            <button
              className="button button-secondary"
              type="button"
              disabled={cursorStack.length <= 1 || listLoading}
              onClick={() => void handlePreviousPage()}
            >
              <ChevronLeftIcon />
              上一页
            </button>
            <span>第 {pageNumber} 页</span>
            <button
              className="button button-secondary"
              type="button"
              disabled={!nextCursor || listLoading}
              onClick={() => void handleNextPage()}
            >
              下一页
              <ChevronRightIcon />
            </button>
          </nav>
        </section>

        <LinkDetailsPanel
          key={`${target?.id ?? 'none'}:${selectedRecord?.path ?? 'empty'}:${selectedRecord?.updatedAt ?? ''}`}
          target={target}
          record={selectedRecord}
          deleting={deletingPath === selectedRecord?.path}
          updating={updatingPath === selectedRecord?.path}
          copied={copiedPath === selectedRecord?.path}
          onCopy={(record) => void copyShortUrl(record)}
          onDelete={(record) => void deleteLink(record)}
          onUpdate={updateLink}
        />
      </div>
    </div>
  );
}
