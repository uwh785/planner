import * as Keychain from 'react-native-keychain';
import { SessionStoreUnreadableError } from '@/application/auth/errors';
import type { SessionStore } from '@/application/ports/SessionStore';
import type { AuthSession } from '@/domain/auth';

const ENTRY_NAME = 'session';

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isSession(value: unknown): value is AuthSession {
  const v = value as Record<string, unknown> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.userId === 'string' &&
    typeof v.email === 'string' &&
    typeof v.name === 'string' &&
    nullableString(v.accessToken) &&
    nullableString(v.refreshToken)
  );
}

/**
 * Persists the session as one JSON entry in the Android Keystore-backed
 * keychain.
 *
 * Three outcomes of get(): a session; null when nothing usable is stored
 * (absent, or an entry that is corrupt or does not match the schema, which is
 * logged by reason code only and left in place); and
 * `SessionStoreUnreadableError` when the Keystore itself fails, so a failure
 * is never mistaken for "signed out".
 */
export class KeychainSessionStore implements SessionStore {
  constructor(private readonly service = 'planner.session') {}

  async get(): Promise<AuthSession | null> {
    let entry: false | { password: string };
    try {
      entry = await Keychain.getGenericPassword({ service: this.service });
    } catch {
      // The native error text may name the key store; keep it out of logs.
      throw new SessionStoreUnreadableError();
    }
    if (!entry) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(entry.password);
    } catch {
      console.warn('saved session ignored: session_not_json');
      return null;
    }
    if (!isSession(parsed)) {
      console.warn('saved session ignored: session_schema_mismatch');
      return null;
    }
    return parsed;
  }

  async save(session: AuthSession): Promise<void> {
    await Keychain.setGenericPassword(ENTRY_NAME, JSON.stringify(session), {
      service: this.service,
    });
  }

  async clear(): Promise<void> {
    await Keychain.resetGenericPassword({ service: this.service });
  }
}
