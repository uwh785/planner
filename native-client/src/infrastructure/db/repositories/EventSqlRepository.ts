import type {
  EventPatch,
  EventRepository,
  NewEvent,
} from '@/application/ports/repositories';
import { normalizeEvent, type Event } from '@/domain';
import { eventFromRow, eventToRow } from '../mappers';
import type { EventRow } from '../rows';
import type { RepoDeps } from './deps';
import { EntityStore } from './EntityStore';
import { eventPayload } from './payloads';
import { merge } from './sqlHelpers';

export class EventSqlRepository implements EventRepository {
  private readonly store: EntityStore<Event, EventRow>;

  constructor(private readonly deps: RepoDeps) {
    this.store = new EntityStore(
      deps.db,
      {
        entity: 'event',
        table: 'events',
        idColumn: 'event_id',
        idOf: e => e.id,
        toRow: eventToRow,
        fromRow: eventFromRow,
        normalize: normalizeEvent,
        payload: eventPayload,
        deletePayload: () => ({}),
      },
      deps.outbox,
      deps.clock,
    );
  }

  create(input: NewEvent) {
    return this.store.create(now => ({
      id: this.deps.ids.newId('evt'),
      title: input.title,
      description: input.description ?? '',
      location: input.location ?? '',
      startAt: input.startAt,
      endAt: input.endAt ?? null,
      allDay: input.allDay ?? false,
      color: input.color ?? '',
      updatedAt: now,
      deleted: false,
    }));
  }

  update(id: string, patch: EventPatch) {
    return this.store.update(id, current => merge(current, patch));
  }

  delete(id: string) {
    return this.store.delete(id);
  }

  get(id: string) {
    return this.store.get(id);
  }

  list() {
    return this.store.select('', [], 'start_at, event_id');
  }
}
