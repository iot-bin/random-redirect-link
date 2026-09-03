'use client';

import { useRouter } from 'next/navigation';
import { DropdownSelect } from '@/app/components/DropdownSelect';
import {
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/i18n/config';
import { useLocale } from '@/lib/i18n/LocaleProvider';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={compact ? 'language-switcher is-compact' : 'language-switcher'}>
      {compact ? null : <span>{t('language.label')}</span>}
      <DropdownSelect<Locale>
        ariaLabel={t('language.label')}
        value={locale}
        options={SUPPORTED_LOCALES.map((option) => ({
          value: option,
          label: t(`language.${option}`),
        }))}
        onChange={(nextLocale) => {
          setLocale(nextLocale);
          router.refresh();
        }}
      />
    </div>
  );
}
