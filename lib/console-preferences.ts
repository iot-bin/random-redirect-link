// Keep a full page within the backend's 50-link batch-operation limit.
export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 25;
export const CONSOLE_PREFERENCES_STORAGE_KEY = 'short-link-console-preferences-v1';

export interface ConsolePreferences {
  targetId: string;
  pageSize: PageSize;
}

export function normalizePageSize(value: unknown): PageSize {
  return PAGE_SIZE_OPTIONS.includes(value as PageSize)
    ? value as PageSize
    : DEFAULT_PAGE_SIZE;
}
