import { AuthenticatedHttp } from '@/application/auth/AuthenticatedHttp';
import {
  HttpError,
  SessionExpiredError,
  SignedOutError,
} from '@/application/auth/errors';
import { SessionEpoch } from '@/application/auth/SessionEpoch';
import { login, logout, restoreSession } from '@/application/auth/useCases';
import {
  active,
  FakeAuthGateway,
  FakeHttpClient,
  InMemorySessionStore,
} from '../../helpers/authFakes';

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

/** A request whose access token is stale, so it must refresh. */
function setup() {
  const epoch = new SessionEpoch();
  const store = new InMemorySessionStore(active('access-1', 'refresh-1'));
  const gateway = new FakeAuthGateway();
  const http = new FakeHttpClient(async (_m, _p, o) => {
    if (o.headers?.Authorization === 'Bearer access-2') {
      return { status: 200, json: null };
    }
    throw new HttpError(401, 'unauthorized');
  });
  const onSessionExpired = jest.fn();
  const authed = new AuthenticatedHttp({
    http,
    gateway,
    store,
    epoch,
    onSessionExpired,
  });
  let release!: () => void;
  const gate = new Promise<void>(resolve => (release = resolve));
  return { epoch, store, gateway, authed, onSessionExpired, gate, release };
}

it('does not sign the user back in when logout wins the race with a refresh', async () => {
  const { epoch, store, gateway, authed, gate, release } = setup();
  gateway.refresh.mockImplementation(async () => {
    await gate;
    return active('access-2', 'refresh-2');
  });
  const pending = authed.request('GET', '/api/x');
  const outcome = pending.then(
    () => null,
    (error: unknown) => error,
  );
  await settle();
  expect(gateway.refresh).toHaveBeenCalledTimes(1);

  await logout({ gateway, store, epoch });
  release();

  expect(await outcome).toBeInstanceOf(SignedOutError);
  expect(store.value).toBeNull();
  expect(store.log).not.toContain('save:refresh-2');
  expect(await restoreSession({ store })).toBeNull();
});

it('does not write an identity-only session after logout when the refresh is refused', async () => {
  const { epoch, store, gateway, authed, onSessionExpired, gate, release } =
    setup();
  gateway.refresh.mockImplementation(async () => {
    await gate;
    throw new SessionExpiredError();
  });
  const outcome = authed.request('GET', '/api/x').then(
    () => null,
    (error: unknown) => error,
  );
  await settle();

  await logout({ gateway, store, epoch });
  release();

  expect(await outcome).toBeInstanceOf(SignedOutError);
  expect(store.value).toBeNull();
  expect(onSessionExpired).not.toHaveBeenCalled();
  expect(await restoreSession({ store })).toBeNull();
});

it('discards a refresh that finishes after another user signed in', async () => {
  const { epoch, store, gateway, authed, gate, release } = setup();
  gateway.refresh.mockImplementation(async () => {
    await gate;
    return active('access-2', 'refresh-2');
  });
  gateway.login.mockResolvedValue({
    ...active('other-access', 'other-refresh'),
    userId: 'usr_2',
  });
  const outcome = authed.request('GET', '/api/x').then(
    () => null,
    (error: unknown) => error,
  );
  await settle();

  await login({ gateway, store, epoch }, { email: 'c@d.co', password: 'pw' });
  release();

  expect(await outcome).toBeInstanceOf(SignedOutError);
  expect(store.value).toMatchObject({
    userId: 'usr_2',
    refreshToken: 'other-refresh',
  });
});

it('still persists a refresh nobody raced', async () => {
  const { store, gateway, authed } = setup();
  await authed.request('GET', '/api/x');
  expect(store.value).toMatchObject({ refreshToken: 'refresh-2' });
  expect(gateway.refresh).toHaveBeenCalledTimes(1);
});
