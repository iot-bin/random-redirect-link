'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConsoleDashboard } from './ConsoleDashboard';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { translateApiError } from '@/lib/i18n/errors';
import type { PublicApiTarget } from '@/lib/link-types';
export interface ConsoleContext {
  targets: PublicApiTarget[];
  defaultTargetId: string | null;
  preferences: { targetId?: string; pageSize?: number };
  site: { title?: string; description?: string };
  user: { sub: string; role: string };
}
export function ConsoleLoader() {
  const [data, setData] = useState<ConsoleContext | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const router = useRouter();
  const { t } = useLocale();
  useEffect(() => {
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
  }, [router, revision]);
  if (!data) return <main className="console-main"><section className="panel">
    <p role={error ? "alert" : "status"}>{error ? translateApiError({code:error}, t, 'api.unavailable') : t('auth.loading')}</p>
    {error ? <button className="button" onClick={() => setRevision(v => v + 1)}>{t('auth.retry')}</button> : null}
    <a className="button" href="/login">{t('auth.back')}</a>
  </section></main>;
  return <ConsoleDashboard key={data.user.sub} {...data} onConfigurationChange={() => setRevision(v => v + 1)} />;
}
