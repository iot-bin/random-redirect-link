import type { LinkBatchAction, LinkBatchResponse, LinkListResponse, LinkRecord } from './link-types';

export const LINK_BATCH_ACTIONS = ['enable', 'disable', 'delete', 'restore'] as const satisfies readonly LinkBatchAction[];

export function isLinkBatchAction(value: unknown): value is LinkBatchAction {
  return typeof value === 'string' && LINK_BATCH_ACTIONS.some((action) => action === value);
}

export function isLinkRecord(value: unknown): value is LinkRecord {
  return typeof value === 'object' && value !== null
    && typeof (value as Record<string, unknown>).path === 'string'
    && (value as Record<string, unknown>).path !== '';
}

export function parseLinkListResponse(value: unknown): LinkListResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const response = value as Record<string, unknown>;
  if (!Array.isArray(response.items) || !response.items.every(isLinkRecord)) return null;
  if (response.nextCursor !== null && typeof response.nextCursor !== 'string') return null;
  return { items: response.items, nextCursor: response.nextCursor };
}

export function parseLinkBatchResponse(value: unknown): LinkBatchResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const response = value as Record<string, unknown>;
  if (!isLinkBatchAction(response.action)) return null;
  if (!Array.isArray(response.succeeded) || !Array.isArray(response.failed)) return null;

  const succeeded = response.succeeded.map((entry) => {
    if (typeof entry !== 'object' || entry === null) return null;
    const result = entry as Record<string, unknown>;
    if (typeof result.path !== 'string' || !result.path) return null;
    if (result.item !== undefined && !isLinkRecord(result.item)) return null;
    return { path: result.path, ...(isLinkRecord(result.item) ? { item: result.item } : {}) };
  });
  const failed = response.failed.map((entry) => {
    if (typeof entry !== 'object' || entry === null) return null;
    const result = entry as Record<string, unknown>;
    if (typeof result.path !== 'string' || typeof result.code !== 'string' || typeof result.error !== 'string') return null;
    return { path: result.path, code: result.code, error: result.error };
  });
  if (succeeded.some((entry) => entry === null) || failed.some((entry) => entry === null)) return null;
  return { action: response.action, succeeded: succeeded.filter((entry) => entry !== null), failed: failed.filter((entry) => entry !== null) };
}
