import {
  HttpError,
  NetworkError,
  NotSignedInError,
  SessionExpiredError,
  SignedOutError,
} from '../auth/errors';
import type { Clock } from '../ports/Clock';
import type { HttpClient } from '../ports/HttpClient';
import type { OutboxEntry, OutboxRepository } from '../ports/OutboxRepository';
import type { ApplyRemoteChanges } from '../ports/RemoteChanges';
import type { SyncStateRepository } from '../ports/SyncStateRepository';
import { backoffDelayMs } from './backoff';
import { classifyResults, MAX_PUSH_CHANGES, toPushChange } from './pushBatch';
import { SyncStatus, type SyncSnapshot } from './SyncStatus';

export interface SyncEngineDeps {
  outbox: OutboxRepository;
  syncState: SyncStateRepository;
  remoteChanges: ApplyRemoteChanges;
  /** Adds the bearer token and refreshes it on 401 (AuthenticatedHttp). */
  http: Pick<HttpClient, 'request'>;
  clock: Clock;
  /** Returns a number in [0, 1); injected so backoff is testable. */
  random: () => number;
  /** Reason codes and counts only: never tokens, payloads or titles. */
  log?: (message: string) => void;
}

/** A run that pushed fine but left entries to retry. */
class RetryLater extends Error {}

const isSessionError = (error: unknown): boolean =>
  error instanceof SessionExpiredError ||
  error instanceof SignedOutError ||
  error instanceof NotSignedInError;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Pushes the outbox, then pulls the server's changes.
 *
 * - Single flight: while a run is in flight, `sync()` returns that run's
 *   promise and asks for at most one follow-up run after it (only when the
 *   run succeeded; a failed run backs off instead).
 * - Push: pending entries in id order, at most 200 per request. Entries are
 *   removed only after the response, so a crash in between re-sends the same
 *   change ids and the server answers `exists`.
 * - Failures never throw out of `sync()`. They set the status and
 *   `nextRetryAt` (exponential backoff with jitter); the scheduler owns the
 *   timers. A lost session pauses without backoff.
 */
export class SyncEngine {
  readonly status = new SyncStatus();
  private inflight: Promise<void> | null = null;
  private again = false;
  private failures = 0;
  private retryAt: number | null = null;

  constructor(private readonly deps: SyncEngineDeps) {}

  /** When the scheduler should try again after a failure, or null. */
  get nextRetryAt(): number | null {
    return this.retryAt;
  }

  /** Reloads the counts and the last sync time (e.g. after a local change). */
  async refresh(): Promise<void> {
    this.status.update(await this.localFacts());
  }

  /** The OS's view of the network, shown while no run is in flight. */
  noteConnectivity(online: boolean): void {
    const { phase } = this.status.getSnapshot();
    if (!online && (phase === 'idle' || phase === 'error')) {
      this.status.update({ phase: 'offline' });
    } else if (online && phase === 'offline') {
      this.status.update({ phase: 'idle' });
    }
  }

  sync(): Promise<void> {
    if (this.inflight !== null) {
      this.again = true;
      return this.inflight;
    }
    const run = this.loop();
    this.inflight = run;
    return run;
  }

  private async loop(): Promise<void> {
    let ok: boolean;
    do {
      this.again = false;
      ok = await this.runOnce();
    } while (this.again && ok);
    // Cleared in the same tick as the check, so no call can fall in between.
    this.inflight = null;
  }

  private async runOnce(): Promise<boolean> {
    this.status.update({ phase: 'syncing' });
    try {
      const retryError = await this.push();
      await this.pull();
      if (retryError !== null) {
        throw new RetryLater(retryError);
      }
    } catch (error) {
      await this.fail(error);
      return false;
    }
    await this.succeed();
    return true;
  }

  /** Returns the first retryable item error, or null when none is left. */
  private async push(): Promise<string | null> {
    const { outbox, http, log } = this.deps;
    const tried = new Set<number>();
    let retryError: string | null = null;
    let size = MAX_PUSH_CHANGES;
    for (;;) {
      const fetched = await outbox.peekPending(size + tried.size);
      const batch = fetched.filter(e => !tried.has(e.id)).slice(0, size);
      if (batch.length === 0) {
        return retryError;
      }
      let body: unknown;
      try {
        body = (
          await http.request('POST', '/api/sync/push', {
            body: { changes: batch.map(toPushChange) },
          })
        ).json;
      } catch (error) {
        if (error instanceof HttpError && error.status === 413 && size > 1) {
          size = Math.max(1, Math.floor(batch.length / 2));
          log?.(`push: batch too large, retrying with ${size}`);
          continue;
        }
        if (error instanceof HttpError && [400, 413].includes(error.status)) {
          // The server refused the whole batch; park it so it cannot wedge the queue.
          log?.(
            `push: batch refused (HTTP ${error.status}), ${batch.length} parked`,
          );
          await this.parkBatch(batch, error.status);
          continue;
        }
        throw error;
      }
      const itemError = await this.applyOutcomes(batch, body, tried);
      retryError = retryError ?? itemError;
    }
  }

