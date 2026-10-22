import {
  HttpError,
  InvalidCredentialsError,
  SessionExpiredError,
} from '@/application/auth/errors';
import { HttpAuthGateway } from '@/infrastructure/http/HttpAuthGateway';
import { FakeHttpClient } from '../../helpers/authFakes';

const body = {
  data: {
    token: 'jwt',
    refresh_token: 'rt',
    user: { user_id: 'usr_9', email: 'a@b.co', name: 'Ann', role: 'user' },
  },
};

it('registers and maps the response to a session', async () => {
  const http = new FakeHttpClient(async () => ({ status: 201, json: body }));
  const spy = jest.spyOn(http, 'request');
  const session = await new HttpAuthGateway(http).register({
    email: 'a@b.co',
    password: 'pw',
    name: 'Ann',
  });
  expect(spy).toHaveBeenCalledWith('POST', '/api/auth/register', {
    body: { email: 'a@b.co', name: 'Ann', password: 'pw' },
  });
  expect(session).toEqual({
    userId: 'usr_9',
    email: 'a@b.co',
    name: 'Ann',
    accessToken: 'jwt',
    refreshToken: 'rt',
  });
});

it('maps a login 401 to InvalidCredentialsError', async () => {
  const http = new FakeHttpClient(async () => {
    throw new HttpError(401, 'invalid credentials');
  });
  await expect(
    new HttpAuthGateway(http).login({ email: 'a', password: 'b' }),
  ).rejects.toBeInstanceOf(InvalidCredentialsError);
});

it('lets other login failures through unchanged', async () => {
  const http = new FakeHttpClient(async () => {
    throw new HttpError(500, 'boom');
  });
  await expect(
    new HttpAuthGateway(http).login({ email: 'a', password: 'b' }),
  ).rejects.toMatchObject({ status: 500 });
});

it('maps a refresh 401 to SessionExpiredError', async () => {
  const http = new FakeHttpClient(async () => {
    throw new HttpError(401, 'invalid refresh token');
  });
  await expect(new HttpAuthGateway(http).refresh('rt')).rejects.toBeInstanceOf(
    SessionExpiredError,
  );
});

it('posts the refresh token and returns the rotated pair', async () => {
  const http = new FakeHttpClient(async () => ({ status: 200, json: body }));
  const spy = jest.spyOn(http, 'request');
  const session = await new HttpAuthGateway(http).refresh('old');
  expect(spy).toHaveBeenCalledWith('POST', '/api/auth/refresh', {
    body: { refresh_token: 'old' },
  });
  expect(session.refreshToken).toBe('rt');
});

it('rejects a malformed success body', async () => {
  const http = new FakeHttpClient(async () => ({
    status: 200,
    json: { data: { token: 1 } },
  }));
  await expect(
    new HttpAuthGateway(http).login({ email: 'a', password: 'b' }),
  ).rejects.toBeInstanceOf(HttpError);
});

it('logs out with the refresh token and the abort signal', async () => {
  const http = new FakeHttpClient(async () => ({ status: 204, json: null }));
  const spy = jest.spyOn(http, 'request');
  const controller = new AbortController();
  await new HttpAuthGateway(http).logout('rt', controller.signal);
  expect(spy).toHaveBeenCalledWith('POST', '/api/auth/logout', {
    body: { refresh_token: 'rt' },
    signal: controller.signal,
  });
});

it('rejects a malformed 2xx refresh body as a server fault, not an expired session', async () => {
  const http = new FakeHttpClient(async () => ({
    status: 200,
    json: { data: { token: 'jwt' } },
  }));
  const failure = await new HttpAuthGateway(http).refresh('rt').catch(e => e);
  expect(failure).toBeInstanceOf(HttpError);
  expect(failure).not.toBeInstanceOf(SessionExpiredError);
});
