import { AuthenticatedHttp } from '@/application/auth/AuthenticatedHttp';
import {
  HttpError,
  NetworkError,
  SessionExpiredError,
} from '@/application/auth/errors';
import {
  active,
  FakeAuthGateway,
  FakeHttpClient,
  InMemorySessionStore,
  user,
} from '../../helpers/authFakes';

const ok = { status: 200, json: { data: 1 } };

function setup(valid: string[] = ['access-2']) {
  const store = new InMemorySessionStore(active('access-1', 'refresh-1'));
  const gateway = new FakeAuthGateway();
  const http = new FakeHttpClient(async (_m, _p, o) => {
    const token = o.headers?.Authorization?.replace('Bearer ', '') ?? '';
    if (valid.includes(token)) return ok;
    throw new HttpError(401, 'unauthorized');
  });
  const onSessionExpired = jest.fn();
  const authed = new AuthenticatedHttp({
    http,
    gateway,
    store,
    onSessionExpired,
  });
  return { store, gateway, http, authed, onSessionExpired };
}

it('adds the bearer header', async () => {
  const { authed, http } = setup(['access-1']);
  expect(await authed.request('GET', '/api/x')).toEqual(ok);
  expect(http.calls).toEqual([
    { method: 'GET', path: '/api/x', auth: 'Bearer access-1' },
  ]);
});

it('refreshes once on 401, persists the rotated token, then retries once', async () => {
  const { authed, gateway, http, store } = setup();
  const order: string[] = [];
  gateway.refresh.mockImplementation(async () => {
    order.push('refresh');
    return active('access-2', 'refresh-2');
  });
  const origSave = store.save.bind(store);
  store.save = async s => {
    order.push('save');
    return origSave(s);
  };
  const origReq = http.request.bind(http);
  http.request = (m, p, o) => {
    order.push(`req:${o?.headers?.Authorization}`);
    return origReq(m, p, o);
  };
  await authed.request('GET', '/api/x');
  expect(order).toEqual([
    'req:Bearer access-1',
    'refresh',
    'save',
    'req:Bearer access-2',
  ]);
  expect(store.value).toMatchObject({
    accessToken: 'access-2',
    refreshToken: 'refresh-2',
  });
});

it('shares one refresh among concurrent 401s and retries each request once', async () => {
  const { authed, gateway, http } = setup();
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  gateway.refresh.mockImplementation(async () => {
    await gate;
    return active('access-2', 'refresh-2');
  });
  const all = Promise.all([
    authed.request('GET', '/a'),
    authed.request('GET', '/b'),
    authed.request('GET', '/c'),
  ]);
  await new Promise(r => setImmediate(r));
  release();
  await all;
  expect(gateway.refresh).toHaveBeenCalledTimes(1);
  expect(gateway.refresh).toHaveBeenCalledWith('refresh-1');
  const retries = http.calls.filter(c => c.auth === 'Bearer access-2');
  expect(retries.map(c => c.path).sort()).toEqual(['/a', '/b', '/c']);
});

it('does not refresh again for a late 401 of an already rotated token', async () => {
  // The request read access-1, but another request already rotated the pair.
  const store = new InMemorySessionStore(active('access-2', 'refresh-2'));
  const stale = [active('access-1', 'refresh-1')];
  const realGet = store.get.bind(store);
  store.get = async () => stale.shift() ?? realGet();
  const gateway = new FakeAuthGateway();
  const http = new FakeHttpClient(async (_m, _p, o) => {
    if (o.headers?.Authorization === 'Bearer access-1') {
      throw new HttpError(401, 'old');
    }
    return ok;
  });
  const authed = new AuthenticatedHttp({ http, gateway, store });
  await authed.request('GET', '/late');
  expect(gateway.refresh).not.toHaveBeenCalled();
  expect(http.calls.map(c => c.auth)).toEqual([
    'Bearer access-1',
    'Bearer access-2',
  ]);
});

it('clears the tokens but keeps the identity when the refresh is refused', async () => {
  const { authed, gateway, store, onSessionExpired } = setup();
  gateway.refresh.mockRejectedValue(new SessionExpiredError());
  await expect(authed.request('GET', '/a')).rejects.toBeInstanceOf(
    SessionExpiredError,
  );
  expect(store.value).toEqual({
    ...user,
    accessToken: null,
    refreshToken: null,
  });
  expect(onSessionExpired).toHaveBeenCalledTimes(1);
  // Later calls fail fast without touching the network.
  await expect(authed.request('GET', '/b')).rejects.toBeInstanceOf(
    SessionExpiredError,
  );
  expect(gateway.refresh).toHaveBeenCalledTimes(1);
});

it('keeps the session when the refresh fails on the network', async () => {
  const { authed, gateway, store, onSessionExpired } = setup();
  gateway.refresh.mockRejectedValue(new NetworkError('offline'));
  await expect(authed.request('GET', '/a')).rejects.toBeInstanceOf(
    NetworkError,
  );
  expect(store.value).toEqual(active('access-1', 'refresh-1'));
  expect(onSessionExpired).not.toHaveBeenCalled();
});

it('keeps the session on a server error during refresh', async () => {
  const { authed, gateway, store } = setup();
  gateway.refresh.mockRejectedValue(new HttpError(500, 'boom'));
  await expect(authed.request('GET', '/a')).rejects.toBeInstanceOf(HttpError);
  expect(store.value?.refreshToken).toBe('refresh-1');
});

it('passes non-401 failures through and retries only once', async () => {
  const { authed, gateway } = setup([]); // nothing is ever valid
  await expect(authed.request('GET', '/a')).rejects.toMatchObject({
    status: 401,
  });
  expect(gateway.refresh).toHaveBeenCalledTimes(1);
});

it('refuses to send without a session', async () => {
  const { authed, http, store } = setup();
  store.value = null;
  await expect(authed.request('GET', '/a')).rejects.toBeInstanceOf(
    SessionExpiredError,
  );
  expect(http.calls).toEqual([]);
});
