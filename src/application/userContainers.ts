import { NotSignedInError } from './auth/errors';
import { ContainerManager } from './container';
import type { AppContainer, ContainerSource } from './container';
import type { UserSwitch } from './auth/SessionService';

interface UserEntry {
  userId: string;
  manager: ContainerManager;
}

/** One acquire() and the manager that served it, so release() can pair up. */
interface Lease {
  manager: ContainerManager | null;
  released: boolean;
}

/**
 * The container of whoever is signed in. Each user has their own database
 * (`planner_<userId>.db`); switching or leaving closes the previous handle
 * at once, even if a screen still holds it.
 *
 * acquire()/release() are paired first-in first-out, so a stale holder that
 * releases after a user switch cannot close the new user's database.
 */
export class UserContainers implements ContainerSource, UserSwitch {
  private entry: UserEntry | null = null;
  private readonly leases: Lease[] = [];

  constructor(
    private readonly options: {
      open: (userId: string) => Promise<AppContainer>;
      /** Awaited by acquire(), e.g. the initial session restore. */
      whenReady?: () => Promise<unknown>;
    },
  ) {}

  async setUser(userId: string | null): Promise<void> {
    if (this.entry?.userId === userId) {
      return;
    }
    const old = this.entry;
    this.entry =
      userId === null
        ? null
        : {
            userId,
            manager: new ContainerManager(() => this.options.open(userId)),
          };
    await old?.manager.forceClose();
  }

  async acquire(): Promise<AppContainer> {
    const lease: Lease = { manager: null, released: false };
    this.leases.push(lease);
    await this.options.whenReady?.().catch(() => undefined);
    if (lease.released) {
      throw new Error('Container released before it opened');
    }
    if (this.entry === null) {
      throw new NotSignedInError();
    }
    lease.manager = this.entry.manager;
    return lease.manager.acquire();
  }

  release(): void {
    const lease = this.leases.shift();
    if (lease) {
      lease.released = true;
      lease.manager?.release();
    }
  }
}
