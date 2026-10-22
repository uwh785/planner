export interface HttpRequestOptions {
  /** JSON-serializable request body. */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface HttpResponse {
  status: number;
  /** Parsed JSON body, or null when the response had none (e.g. 204). */
  json: unknown;
}

/**
 * JSON over HTTP against the backend. Resolves for 2xx; throws `HttpError`
 * for any other status and `NetworkError` when the server is unreachable.
 */
export interface HttpClient {
  request(
    method: string,
    path: string,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse>;
}
