import { ChangeFeed } from '@/application/sync/ChangeFeed';
import { SyncScheduler } from '@/application/sync/SyncScheduler';
import { SyncStatus } from '@/application/sync/SyncStatus';
import {
  FakeConnectivity,
  FakeLifecycle,
  FakeTimer,
} from '../../helpers/syncFakes';
import { FakeClock } from '../../helpers/testRepositories';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

class FakeEngine {
  readonly status = new SyncStatus();
  nextRetryAt: number | null = null;
  sync = jest.fn(async () => undefined);
  refresh = jest.fn(async () => undefined);
  noteConnectivity = jest.fn((_online: boolean) => undefined);
  fail(at: number, phase: 'offline' | 'error' = 'error') {
    this.nextRetryAt = at;
    this.status.update({ phase, nextRetryAt: at });
  }
  recover() {
    this.nextRetryAt = null;
    this.status.update({ phase: 'idle', nextRetryAt: null });
  }
}

function setup(options: { online?: boolean; foreground?: boolean } = {}) {
  const clock = new FakeClock(0);
  const timer = new FakeTimer(clock);
  const engine = new FakeEngine();
  const changes = new ChangeFeed();
  const connectivity = new FakeConnectivity(options.online ?? true);
  const lifecycle = new FakeLifecycle(options.foreground ?? true);
  const scheduler = new SyncScheduler({
    engine,
    changes,
    connectivity,
    lifecycle,
    timer,
    clock,
  });
  return { clock, timer, engine, changes, connectivity, lifecycle, scheduler };
}

describe('start', () => {
  it('syncs at once when online and tells the engine the network state', () => {
    const s = setup();
    s.scheduler.start();
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
    expect(s.engine.refresh).toHaveBeenCalled();
    expect(s.engine.noteConnectivity).toHaveBeenCalledWith(true);
  });

  it('does not sync while the OS is offline, and syncs when connectivity returns', () => {
    const s = setup({ online: false });
    s.scheduler.start();
    expect(s.engine.sync).not.toHaveBeenCalled();
    expect(s.engine.noteConnectivity).toHaveBeenCalledWith(false);
    s.connectivity.set(true);
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
    expect(s.engine.noteConnectivity).toHaveBeenLastCalledWith(true);
  });

  it('is idempotent', () => {
    const s = setup();
    s.scheduler.start();
    s.scheduler.start();
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
    expect(s.connectivity.listeners).toBe(1);
  });
});

describe('connectivity', () => {
  it('syncs only on the offline to online transition', () => {
    const s = setup();
    s.scheduler.start();
    s.engine.sync.mockClear();
    s.connectivity.set(true);
    expect(s.engine.sync).not.toHaveBeenCalled();
    s.connectivity.set(false);
    s.connectivity.set(true);
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
  });
});

describe('foreground', () => {
  it('syncs when the app returns to the foreground, not when it leaves', () => {
    const s = setup();
    s.scheduler.start();
    s.engine.sync.mockClear();
    s.lifecycle.set(false);
    expect(s.engine.sync).not.toHaveBeenCalled();
    s.lifecycle.set(true);
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
  });
});

