'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  LOCALE_COOKIE,
  type Locale,
} from '@/lib/i18n/config';
import {
  messages,
  type MessageKey,
} from '@/lib/i18n/messages';

type TranslationValue = string | number;
type TranslationValues = Record<string, TranslationValue>;

export type Translate = (
  key: MessageKey,
  values?: TranslationValues,
) => string;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function interpolate(message: string, values?: TranslationValues): string {
  if (!values) return message;

  return message.replace(/\{(\w+)\}/g, (match, key: string) => (
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : match
  ));
}

export function LocaleProvider({
  initialLocale,
  children,
}: Readonly<{
  initialLocale: Locale;
  children: React.ReactNode;
}>) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    updateLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const t = useCallback<Translate>((key, values) => (
    interpolate(messages[locale][key], values)
  ), [locale]);

  const contextValue = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}
