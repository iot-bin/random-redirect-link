'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConsoleDashboard } from './ConsoleDashboard';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { translateApiError } from '@/lib/i18n/errors';
import type { PublicApiTarget } from '@/lib/link-types';
import { ConsoleSkeleton } from './ConsoleSkeleton';
export interface ConsoleContext {
  targets: PublicApiTarget[];
  defaultTargetId: string | null;
  preferences: { targetId?: string; pageSize?: number };
  site: { title?: string; description?: string };
  user: { sub: string; role: string };
}
export function ConsoleLoader({ initialData, initialError = '' }: { initialData: ConsoleContext | null; initialError?: string }) {
  const [data, setData] = useState<ConsoleContext | null>(initialData);
  const [error, setError] = useState(initialError);
  const [revision, setRevision] = useState(0);
  const router = useRouter();
  const { t } = useLocale();
  useEffect(() => {
    if (revision === 0 && (initialData || initialError)) return;
    const controller = new AbortController();
    fetch('/api/targets', { cache: 'no-store', signal: controller.signal }).then(async r => {
      const payload = await r.json();
      if (!r.ok) {
        if (r.status === 401 || ['INVALID_PASSWORD','SESSION_EXPIRED'].includes(payload.code)) router.replace('/login');
        setData(null); setError(payload.code || 'UPSTREAM_UNAVAILABLE'); return;
      }
      setData(payload); setError('');
    }).catch(() => { if (!controller.signal.aborted) { setData(null); setError('UPSTREAM_UNAVAILABLE'); } });
    return () => controller.abort();
  }, [router, initialData, initialError, revision]);
  if (!data && !error) return <ConsoleSkeleton />;
  if (!data) return <main className="console-main"><section className="panel">
    <p role="alert">{translateApiError({code:error}, t, 'api.unavailable')}</p>
    {error ? <button className="button" onClick={() => setRevision(v => v + 1)}>{t('auth.retry')}</button> : null}
    <a className="button" href="/login">{t('auth.back')}</a>
  </section></main>;
  return <ConsoleDashboard key={data.user.sub} {...data} onConfigurationChange={() => setRevision(v => v + 1)} />;
}
