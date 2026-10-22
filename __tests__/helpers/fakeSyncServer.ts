import type {
  HttpRequestOptions,
  HttpResponse,
} from '@/application/ports/HttpClient';

export interface WireChange {
  entity: string;
  op: string;
  id: string;
  data: Record<string, unknown>;
  change_id: string;
}

export interface WireResult {
  status: string;
  http_status?: number;
  error?: string;
}

/**
 * Stand-in for the backend's push and pull endpoints. Applies each change
 * once per change_id (a replay answers `exists`), lets a test override the
 * outcome of single changes, and can fail whole requests.
 */
export class FakeSyncServer {
  /** One entry per POST /api/sync/push, in order. */
  readonly pushes: WireChange[][] = [];
  /** Paths of every GET, in order. */
  readonly pulls: string[] = [];
  /** Every request, in order: `POST /api/sync/push` or `GET /api/sync?...`. */
  readonly calls: string[] = [];
  /** change_ids the server applied, once each. */
  readonly applied: string[] = [];
  /** Per-change override; return undefined for the default outcome. */
  rule: (change: WireChange, index: number) => WireResult | undefined = () =>
    undefined;
  /** Throws on the next request(s) matching, then clears itself. */
  failNext: ((method: string) => Error | null) | null = null;
  pullBody: unknown = { cursor: 100 };
  /** Runs inside every request, before it answers (for gating). */
  beforeAnswer: (() => Promise<void>) | null = null;

  async request(
    method: string,
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse> {
    this.calls.push(`${method} ${path}`);
    await this.beforeAnswer?.();
    const failure = this.failNext?.(method) ?? null;
    if (failure !== null) {
      throw failure;
    }
    if (method === 'GET') {
      this.pulls.push(path);
      return { status: 200, json: { data: this.pullBody } };
    }
    const changes = (options.body as { changes: WireChange[] }).changes;
    this.pushes.push(changes);
    const results = changes.map((c, index) => {
      const override = this.rule(c, index);
      if (override !== undefined) {
        return {
          index,
          entity: c.entity,
          id: c.id,
          change_id: c.change_id,
          http_status: 400,
          ...override,
        };
      }
      const seen = this.applied.includes(c.change_id);
      if (!seen) {
        this.applied.push(c.change_id);
      }
      return {
        index,
        entity: c.entity,
        id: c.id,
        change_id: c.change_id,
        status: seen ? 'exists' : 'applied',
        http_status: 200,
      };
    });
    return { status: 200, json: { data: { results } } };
  }
}
