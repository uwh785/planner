import type { OutboxEntry, ParkedStatus } from '../ports/OutboxRepository';

/** The backend's per-request limit (maxPushChanges in sync_push.go). */
export const MAX_PUSH_CHANGES = 200;

/** A parent-less upsert is retried this many times, then parked as blocked. */
export const MAX_MISSING_PARENT_ATTEMPTS = 5;

const MAX_MESSAGE_LENGTH = 200;

/** One element of the push body's `changes`. */
export interface PushChange {
  entity: string;
  op: string;
  id: string;
  data: Record<string, unknown>;
  change_id: string;
}

/**
 * What to do with one entry once the server answered. `sent` leaves the
 * queue; `retry` keeps it pending (and parks it as blocked once it has been
 * tried `parkAfter` times); `park` stops pushing it.
 */
export type EntryOutcome =
  | { kind: 'sent' }
  | { kind: 'retry'; error: string; parkAfter?: number }
  | { kind: 'park'; status: ParkedStatus; error: string };

/**
 * The entry as the server wants it. A task/tag link's entity id is the pair
 * `<task_id>:<tag_id>`; the server ignores the id for links and reads
 * `{task_id, tag_id}` from the data, which the payload already holds.
 * A task `complete` is the backend's timer op: `{entity: 'task', op:
 * 'complete', id, data: {at}, change_id}`; its payload is exactly `{at}`.
 */
export const toPushChange = (entry: OutboxEntry): PushChange => ({
  entity: entry.entity,
  op: entry.op,
  id: entry.entityId,
  data: entry.payload,
  change_id: entry.changeId,
});

type Wire = Record<string, unknown>;

const isObject = (v: unknown): v is Wire =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const message = (raw: unknown, fallback: string): string =>
  typeof raw === 'string' && raw.trim() !== ''
    ? raw.trim().slice(0, MAX_MESSAGE_LENGTH)
    : fallback;

/** The per-index results of a push response (`{data: {results: [...]}}`). */
function resultsByIndex(body: unknown): Map<number, Wire> {
  const data = isObject(body) ? body.data : undefined;
  const list = isObject(data) ? data.results : undefined;
  const byIndex = new Map<number, Wire>();
  if (Array.isArray(list)) {
    for (const item of list) {
      if (isObject(item) && Number.isInteger(item.index)) {
        byIndex.set(item.index as number, item);
      }
    }
  }
  return byIndex;
}

function outcomeOf(entry: OutboxEntry, result: Wire | undefined): EntryOutcome {
  if (
    result === undefined ||
    (result.change_id !== undefined && result.change_id !== entry.changeId)
  ) {
    return {
      kind: 'retry',
      error: 'The server sent no result for this change',
    };
  }
  switch (result.status) {
    case 'applied':
    case 'exists':
      return { kind: 'sent' };
    case 'not_found':
      // A delete of something already gone is done. An upsert is missing a
      // parent (list, tag, task) that may still arrive, and a `complete`
      // waits for its task (its create may be parked or still behind it):
      // retry a few times, then park as blocked so it stays visible.
      return entry.op === 'delete'
        ? { kind: 'sent' }
        : {
            kind: 'retry',
            error: message(
              result.error,
              'A parent item is missing on the server',
            ),
            parkAfter: MAX_MISSING_PARENT_ATTEMPTS,
          };
    case 'limit':
      return {
        kind: 'park',
        status: 'blocked',
        error: message(result.error, 'A plan limit was reached'),
      };
    case 'conflict':
      // For a `complete`, the server answers conflict when the task cannot
      // leave its current status: it is already completed (the only way a
      // task we completed locally can be refused). The outcome the user asked
      // for already holds, so the entry is cleared instead of parked forever.
      // For an upsert it still means the id belongs to someone else.
      if (entry.op === 'complete') {
        return { kind: 'sent' };
      }
      return {
        kind: 'park',
        status: 'rejected',
        error: message(result.error, 'The server refused this change'),
      };
    case 'invalid':
      return {
        kind: 'park',
        status: 'rejected',
        error: message(result.error, 'The server refused this change'),
      };
    default:
      return {
        kind: 'retry',
        error: message(result.error, 'The server could not apply this change'),
      };
  }
}

/** One outcome per entry of the batch, matched to its result by `index`. */
export function classifyResults(
  batch: readonly OutboxEntry[],
  body: unknown,
): EntryOutcome[] {
  const results = resultsByIndex(body);
  return batch.map((entry, index) => outcomeOf(entry, results.get(index)));
}
