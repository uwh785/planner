import { HttpError, NetworkError } from '@/application/auth/errors';
import { FetchHttpClient } from '@/infrastructure/http/FetchHttpClient';

function response(status: number, body?: unknown): Response {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => text,
  } as Response;
}

function client(fetchImpl: jest.Mock, timeoutMs = 1000) {
  return new FetchHttpClient({
    baseUrl: 'http://host:8080/',
    timeoutMs,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

it('sends JSON and returns the parsed body', async () => {
  const f = jest.fn().mockResolvedValue(response(201, { data: { id: 1 } }));
  const res = await client(f).request('POST', '/api/x', {
    body: { a: 1 },
    headers: { Authorization: 'Bearer t' },
  });
  expect(res).toEqual({ status: 201, json: { data: { id: 1 } } });
  const [url, init] = f.mock.calls[0];
  expect(url).toBe('http://host:8080/api/x');
  expect(init.method).toBe('POST');
  expect(init.body).toBe('{"a":1}');
  expect(init.headers).toMatchObject({
    'Content-Type': 'application/json',
    Authorization: 'Bearer t',
  });
});

it('handles 204 without a body', async () => {
  const f = jest.fn().mockResolvedValue(response(204));
  expect(await client(f).request('POST', '/api/auth/logout')).toEqual({
    status: 204,
    json: null,
  });
});

it('maps non-2xx to HttpError using the error body', async () => {
  const f = jest
    .fn()
    .mockResolvedValue(response(401, { error: 'invalid credentials' }));
  await expect(client(f).request('POST', '/api/auth/login')).rejects.toEqual(
    expect.objectContaining({
      name: 'HttpError',
      status: 401,
      message: 'invalid credentials',
    }),
  );
});

it('falls back to a generic message when the error body is unusable', async () => {
  const f = jest.fn().mockResolvedValue({
    status: 502,
    ok: false,
    text: async () => '<html>bad gateway</html>',
  });
  const error = await client(f)
    .request('GET', '/x')
    .catch(e => e);
  expect(error).toBeInstanceOf(HttpError);
  expect(error.status).toBe(502);
  expect(error.message).toBe('HTTP 502');
});

it('maps a failed fetch to NetworkError', async () => {
  const f = jest
    .fn()
    .mockRejectedValue(new TypeError('Network request failed'));
  await expect(client(f).request('GET', '/x')).rejects.toBeInstanceOf(
    NetworkError,
  );
});

it('aborts a request that exceeds the timeout', async () => {
  jest.useFakeTimers();
  try {
    const f = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        ),
    );
    const outcome = client(f as never, 500)
      .request('GET', '/slow')
      .catch(e => e);
    await jest.advanceTimersByTimeAsync(500);
    const error = await outcome;
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toMatch(/timed out/);
  } finally {
    jest.useRealTimers();
  }
});

it('honors a caller abort signal', async () => {
  const controller = new AbortController();
  const f = jest.fn(
    (_url: string, init: RequestInit) =>
      new Promise((_, reject) =>
        init.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        ),
      ),
  );
  const pending = client(f as never).request('GET', '/x', {
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toBeInstanceOf(NetworkError);
});
