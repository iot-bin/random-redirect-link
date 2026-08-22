'use client';

import { useRouter } from 'next/navigation';
import {
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/i18n/config';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();

  return (
    <label className={compact ? 'language-switcher is-compact' : 'language-switcher'}>
      <span>{compact ? <span className="sr-only">{t('language.label')}</span> : t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        value={locale}
        onChange={(event) => {
          setLocale(event.target.value as Locale);
          router.refresh();
        }}
      >
        {SUPPORTED_LOCALES.map((option) => (
          <option key={option} value={option}>
            {t(`language.${option}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
