import type { Locale } from './locale';
import { en } from './messages/en';
import { es } from './messages/es';
import type { Message } from './messages/types';

export type { Message } from './messages/types';

export type MessageKey = keyof typeof es;

export const catalogs: Record<Locale, Record<MessageKey, Message>> = {
  es,
  en,
};

export type Params = Readonly<Record<string, string | number>>;

/** A message plus what fills it: what the application layer says. */
export interface MessageRef {
  key: MessageKey;
  params?: Params;
}

/**
 * The text of `key` in `locale`. `{name}` placeholders are filled from
 * `params`; a counted message picks `one` when `params.count` is exactly 1
 * (the rule for both Spanish and English) and `other` otherwise. A
 * placeholder without a value stays visible rather than printing undefined.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params: Params = {},
): string {
  const message = catalogs[locale][key];
  const template =
    typeof message === 'string'
      ? message
      : params.count === 1
      ? message.one
      : message.other;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
