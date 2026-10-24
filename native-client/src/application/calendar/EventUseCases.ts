import { NotFoundError, type Event } from '@/domain';
import type {
  EventPatch,
  EventRepository,
  NewEvent,
} from '../ports/repositories';
import type { Notices } from '../planner/Notices';

/** Create, edit and delete an event. Validation is the domain's. */
export class EventUseCases {
  constructor(
    private readonly events: EventRepository,
    private readonly notices: Pick<Notices, 'announce'>,
  ) {}

  async create(input: NewEvent): Promise<Event> {
    const created = await this.events.create(trimmed(input));
    this.notices.announce({
      key: 'noticeEventAdded',
      params: { title: created.title },
    });
    return created;
  }

  async update(id: string, patch: EventPatch): Promise<Event> {
    const saved = await this.events.update(id, trimmed(patch));
    if (saved === null) {
      throw new NotFoundError('Event not found', 'event');
    }
    this.notices.announce({
      key: 'noticeEventSaved',
      params: { title: saved.title },
    });
    return saved;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.events.get(id);
    if (existing !== null && (await this.events.delete(id))) {
      this.notices.announce({
        key: 'noticeEventDeleted',
        params: { title: existing.title },
      });
    }
  }
}

/** The title is trimmed here; the domain refuses it blank. */
function trimmed<T extends EventPatch>(input: T): T {
  return input.title === undefined
    ? input
    : { ...input, title: input.title.trim() };
}
