/** The Android emulator's alias for the host machine's loopback. */
export const DEV_API_BASE_URL = 'http://10.0.2.2:8080';

/**
 * Backend URL of release builds: the deployed HTTPS origin. It must stay
 * https (resolveApiBaseUrl rejects anything else) and a release build fails
 * at startup if it is ever emptied, so it can never silently talk to the
 * development URL.
 */
export const RELEASE_API_BASE_URL: string | null =
  'https://planner-opal-delta.vercel.app';

/** Picks the API origin: the emulator alias in development, else the release URL. */
export function resolveApiBaseUrl(options: {
  dev: boolean;
  releaseUrl: string | null;
}): string {
  if (options.dev) {
    return DEV_API_BASE_URL;
  }
  const url = options.releaseUrl?.trim() ?? '';
  if (url === '') {
    throw new Error(
      'API base URL is not configured for release builds: set RELEASE_API_BASE_URL in src/infrastructure/config/apiConfig.ts',
    );
  }
  if (!/^https:\/\//i.test(url)) {
    throw new Error('The release API base URL must use https');
  }
  return url.replace(/\/+$/, '');
}

/** The API origin of this build: the emulator alias in __DEV__, else release. */
export const currentApiBaseUrl = (): string =>
  resolveApiBaseUrl({ dev: __DEV__, releaseUrl: RELEASE_API_BASE_URL });
