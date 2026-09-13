'use client';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export function ConsoleSkeleton() {
  const { t } = useLocale();
  return <div className="workspace-skeleton" role="status" aria-busy="true" aria-label={t('auth.loading')}>
    <aside aria-hidden="true"><div className="skeleton-bar skeleton-brand" />{[0,1,2,3].map(i=><div key={i} className="skeleton-bar" />)}</aside>
    <main aria-hidden="true"><div className="skeleton-toolbar"><div className="skeleton-bar" /></div><div className="skeleton-content"><div className="skeleton-bar skeleton-title" /><section className="panel">{[0,1,2].map(i=><div key={i} className="skeleton-field"><div className="skeleton-bar" /><div className="skeleton-bar skeleton-input" /></div>)}</section></div></main>
  </div>;
}
