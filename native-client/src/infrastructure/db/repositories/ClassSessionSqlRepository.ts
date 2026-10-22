import type {
  ClassSessionPatch,
  ClassSessionRepository,
  NewClassSession,
} from '@/application/ports/repositories';
import { normalizeClassSession, type ClassSession } from '@/domain';
import { classSessionFromRow, classSessionToRow } from '../mappers';
import type { ClassSessionRow } from '../rows';
import type { RepoDeps } from './deps';
import { EntityStore } from './EntityStore';
import { classPayload } from './payloads';
import { merge } from './sqlHelpers';

export class ClassSessionSqlRepository implements ClassSessionRepository {
  private readonly store: EntityStore<ClassSession, ClassSessionRow>;

  constructor(private readonly deps: RepoDeps) {
    this.store = new EntityStore(
      deps.db,
      {
        entity: 'class',
        table: 'class_sessions',
        idColumn: 'class_id',
        idOf: c => c.id,
        toRow: classSessionToRow,
        fromRow: classSessionFromRow,
        normalize: normalizeClassSession,
        payload: classPayload,
        deletePayload: () => ({}),
      },
      deps.outbox,
      deps.clock,
    );
  }

  create(input: NewClassSession) {
    return this.store.create(now => ({
      id: this.deps.ids.newId('cls'),
      subject: input.subject,
      dayOfWeek: input.dayOfWeek,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      room: input.room ?? '',
      teacher: input.teacher ?? '',
      color: input.color ?? '',
      updatedAt: now,
      deleted: false,
    }));
  }

  update(id: string, patch: ClassSessionPatch) {
    return this.store.update(id, current => merge(current, patch));
  }

  delete(id: string) {
    return this.store.delete(id);
  }

  get(id: string) {
    return this.store.get(id);
  }

  list() {
    return this.store.select('', [], 'day_of_week, start_minute, class_id');
  }
}