  private async parkBatch(
    batch: readonly OutboxEntry[],
    status: number,
  ): Promise<void> {
    const reason =
      status === 413
        ? 'This change is too large for the server'
        : 'The server refused this batch (HTTP 400)';
    for (const entry of batch) {
      await this.deps.outbox.park(entry.id, 'rejected', reason);
    }
  }

  private async applyOutcomes(
    batch: readonly OutboxEntry[],
    body: unknown,
    tried: Set<number>,
  ): Promise<string | null> {
    const { outbox, log } = this.deps;
    const outcomes = classifyResults(batch, body);
    const sent: number[] = [];
    let retryError: string | null = null;
    let parked = 0;
    for (const [i, entry] of batch.entries()) {
      const outcome = outcomes[i]!;
      if (outcome.kind === 'sent') {
        sent.push(entry.id);
      }
    }
    // After the response, never before: a crash here means a harmless replay.
    await outbox.markSent(sent);
    for (const [i, entry] of batch.entries()) {
      const outcome = outcomes[i]!;
      if (outcome.kind === 'park') {
        await outbox.park(entry.id, outcome.status, outcome.error);
        parked += 1;
      } else if (outcome.kind === 'retry') {
        if (
          outcome.parkAfter !== undefined &&
          entry.attempts + 1 >= outcome.parkAfter
        ) {
          await outbox.recordAttempt(entry.id, outcome.error);
          await outbox.park(entry.id, 'blocked', outcome.error);
          parked += 1;
        } else {
          await outbox.recordAttempt(entry.id, outcome.error);
          tried.add(entry.id);
          retryError = retryError ?? outcome.error;
        }
      }
    }
    log?.(
      `push: sent=${sent.length} parked=${parked} retry=${
        batch.length - sent.length - parked
      }`,
    );
    return retryError;
  }

  private async pull(): Promise<void> {
    const { http, syncState, remoteChanges, log } = this.deps;
    const cursor = await syncState.getCursor();
    const response = await http.request('GET', `/api/sync?since=${cursor}`);
    const data = isObject(response.json) ? response.json.data : undefined;
    if (!isObject(data)) {
      throw new Error('Unexpected response from the sync endpoint');
    }
    const result = await remoteChanges.applyRemoteChanges(data);
    log?.(
      `pull: applied=${result.applied} skipped=${result.skippedPending} invalid=${result.invalid}`,
    );
  }

  private async succeed(): Promise<void> {
    const { syncState, clock } = this.deps;
    this.failures = 0;
    this.retryAt = null;
    const at = clock.now();
    try {
      await syncState.setLastSyncAt(at);
    } catch {
      // The in-memory time still shows; the next clean run stores it.
    }
    this.status.update({
      ...(await this.localFacts()),
      phase: 'idle',
      lastSyncAt: at,
      lastError: null,
      nextRetryAt: null,
    });
  }

  private async fail(error: unknown): Promise<void> {
    const { clock, random, log } = this.deps;
    const text = error instanceof Error ? error.message : 'Sync failed';
    let phase: SyncSnapshot['phase'] = 'error';
    let reason = 'local';
    if (isSessionError(error)) {
      this.retryAt = null;
      log?.('sync paused: session gone');
      this.status.update({
        ...(await this.localFacts()),
        phase: 'paused',
        lastError: text,
        nextRetryAt: null,
      });
      return;
    }
    if (error instanceof NetworkError) {
      phase = 'offline';
      reason = 'network';
    } else if (error instanceof HttpError) {
      reason = `http_${error.status}`;
    } else if (error instanceof RetryLater) {
      reason = 'retryable_items';
    }
    this.failures += 1;
    const delay = backoffDelayMs(this.failures, random);
    this.retryAt = clock.now() + delay;
    log?.(
      `sync failed (${reason}), attempt ${this.failures}, retry in ${delay}ms`,
    );
    this.status.update({
      ...(await this.localFacts()),
      phase,
      lastError: text,
      nextRetryAt: this.retryAt,
    });
  }

  /** Counts and last sync time; empty when the database cannot be read. */
  private async localFacts(): Promise<Partial<SyncSnapshot>> {
    try {
      const counts = await this.deps.outbox.countByStatus();
      const lastSyncAt = await this.deps.syncState.getLastSyncAt();
      return {
        pendingCount: counts.pending,
        blockedCount: counts.blocked,
        rejectedCount: counts.rejected,
        lastSyncAt: lastSyncAt ?? this.status.getSnapshot().lastSyncAt,
      };
    } catch {
      return {};
    }
  }
}
