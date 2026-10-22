import { ChangeFeed } from '@/application/sync/ChangeFeed';
import type { Clock } from '@/application/ports/Clock';
import type { IdGenerator } from '@/application/ports/IdGenerator';
import type { ApplyRemoteChanges } from '@/application/ports/RemoteChanges';
import type { OutboxRepository } from '@/application/ports/OutboxRepository';
import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import type { SyncStateRepository } from '@/application/ports/SyncStateRepository';
import type {
  ClassSessionRepository,
  EventRepository,
  SubtaskRepository,
  TagRepository,
  TaskListRepository,
  TaskRepository,
} from '@/application/ports/repositories';
import { NotifyingDatabase } from '../NotifyingDatabase';
import { RandomIdGenerator } from '../../system/RandomIdGenerator';
import { SystemClock } from '../../system/SystemClock';
import { ClassSessionSqlRepository } from './ClassSessionSqlRepository';
import { EventSqlRepository } from './EventSqlRepository';
import { OutboxSqlRepository } from './OutboxSqlRepository';
import { OutboxWriter } from './OutboxWriter';
import { RemoteChangesApplier } from './RemoteChangesApplier';
import { SubtaskSqlRepository } from './SubtaskSqlRepository';
import { SyncStateSqlRepository } from './SyncStateSqlRepository';
import { TagSqlRepository } from './TagSqlRepository';
import { TaskListSqlRepository } from './TaskListSqlRepository';
import { TaskSqlRepository } from './TaskSqlRepository';

export interface Repositories {
  taskLists: TaskListRepository;
  tasks: TaskRepository;
  subtasks: SubtaskRepository;
  tags: TagRepository;
  classSessions: ClassSessionRepository;
  events: EventRepository;
  outbox: OutboxRepository;
  syncState: SyncStateRepository;
  remoteChanges: ApplyRemoteChanges;
  /** Fires after each committed local write. */
  changes: ChangeFeed;
}

export interface RepositoryDeps {
  ids: IdGenerator;
  clock: Clock;
}

/**
 * Wires every repository over one migrated database. The repositories write
 * through a `NotifyingDatabase`, so `changes` fires after each committed
 * local write; the outbox reader and the pull applier use the plain handle.
 */
export function createRepositories(
  db: SqlDatabase,
  deps: RepositoryDeps = {
    ids: new RandomIdGenerator(),
    clock: new SystemClock(),
  },
): Repositories {
  const feed = new ChangeFeed();
  const shared = {
    db: new NotifyingDatabase(db, feed),
    ids: deps.ids,
    clock: deps.clock,
    outbox: new OutboxWriter(deps.ids, deps.clock),
  };
  const tasks = new TaskSqlRepository(shared);
  return {
    taskLists: new TaskListSqlRepository(shared, tasks),
    tasks,
    subtasks: new SubtaskSqlRepository(shared),
    tags: new TagSqlRepository(shared),
    classSessions: new ClassSessionSqlRepository(shared),
    events: new EventSqlRepository(shared),
    outbox: new OutboxSqlRepository(db),
    syncState: new SyncStateSqlRepository(db),
    remoteChanges: new RemoteChangesApplier(db),
    changes: feed,
  };
}
