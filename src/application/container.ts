import type { ApplyRemoteChanges } from './ports/RemoteChanges';
import type { OutboxRepository } from './ports/OutboxRepository';
import type { SyncStateRepository } from './ports/SyncStateRepository';
import type {
  ClassSessionRepository,
  EventRepository,
  SubtaskRepository,
  TagRepository,
  TaskListRepository,
  TaskRepository,
} from './ports/repositories';

/** Everything the UI and the sync engine use, built once per signed-in user. */
export interface AppContainer {
  taskLists: TaskListRepository;
  tasks: TaskRepository;
  subtasks: SubtaskRepository;
  tags: TagRepository;
  classSessions: ClassSessionRepository;
  events: EventRepository;
  outbox: OutboxRepository;
  syncState: SyncStateRepository;
  remoteChanges: ApplyRemoteChanges;
  schemaVersion: number;
  /** Releases the database handle. Call once, via ContainerSource.release. */
  close(): Promise<void>;
}

/**
 * How the presentation layer gets a container without knowing how it is
 * built: each acquire() must be paired with one release().
 */
export interface ContainerSource {
  acquire(): Promise<AppContainer>;
  release(): void;
}

/**
 * Reference-counted, single-flight owner of one container. Opens and closes
 * are serialized, so a release followed by an acquire (React dev double
 * effects, remounts) closes the old connection before opening the next and
 * two connections never initialize the same database at once.
 */
export class ContainerManager implements ContainerSource {
  private refs = 0;
  private current: Promise<AppContainer> | null = null;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly open: () => Promise<AppContainer>) {}

  acquire(): Promise<AppContainer> {
    this.refs += 1;
    if (this.current === null) {
      const opening = this.tail.then(() => this.open());
      this.current = opening;
      this.tail = opening.catch(() => undefined);
      // A failed open must not be cached: the next acquire retries.
      opening.catch(() => {
        if (this.current === opening) {
          this.current = null;
        }
      });
    }
    return this.current;
  }

  release(): void {
    if (this.refs === 0) {
      return;
    }
    this.refs -= 1;
    if (this.refs > 0 || this.current === null) {
      return;
    }
    const closing = this.current;
    this.current = null;
    this.tail = this.tail
      .then(() => closing)
      .then(
        container => container.close(),
        () => undefined,
      )
      .catch(() => undefined);
  }
}
