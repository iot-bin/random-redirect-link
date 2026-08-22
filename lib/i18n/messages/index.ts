import { en } from '@/lib/i18n/messages/en';
import { zhCN, type MessageKey } from '@/lib/i18n/messages/zh-CN';
import { zhTW } from '@/lib/i18n/messages/zh-TW';
import type { Locale } from '@/lib/i18n/config';

export type { MessageKey };

export const messages: Record<Locale, Record<MessageKey, string>> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
};
