import type { LocaleStore } from '../ports/LocaleStore';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locale';

export interface LocaleSnapshot {
  locale: Locale;
  /** False until the saved choice has been read, so the UI never flashes the wrong language. */
  ready: boolean;
}

/** In-memory store: the fake for tests, and the default when none is wired. */
export class InMemoryLocaleStore implements LocaleStore {
  constructor(public value: string | null = null) {}

  async load(): Promise<string | null> {
    return this.value;
  }

  async save(locale: Locale): Promise<void> {
    this.value = locale;
  }
}

/**
 * The language of the app: Spanish until a saved choice says otherwise.
 * Changing it takes effect at once and is saved behind the scenes; a store
 * that fails never blocks the switch or the startup.
 */
export class LocaleService {
  private snapshot: LocaleSnapshot = { locale: DEFAULT_LOCALE, ready: false };
  private readonly listeners = new Set<() => void>();

  constructor(private readonly store: LocaleStore) {}

  getSnapshot = (): LocaleSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Reads the saved language. Never rejects. */
  async restore(): Promise<void> {
    let locale: Locale = DEFAULT_LOCALE;
    try {
      const saved = await this.store.load();
      if (isLocale(saved)) {
        locale = saved;
      }
    } catch {
      // Unreadable storage: start in the default language.
    }
    this.publish({ locale, ready: true });
  }

  /** Switches now, then saves. Never rejects. */
  async set(locale: Locale): Promise<void> {
    if (locale === this.snapshot.locale) {
      return;
    }
    this.publish({ locale, ready: this.snapshot.ready });
    try {
      await this.store.save(locale);
    } catch {
      // Kept for this session; the next start falls back to what was saved.
    }
  }

  private publish(next: LocaleSnapshot): void {
    if (
      next.locale === this.snapshot.locale &&
      next.ready === this.snapshot.ready
    ) {
      return;
    }
    this.snapshot = next;
    [...this.listeners].forEach(listener => listener());
  }
}
