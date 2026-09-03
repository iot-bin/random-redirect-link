'use client';

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  CONSOLE_PREFERENCES_STORAGE_KEY,
  DEFAULT_PAGE_SIZE,
  normalizePageSize,
  type ConsolePreferences,
} from '@/lib/console-preferences';

const PREFERENCES_CHANGE_EVENT = 'short-link-console-preferences-change';
let volatileSnapshot: string | null = null;

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(PREFERENCES_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(PREFERENCES_CHANGE_EVENT, onStoreChange);
  };
}

function readSnapshot(defaultSnapshot: string, validTargetIds: ReadonlySet<string>): string {
  try {
    const saved = volatileSnapshot ?? localStorage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY);
    if (!saved) return defaultSnapshot;

    const parsed = JSON.parse(saved) as Partial<ConsolePreferences>;
    const defaults = JSON.parse(defaultSnapshot) as ConsolePreferences;
    return JSON.stringify({
      targetId: typeof parsed.targetId === 'string' && validTargetIds.has(parsed.targetId)
        ? parsed.targetId
        : defaults.targetId,
      pageSize: normalizePageSize(parsed.pageSize),
    } satisfies ConsolePreferences);
  } catch {
    return defaultSnapshot;
  }
}

export function useConsolePreferences(
  targetIds: ReadonlyArray<string>,
  initialTargetId: string,
) {
  const validTargetIds = useMemo(() => new Set(targetIds), [targetIds]);
  const defaultSnapshot = useMemo(() => JSON.stringify({
    targetId: initialTargetId,
    pageSize: DEFAULT_PAGE_SIZE,
  } satisfies ConsolePreferences), [initialTargetId]);
  const getSnapshot = useCallback(
    () => readSnapshot(defaultSnapshot, validTargetIds),
    [defaultSnapshot, validTargetIds],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => defaultSnapshot);
  const preferences = useMemo(
    () => JSON.parse(snapshot) as ConsolePreferences,
    [snapshot],
  );

  const updatePreferences = useCallback((nextPreferences: ConsolePreferences) => {
    const nextSnapshot = JSON.stringify(nextPreferences);
    try {
      localStorage.setItem(
        CONSOLE_PREFERENCES_STORAGE_KEY,
        nextSnapshot,
      );
      volatileSnapshot = null;
    } catch {
      // Settings remain usable until the page is reloaded when storage is unavailable.
      volatileSnapshot = nextSnapshot;
    }
    window.dispatchEvent(new Event(PREFERENCES_CHANGE_EVENT));
  }, []);

  return { preferences, updatePreferences };
}
