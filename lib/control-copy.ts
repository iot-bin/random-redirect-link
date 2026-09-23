import type { Locale } from './i18n/config';
import { messages, type MessageKey } from './i18n/messages';

type ControlMessageKey = Extract<MessageKey, `control.${string}`>;
type ControlCopy = {
  [Key in ControlMessageKey as Key extends `control.${infer Name}` ? Name : never]: string;
};

function copyFor(locale: Locale): ControlCopy {
  return Object.fromEntries(
    Object.entries(messages[locale])
      .filter(([key]) => key.startsWith('control.'))
      .map(([key, value]) => [key.slice('control.'.length), value]),
  ) as ControlCopy;
}

export const controlCopy: Record<Locale, ControlCopy> = {
  en: copyFor('en'),
  'zh-CN': copyFor('zh-CN'),
  'zh-TW': copyFor('zh-TW'),
};
