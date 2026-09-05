'use client';

import { useLocale } from '@/lib/i18n/LocaleProvider';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  return (
    <main className="status-page">
      <section className="status-card" role="alert">
        <p className="status-code">500</p>
        <h1>{t('error.title')}</h1>
        <p>{t('error.description')}</p>
        <div className="status-actions">
          <button className="button button-primary" type="button" onClick={reset}>
            {t('error.retry')}
          </button>
        </div>
      </section>
    </main>
  );
}