describe('local changes', () => {
  it('waits 2 s after the last change, however many come', () => {
    const s = setup();
    s.scheduler.start();
    s.engine.sync.mockClear();
    s.changes.notifyChange();
    s.timer.advance(1500);
    s.changes.notifyChange();
    s.timer.advance(1500);
    s.changes.notifyChange();
    s.timer.advance(1999);
    expect(s.engine.sync).not.toHaveBeenCalled();
    s.timer.advance(1);
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
    expect(s.engine.refresh.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('does not sync a change while offline (the counts still refresh)', () => {
    const s = setup({ online: false });
    s.scheduler.start();
    s.engine.refresh.mockClear();
    s.changes.notifyChange();
    s.timer.advance(2000);
    expect(s.engine.sync).not.toHaveBeenCalled();
    expect(s.engine.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('periodic', () => {
  it('syncs every 5 minutes while foregrounded', () => {
    const s = setup();
    s.scheduler.start();
    s.engine.sync.mockClear();
    s.timer.advance(5 * MINUTE - 1);
    expect(s.engine.sync).not.toHaveBeenCalled();
    s.timer.advance(1);
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
    s.timer.advance(5 * MINUTE);
    expect(s.engine.sync).toHaveBeenCalledTimes(2);
  });

  it('pauses in the background and restarts on return', () => {
    const s = setup();
    s.scheduler.start();
    s.lifecycle.set(false);
    s.engine.sync.mockClear();
    s.timer.advance(20 * MINUTE);
    expect(s.engine.sync).not.toHaveBeenCalled();
    s.lifecycle.set(true);
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
    s.timer.advance(5 * MINUTE);
    expect(s.engine.sync).toHaveBeenCalledTimes(2);
  });

  it('skips a tick while offline', () => {
    const s = setup();
    s.scheduler.start();
    s.connectivity.set(false);
    s.engine.sync.mockClear();
    s.timer.advance(5 * MINUTE);
    expect(s.engine.sync).not.toHaveBeenCalled();
    s.timer.advance(5 * MINUTE);
    s.connectivity.set(true);
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
  });

  it('does not start a periodic timer when started in the background', () => {
    const s = setup({ foreground: false });
    s.scheduler.start();
    expect(s.timer.size).toBe(0);
  });
});

describe('retry after a failure', () => {
  it('syncs again when nextRetryAt elapses', () => {
    const s = setup();
    s.scheduler.start();
    s.engine.sync.mockClear();
    s.engine.fail(s.clock.now() + 2000);
    s.timer.advance(1999);
    expect(s.engine.sync).not.toHaveBeenCalled();
    s.timer.advance(1);
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
  });

  it('follows a changed retry time and cancels it after recovery', () => {
    const s = setup();
    s.scheduler.start();
    s.engine.sync.mockClear();
    s.engine.fail(s.clock.now() + 2000);
    s.engine.fail(s.clock.now() + 5000);
    s.timer.advance(2000);
    expect(s.engine.sync).not.toHaveBeenCalled();
    s.timer.advance(3000);
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
    s.engine.fail(s.clock.now() + 60_000);
    s.engine.recover();
    s.engine.sync.mockClear();
    s.timer.advance(60_000);
    expect(s.engine.sync).not.toHaveBeenCalled();
  });

  it('skips the retry while offline; regained connectivity syncs', () => {
    const s = setup();
    s.scheduler.start();
    s.connectivity.set(false);
    s.engine.sync.mockClear();
    s.engine.fail(s.clock.now() + 2000, 'offline');
    s.timer.advance(2000);
    expect(s.engine.sync).not.toHaveBeenCalled();
    s.connectivity.set(true);
    expect(s.engine.sync).toHaveBeenCalledTimes(1);
  });
});

describe('paused sessions', () => {
  it('never syncs while the engine is paused', () => {
    const s = setup();
    s.scheduler.start();
    s.engine.status.update({ phase: 'paused' });
    s.engine.sync.mockClear();
    s.connectivity.set(false);
    s.connectivity.set(true);
    s.lifecycle.set(false);
    s.lifecycle.set(true);
    s.changes.notifyChange();
    s.timer.advance(10 * MINUTE);
    expect(s.engine.sync).not.toHaveBeenCalled();
  });
});

describe('stop', () => {
  it('cancels every timer and listener and ignores later events', () => {
    const s = setup();
    s.scheduler.start();
    s.changes.notifyChange();
    s.engine.fail(s.clock.now() + 2000);
    expect(s.timer.size).toBeGreaterThan(0);

    s.scheduler.stop();

    expect(s.timer.size).toBe(0);
    expect(s.connectivity.listeners).toBe(0);
    expect(s.lifecycle.listeners).toBe(0);
    expect(s.changes.listenerCount).toBe(0);
    s.engine.sync.mockClear();
    s.connectivity.set(false);
    s.connectivity.set(true);
    s.lifecycle.set(true);
    s.changes.notifyChange();
    s.engine.fail(s.clock.now() + 1000);
    s.timer.advance(20 * MINUTE);
    expect(s.engine.sync).not.toHaveBeenCalled();
    expect(s.timer.size).toBe(0);
    s.scheduler.stop();
  });
});
