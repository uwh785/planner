import { resolveApiBaseUrl } from '@/infrastructure/config/apiConfig';

it('uses the emulator host alias in development', () => {
  expect(resolveApiBaseUrl({ dev: true, releaseUrl: null })).toBe(
    'http://10.0.2.2:8080',
  );
});

it('refuses to guess a release URL', () => {
  expect(() => resolveApiBaseUrl({ dev: false, releaseUrl: null })).toThrow(
    /not configured/,
  );
  expect(() => resolveApiBaseUrl({ dev: false, releaseUrl: '  ' })).toThrow(
    /not configured/,
  );
});

it('requires HTTPS for release builds and trims a trailing slash', () => {
  expect(() =>
    resolveApiBaseUrl({ dev: false, releaseUrl: 'http://api.example.com' }),
  ).toThrow(/https/);
  expect(
    resolveApiBaseUrl({ dev: false, releaseUrl: 'https://api.example.com/' }),
  ).toBe('https://api.example.com');
});
