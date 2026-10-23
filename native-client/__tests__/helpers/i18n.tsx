import React from 'react';
import {
  InMemoryLocaleStore,
  LocaleService,
  translate,
  type Locale,
  type MessageKey,
  type Params,
} from '@/application/i18n';
import { I18nProvider, type I18n } from '@/presentation/i18n/I18nProvider';

/** The words of a language, for expectations and pure formatters. */
export const words = (locale: Locale): I18n => ({
  locale,
  t: (key: MessageKey, params?: Params) => translate(locale, key, params),
});

/** A wrapper that provides the language to a component under test. */
export function withLocale(locale: Locale = 'en') {
  const service = new LocaleService(new InMemoryLocaleStore(locale));
  // Resolves in a microtask; the provider renders once it has.
  const ready = service.restore();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <I18nProvider service={service}>{children}</I18nProvider>;
  }
  return { Wrapper, service, ready };
}
