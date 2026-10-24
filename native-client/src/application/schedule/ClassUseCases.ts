import { NotFoundError, type ClassSession } from '@/domain';
import type {
  ClassSessionPatch,
  ClassSessionRepository,
  NewClassSession,
} from '../ports/repositories';
import type { Notices } from '../planner/Notices';

/** Create, edit and delete a weekly class. Validation is the domain's. */
export class ClassUseCases {
  constructor(
    private readonly classes: ClassSessionRepository,
    private readonly notices: Pick<Notices, 'announce'>,
  ) {}

  async create(input: NewClassSession): Promise<ClassSession> {
    const created = await this.classes.create(trimmed(input));
    this.notices.announce({
      key: 'noticeClassAdded',
      params: { subject: created.subject },
    });
    return created;
  }

  async update(id: string, patch: ClassSessionPatch): Promise<ClassSession> {
    const saved = await this.classes.update(id, trimmed(patch));
    if (saved === null) {
      throw new NotFoundError('Class not found', 'class');
    }
    this.notices.announce({
      key: 'noticeClassSaved',
      params: { subject: saved.subject },
    });
    return saved;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.classes.get(id);
    if (existing !== null && (await this.classes.delete(id))) {
      this.notices.announce({
        key: 'noticeClassDeleted',
        params: { subject: existing.subject },
      });
    }
  }
}

/** The subject is trimmed here; the domain upper-cases it. */
function trimmed<T extends ClassSessionPatch>(input: T): T {
  return input.subject === undefined
    ? input
    : { ...input, subject: input.subject.trim() };
}
