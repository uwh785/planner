import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  translate,
  type Locale,
  type MessageKey,
  type MessageRef,
  type Params,
} from '@/application/i18n';
import type { LocaleService } from '@/application/i18n';

/** Words a message in the current language. */
export type Translate = (key: MessageKey, params?: Params) => string;

/** What formatting needs: the language and its words. */
export interface I18n {
  locale: Locale;
  t: Translate;
}

export interface I18nApi extends I18n {
  setLocale(locale: Locale): void;
  /** Words a message the application layer produced (a notice). */
  say(message: MessageRef): string;
}

const I18nContext = createContext<LocaleService | null>(null);

/**
 * Holds the app's language. Renders nothing until the saved choice has been
 * read, so the first frame is already in the right language.
 */
export function I18nProvider({
  service,
  children,
}: {
  service: LocaleService;
  children: React.ReactNode;
}) {
  const { ready } = useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
  );
  return (
    <I18nContext.Provider value={service}>
      {ready ? children : null}
    </I18nContext.Provider>
  );
}

/** The language, `t`, and a setter that persists the choice. */
export function useI18n(): I18nApi {
  const service = useContext(I18nContext);
  if (service === null) {
    throw new Error('useI18n needs an I18nProvider');
  }
  const { locale } = useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
  );
  const t = useCallback<Translate>(
    (key, params) => translate(locale, key, params),
    [locale],
  );
  const setLocale = useCallback(
    (next: Locale) => {
      service.set(next);
    },
    [service],
  );
  return useMemo(
    () => ({
      locale,
      t,
      setLocale,
      say: message => translate(locale, message.key, message.params),
    }),
    [locale, t, setLocale],
  );
}

/** Shorthand for components that only need `t`. */
export const useT = (): Translate => useI18n().t;
