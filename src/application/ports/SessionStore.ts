import type { AuthSession } from '@/domain/auth';

/** Secure storage for the single persisted session of this device. */
export interface SessionStore {
  get(): Promise<AuthSession | null>;
  save(session: AuthSession): Promise<void>;
  clear(): Promise<void>;
}
