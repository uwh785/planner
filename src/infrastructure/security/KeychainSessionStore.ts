import * as Keychain from 'react-native-keychain';
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
 * keychain. A missing or unreadable entry means signed out.
 */
export class KeychainSessionStore implements SessionStore {
  constructor(private readonly service = 'planner.session') {}

  async get(): Promise<AuthSession | null> {
    const entry = await Keychain.getGenericPassword({ service: this.service });
    if (!entry) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(entry.password);
      return isSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
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
