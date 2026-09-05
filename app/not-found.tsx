'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export default function NotFoundPage() {
  const { t } = useLocale();

  return (
    <main className="status-page">
      <section className="status-card">
        <p className="status-code">404</p>
        <h1>{t('notFound.title')}</h1>
        <p>{t('notFound.description')}</p>
        <div className="status-actions">
          <Link className="button button-primary" href="/">
            {t('notFound.home')}
          </Link>
        </div>
      </section>
    </main>
  );
}
