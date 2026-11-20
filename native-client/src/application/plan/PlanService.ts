import type { PlanSummary } from '@/domain';
import { parsePlan } from '@/domain';
import type { HttpClient } from '../ports/HttpClient';

export interface PlanSnapshot {
  /** Whose plan this is, so a later user never sees it. */
  userId: string | null;
  summary: PlanSummary | null;
}

/** What the UI reads; the same shape works for useSyncExternalStore. */
export interface PlanSource {
  getSnapshot(): PlanSnapshot;
  subscribe(listener: () => void): () => void;
  /** Re-reads the plan of `userId`; never rejects (offline keeps the last). */
  refresh(userId: string): Promise<void>;
  /** The web page that explains the paid plan. */
  readonly upgradeUrl: string;
}

const EMPTY: PlanSnapshot = { userId: null, summary: null };

/**
 * The plan and its usage, read from the server whenever Settings opens. It is
 * a display only: creating things never waits for it (the local data is the
 * truth and the server's limit answer parks the change, see pushBatch).
 */
export class PlanService implements PlanSource {
  private snapshot: PlanSnapshot = EMPTY;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly http: Pick<HttpClient, 'request'>,
    readonly upgradeUrl: string,
  ) {}

  getSnapshot = (): PlanSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async refresh(userId: string): Promise<void> {
    try {
      const response = await this.http.request('GET', '/api/subscription');
      const summary = parsePlan(response.json);
      if (summary !== null) {
        this.snapshot = { userId, summary };
        this.listeners.forEach(listener => listener());
      }
    } catch {
      // Offline, an older backend or an expired session: keep what we have.
    }
  }
}
