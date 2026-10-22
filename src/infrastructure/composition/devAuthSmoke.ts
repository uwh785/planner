import {
  NotSignedInError,
  SessionExpiredError,
} from '@/application/auth/errors';
import { createAppServices } from './createAppServices';
import { createContainer } from './createContainer';
import { KeychainSessionStore } from '../security/KeychainSessionStore';

const SMOKE_SERVICE = 'planner.devsmoke';
/** Throwaway database: never a real user's planner_<userId>.db. */
const SMOKE_DB_USER = 'authsmoke';
const PROBE_USER_ID = 'relaunch-probe';

function assert(condition: boolean, what: string): void {
  if (!condition) {
    throw new Error(`auth smoke failed: ${what}`);
  }
}

const log = (message: string) => console.log(`auth smoke: ${message}`);

async function rejectsWith(
  action: () => Promise<unknown>,
  type: new (...args: never[]) => Error,
): Promise<boolean> {
  try {
    await action();
    return false;
  } catch (error) {
    return error instanceof type;
  }
}

/**
 * Development-only run of the whole session flow against the real backend:
 * register, authenticated call, forced refresh, logout. It uses its own
 * Keychain entry and its own database file, and logs step names and status
 * codes only, never tokens or passwords. It ends by leaving a harmless
 * identity-only "relaunch probe" in its Keychain entry; the next run reports
 * finding it, which shows the stored session survives a process restart.
 */
export async function runAuthSmoke(apiBaseUrl?: string): Promise<void> {
  const store = new KeychainSessionStore(SMOKE_SERVICE);
  const openSmokeDb = () => createContainer({ userId: SMOKE_DB_USER });
  const services = createAppServices({
    apiBaseUrl,
    sessionStore: store,
    openContainer: openSmokeDb,
  });
  await services.ready;

  const previous = services.session.current();
  log(`restore at start: ${previous ? `found ${previous.userId}` : 'none'}`);
  if (previous) {
    await services.session.logout();
  }

  const email = `m3-smoke-${Date.now()}@example.com`;
  const session = await services.session.register({
    email,
    password: 'smoke-password-1',
    name: 'Auth Smoke',
  });
  assert(Boolean(session.refreshToken), 'register returned a refresh token');
  log('register ok');

  const container = await services.containers.acquire();
  const list = await container.taskLists.create({ name: 'Auth smoke list' });
  services.containers.release();
  log('user database ok');

  const me = await services.http.request('GET', '/api/auth/me');
  log(`authenticated call status=${me.status}`);

  // Make the access token invalid; the 401 must trigger one refresh + retry.
  const before = await store.get();
  assert(before !== null, 'session stored');
  await store.save({ ...before!, accessToken: 'expired.invalid.token' });
  const retried = await services.http.request('GET', '/api/auth/me');
  const after = await store.get();
  assert(
    after?.refreshToken !== null &&
      after?.refreshToken !== before!.refreshToken,
    'refresh token rotated and persisted',
  );
  assert(after?.accessToken !== 'expired.invalid.token', 'access replaced');
  log(`forced refresh ok status=${retried.status}`);

  const reread = await new KeychainSessionStore(SMOKE_SERVICE).get();
  assert(reread?.userId === session.userId, 'session readable from keychain');
  log('session persisted in keychain');

  await services.session.logout();
  assert((await store.get()) === null, 'keychain cleared on logout');
  assert(
    await rejectsWith(() => services.containers.acquire(), NotSignedInError),
    'database closed after logout',
  );
  assert(
    await rejectsWith(
      () => services.http.request('GET', '/api/auth/me'),
      SessionExpiredError,
    ),
    'no requests after logout',
  );
  const reopened = await openSmokeDb();
  try {
    assert(
      (await reopened.taskLists.get(list.id)) !== null,
      'local data kept after logout',
    );
    await reopened.taskLists.delete(list.id);
  } finally {
    await reopened.close();
  }
  log('logout ok (local data kept)');

  await store.save({
    userId: PROBE_USER_ID,
    email: 'probe@example.invalid',
    name: 'probe',
    accessToken: null,
    refreshToken: null,
  });
  log('auth smoke ok');
}
