import { ContainerManager, type AppContainer } from '@/application/container';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function fakeContainer(log: string[], n: number): AppContainer {
  return {
    schemaVersion: 1,
    close: jest.fn(async () => {
      log.push(`close ${n}`);
    }),
  } as unknown as AppContainer;
}

function setup() {
  const log: string[] = [];
  let opened = 0;
  let active = 0;
  let maxActive = 0;
  const manager = new ContainerManager(async () => {
    opened += 1;
    const n = opened;
    log.push(`open ${n} start`);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await flush();
    log.push(`open ${n} done`);
    const c = fakeContainer(log, n);
    const close = c.close;
    c.close = async () => {
      active -= 1;
      await close();
    };
    return c;
  });
  return { manager, log, stats: () => ({ opened, maxActive }) };
}

describe('ContainerManager', () => {
  it('opens once for concurrent acquirers and shares the container', async () => {
    const { manager, stats } = setup();
    const [a, b] = await Promise.all([manager.acquire(), manager.acquire()]);
    expect(a).toBe(b);
    expect(stats().opened).toBe(1);
  });

  it('closes only after the last release', async () => {
    const { manager, log } = setup();
    await manager.acquire();
    await manager.acquire();
    manager.release();
    await flush();
    expect(log).not.toContain('close 1');
    manager.release();
    await flush();
    expect(log).toContain('close 1');
  });

  it('survives a React dev double effect: acquire, release, acquire', async () => {
    const { manager, log, stats } = setup();
    const first = manager.acquire();
    manager.release();
    const second = manager.acquire();
    const container = await second;
    await first.catch(() => undefined);
    await flush();
    // The first connection was closed before the second was opened: never two at once.
    expect(stats().maxActive).toBe(1);
    expect(log.indexOf('close 1')).toBeLessThan(log.indexOf('open 2 start'));
    expect(container.schemaVersion).toBe(1);
    manager.release();
    await flush();
    expect(log).toContain('close 2');
  });

  it('reopens after a full release (remount) without leaking the old handle', async () => {
    const { manager, log, stats } = setup();
    await manager.acquire();
    manager.release();
    await manager.acquire();
    expect(stats().opened).toBe(2);
    expect(stats().maxActive).toBe(1);
    expect(log).toContain('close 1');
  });

  it('lets a failed open be retried by the next acquire', async () => {
    let calls = 0;
    const manager = new ContainerManager(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('disk full');
      }
      return fakeContainer([], calls);
    });
    await expect(manager.acquire()).rejects.toThrow('disk full');
    manager.release();
    await expect(manager.acquire()).resolves.toBeDefined();
    expect(calls).toBe(2);
  });

  it('ignores an extra release', async () => {
    const { manager } = setup();
    manager.release();
    await manager.acquire();
  });
});
