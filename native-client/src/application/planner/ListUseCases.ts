import { NotFoundError, type TaskList } from '@/domain';
import type { TaskListRepository } from '../ports/repositories';
import { LIST_COLORS } from './listColors';
import type { Notices } from './Notices';

/** Create, rename, recolor and delete a list. Validation is the domain's. */
export class ListUseCases {
  constructor(
    private readonly lists: TaskListRepository,
    private readonly notices: Pick<Notices, 'announce'>,
  ) {}

  /** A new list takes the next palette color unless one is given. */
  async create(name: string, color?: string): Promise<TaskList> {
    const chosen =
      color ??
      LIST_COLORS[(await this.lists.list()).length % LIST_COLORS.length]!.value;
    const list = await this.lists.create({ name, color: chosen });
    this.notices.announce({
      key: 'noticeListAdded',
      params: { name: list.name },
    });
    return list;
  }

  async rename(id: string, name: string): Promise<TaskList> {
    return this.found(await this.lists.update(id, { name }));
  }

  async recolor(id: string, color: string): Promise<TaskList> {
    return this.found(await this.lists.update(id, { color }));
  }

  /** Its tasks stay and move to "no list" (the repository detaches them). */
  async remove(id: string): Promise<void> {
    const list = await this.lists.get(id);
    if (list !== null && (await this.lists.delete(id))) {
      this.notices.announce({
        key: 'noticeListDeleted',
        params: { name: list.name },
      });
    }
  }

  private found(list: TaskList | null): TaskList {
    if (list === null) {
      throw new NotFoundError('List not found', 'list');
    }
    return list;
  }
}
