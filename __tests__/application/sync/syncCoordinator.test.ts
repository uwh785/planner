import type { SessionState } from '@/application/auth/sessionState';
import type { AppContainer, ContainerSource } from '@/application/container';
import { ChangeFeed } from '@/application/sync/ChangeFeed';
import { SyncCoordinator } from '@/application/sync/SyncCoordinator';
import { FakeSyncServer } from '../../helpers/fakeSyncServer';
import {
  FakeConnectivity,
  FakeLifecycle,
  FakeTimer,
} from '../../helpers/syncFakes';
import { openTestWorld, type TestWorld } from '../../helpers/testRepositories';

const ann = { userId: 'usr_ann', email: 'a@b.co', name: 'Ann' };
const bob = { userId: 'usr_bob', email: 'b@b.co', name: 'Bob' };

class FakeSession {
  private current: SessionState = { status: 'restoring' };
  private listeners = new Set<() => void>();
  get listenerCount() {
    return this.listeners.size;
  }
  state = () => this.current;
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  set(next: SessionState) {
    this.current = next;
    this.listeners.forEach(l => l());
  }
}

interface Env {
  worlds: Map<string, TestWorld>;
  feeds: Map<string, ChangeFeed>;
  current: string | null;
  acquired: number;
  released: number;
}

function setup() {
  const env: Env = {
    worlds: new Map(),
    feeds: new Map(),
    current: null,
    acquired: 0,
    released: 0,
  };
  const session = new FakeSession();
  const containers: ContainerSource = {
    acquire: async () => {
      env.acquired += 1;
      const id = env.current!;
      let world = env.worlds.get(id);
      if (world === undefined) {
        world = await openTestWorld();
        env.worlds.set(id, world);
        env.feeds.set(id, new ChangeFeed());
      }
      return {
        ...world,
        changes: env.feeds.get(id)!,
        schemaVersion: 2,
        close: async () => undefined,
      } as AppContainer;
    },
    release: () => {
      env.released += 1;
    },
  };
  const server = new FakeSyncServer();
  const world = { clock: undefined as unknown as TestWorld['clock'] };
  const connectivity = new FakeConnectivity(true);
  const lifecycle = new FakeLifecycle(true);
  return { env, session, containers, server, connectivity, lifecycle, world };
}

async function build() {
  const s = setup();
  const seed = await openTestWorld();
  s.world.clock = seed.clock;
  const timer = new FakeTimer(seed.clock);
  const coordinator = new SyncCoordinator({
    session: s.session,
    containers: s.containers,
    http: s.server,
    connectivity: s.connectivity,
    lifecycle: s.lifecycle,
    timer,
    clock: seed.clock,
    random: () => 0.5,
  });
  const signIn = async (user = ann) => {
    s.env.current = user.userId;
    s.session.set({ status: 'signedIn', user });
    await coordinator.idle();
  };
  return { ...s, timer, coordinator, signIn, seed };
}

afterEach(() => jest.restoreAllMocks());

describe('SyncCoordinator', () => {
  it('does nothing while signed out or restoring', async () => {
    const t = await build();
    t.coordinator.start();
    t.session.set({ status: 'signedOut' });
    await t.coordinator.idle();
    expect(t.env.acquired).toBe(0);
    expect(t.server.calls).toEqual([]);
    expect(t.timer.size).toBe(0);
  });

  it('syncs at once after sign-in and again after a local change', async () => {
    const t = await build();
    t.coordinator.start();
    await t.signIn();
    await new Promise(r => setImmediate(r));
    expect(t.server.calls).toContain('GET /api/sync?since=0');

    const world = t.env.worlds.get(ann.userId)!;
    await world.tasks.create({ title: 'offline edit' });
    t.env.feeds.get(ann.userId)!.notifyChange();
    t.server.calls.length = 0;
    t.timer.advance(2000);
    await new Promise(r => setImmediate(r));
    expect(t.server.calls[0]).toBe('POST /api/sync/push');
  });

  it('mirrors the engine status for the UI', async () => {
    const t = await build();
    const seen: string[] = [];
    t.coordinator.subscribe(() => seen.push(t.coordinator.getSnapshot().phase));
    t.coordinator.start();
    await t.signIn();
    await new Promise(r => setImmediate(r));
    expect(t.coordinator.getSnapshot().phase).toBe('idle');
    expect(t.coordinator.getSnapshot().lastSyncAt).not.toBeNull();
    expect(seen).toContain('syncing');
  });

  it('stops everything on sign-out: no timers, no listeners, container released', async () => {
    const t = await build();
    t.coordinator.start();
    await t.signIn();
    await new Promise(r => setImmediate(r));
    expect(t.timer.size).toBeGreaterThan(0);

    t.session.set({ status: 'signedOut' });
    await t.coordinator.idle();

    expect(t.timer.size).toBe(0);
    expect(t.connectivity.listeners).toBe(0);
    expect(t.lifecycle.listeners).toBe(0);
    expect(t.env.feeds.get(ann.userId)!.listenerCount).toBe(0);
    expect(t.env.released).toBe(t.env.acquired);
    expect(t.coordinator.getSnapshot().phase).toBe('idle');
    t.server.calls.length = 0;
    t.connectivity.set(false);
    t.connectivity.set(true);
    t.timer.advance(10 * 60_000);
    expect(t.server.calls).toEqual([]);
  });

  it('stops on an expired session too', async () => {
    const t = await build();
    t.coordinator.start();
    await t.signIn();
    t.session.set({ status: 'expired', user: ann });
    await t.coordinator.idle();
    expect(t.timer.size).toBe(0);
    expect(t.connectivity.listeners).toBe(0);
  });

  it('rebuilds for a different user and keeps users apart', async () => {
    const t = await build();
    t.coordinator.start();
    await t.signIn(ann);
    t.session.set({ status: 'signedOut' });
    await t.coordinator.idle();
    await t.signIn(bob);
    await new Promise(r => setImmediate(r));

    expect(t.env.feeds.get(ann.userId)!.listenerCount).toBe(0);
    expect(t.env.feeds.get(bob.userId)!.listenerCount).toBe(1);
    expect(t.connectivity.listeners).toBe(1);
    expect(t.env.released).toBe(t.env.acquired - 1);
  });

  it('switching users without a signed-out state still tears the old one down', async () => {
    const t = await build();
    t.coordinator.start();
    await t.signIn(ann);
    await t.signIn(bob);
    expect(t.env.feeds.get(ann.userId)!.listenerCount).toBe(0);
    expect(t.env.feeds.get(bob.userId)!.listenerCount).toBe(1);
    expect(t.connectivity.listeners).toBe(1);
  });

  it('ignores repeated signed-in notifications for the same user', async () => {
    const t = await build();
    t.coordinator.start();
    await t.signIn(ann);
    await t.signIn(ann);
    expect(t.env.acquired).toBe(1);
  });

  it('stop() unsubscribes from the session and tears down', async () => {
    const t = await build();
    t.coordinator.start();
    await t.signIn();
    await t.coordinator.stop();
    expect(t.session.listenerCount).toBe(0);
    expect(t.timer.size).toBe(0);
    expect(t.connectivity.listeners).toBe(0);
    expect(t.env.released).toBe(t.env.acquired);
  });

  it('releases the container when the user signs out while it was opening', async () => {
    const t = await build();
    t.coordinator.start();
    t.env.current = ann.userId;
    t.session.set({ status: 'signedIn', user: ann });
    t.session.set({ status: 'signedOut' });
    await t.coordinator.idle();
    expect(t.env.released).toBe(t.env.acquired);
    expect(t.connectivity.listeners).toBe(0);
  });
});
