import { HttpError, NetworkError } from '@/application/auth/errors';
import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
} from '@/application/ports/HttpClient';

/**
 * Default per-request limit. Long enough for a slow mobile connection to
 * finish a small JSON exchange, short enough that a dead link fails the
 * request (and releases the UI) instead of hanging.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

interface Options {
  baseUrl: string;
  /** Per-request limit covering connect, headers and body. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function errorMessage(json: unknown, status: number): string {
  if (typeof json === 'object' && json !== null && 'error' in json) {
    const message = (json as { error: unknown }).error;
    if (typeof message === 'string' && message !== '') {
      return message;
    }
  }
  return `HTTP ${status}`;
}

function parse(text: string): unknown {
  if (text === '') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** HttpClient over the global fetch: JSON in and out, with a timeout. */
export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: Options) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  async request(
    method: string,
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const caller = options.signal;
    const forwardAbort = () => controller.abort();
    if (caller?.aborted) {
      controller.abort();
    }
    caller?.addEventListener('abort', forwardAbort);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let status: number;
    let text: string;
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
      status = response.status;
      text = await response.text();
    } catch (error) {
      throw new NetworkError(
        timedOut
          ? 'Request timed out'
          : error instanceof Error
          ? error.message
          : 'Network request failed',
      );
    } finally {
      clearTimeout(timer);
      caller?.removeEventListener('abort', forwardAbort);
    }

    const json = parse(text);
    if (status < 200 || status >= 300) {
      throw new HttpError(status, errorMessage(json, status));
    }
    return { status, json };
  }
}
