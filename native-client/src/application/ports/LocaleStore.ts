import type { Locale } from '../i18n/locale';

/**
 * Where the chosen language lives on the device. Device-level, not per user:
 * the sign-in screen has no user database yet, and the choice outlives
 * sign-out.
 */
export interface LocaleStore {
  /** The saved value as stored (validated by the caller), or null. */
  load(): Promise<string | null>;
  save(locale: Locale): Promise<void>;
}
