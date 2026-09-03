'use client';

import { useRouter } from 'next/navigation';
import { DropdownSelect } from '@/app/components/DropdownSelect';
import {
  type ThemePreference,
  useTheme,
} from '@/app/components/ThemeProvider';
import {
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from '@/lib/console-preferences';
import {
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/i18n/config';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { PublicApiTarget } from '@/lib/link-types';

interface SettingsPanelProps {
  targets: PublicApiTarget[];
  selectedTargetId: string;
  pageSize: PageSize;
  onTargetChange: (targetId: string) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}

export function SettingsPanel({
  targets,
  selectedTargetId,
  pageSize,
  onTargetChange,
  onPageSizeChange,
}: SettingsPanelProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const { preference, setTheme } = useTheme();

  const environmentOptions = targets.map((target) => ({
    value: target.id,
    label: target.name,
    description: target.redirectBaseUrl.replace(/^https?:\/\//, ''),
  }));
  const languageOptions = SUPPORTED_LOCALES.map((option) => ({
    value: option,
    label: t(`language.${option}`),
  }));
  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: 'system', label: t('settings.themeSystem') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ];
  const pageSizeOptions = PAGE_SIZE_OPTIONS.map((option) => ({
    value: String(option),
    label: t('settings.pageSizeValue', { count: option }),
  }));

  return (
    <section className="panel settings-panel" aria-labelledby="settings-title">
      <div className="panel-heading settings-heading">
        <p className="eyebrow">{t('settings.eyebrow')}</p>
        <h2 id="settings-title">{t('settings.title')}</h2>
        <p>{t('settings.description')}</p>
      </div>

      <div className="settings-list">
        <div className="settings-row">
          <div>
            <label id="settings-environment-label" htmlFor="settings-environment">
              {t('settings.defaultEnvironment')}
            </label>
            <p>{t('settings.defaultEnvironmentDescription')}</p>
          </div>
          <DropdownSelect
            id="settings-environment"
            ariaLabel={t('settings.defaultEnvironment')}
            value={selectedTargetId}
            options={environmentOptions}
            disabled={environmentOptions.length === 0}
            onChange={onTargetChange}
          />
        </div>

        <div className="settings-row">
          <div>
            <label htmlFor="settings-language">{t('settings.language')}</label>
            <p>{t('settings.languageDescription')}</p>
          </div>
          <DropdownSelect<Locale>
            id="settings-language"
            ariaLabel={t('settings.language')}
            value={locale}
            options={languageOptions}
            onChange={(nextLocale) => {
              setLocale(nextLocale);
              router.refresh();
            }}
          />
        </div>

        <div className="settings-row">
          <div>
            <label htmlFor="settings-theme">{t('settings.theme')}</label>
            <p>{t('settings.themeDescription')}</p>
          </div>
          <DropdownSelect<ThemePreference>
            id="settings-theme"
            ariaLabel={t('settings.theme')}
            value={preference}
            options={themeOptions}
            onChange={setTheme}
          />
        </div>

        <div className="settings-row">
          <div>
            <label htmlFor="settings-page-size">{t('settings.pageSize')}</label>
            <p>{t('settings.pageSizeDescription')}</p>
          </div>
          <DropdownSelect
            id="settings-page-size"
            ariaLabel={t('settings.pageSize')}
            value={String(pageSize)}
            options={pageSizeOptions}
            onChange={(nextPageSize) => onPageSizeChange(Number(nextPageSize) as PageSize)}
          />
        </div>
      </div>
    </section>
  );
}
