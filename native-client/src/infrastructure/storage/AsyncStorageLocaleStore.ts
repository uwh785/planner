import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import type { LocaleStore } from '@/application/ports/LocaleStore';
import type { Locale } from '@/application/i18n';

const KEY = 'planner.locale';

/** The part of Async Storage this adapter uses. */
interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Saves the language in Async Storage (unencrypted: it is not a secret). */
export class AsyncStorageLocaleStore implements LocaleStore {
  constructor(
    private readonly storage: KeyValueStorage = createAsyncStorage('planner'),
  ) {}

  load(): Promise<string | null> {
    return this.storage.getItem(KEY);
  }

  save(locale: Locale): Promise<void> {
    return this.storage.setItem(KEY, locale);
  }
}
