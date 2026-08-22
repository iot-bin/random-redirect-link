export const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh-CN';
export const LOCALE_COOKIE = 'console-locale';

export function normalizeLocale(value?: string | null): Locale {
  return SUPPORTED_LOCALES.includes(value as Locale)
    ? value as Locale
    : DEFAULT_LOCALE;
}
