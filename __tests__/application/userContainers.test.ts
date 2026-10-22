import type { AppContainer } from '@/application/container';
import { NotSignedInError } from '@/application/auth/errors';
import { UserContainers } from '@/application/userContainers';

function fakeContainer(userId: string): AppContainer & { userId: string } {
  return { userId, close: jest.fn(async () => undefined) } as never;
}

function setup(ready?: Promise<unknown>) {
  const opened: ReturnType<typeof fakeContainer>[] = [];
  const containers = new UserContainers({
    open: async userId => {
      const c = fakeContainer(userId);
      opened.push(c);
      return c;
    },
    whenReady: ready ? () => ready : undefined,
  });
  return { containers, opened };
}

it('rejects acquire while nobody is signed in', async () => {
  const { containers } = setup();
  await expect(containers.acquire()).rejects.toBeInstanceOf(NotSignedInError);
  containers.release();
});

it('opens the signed-in user database and closes it on release', async () => {
  const { containers, opened } = setup();
  await containers.setUser('usr_1');
  const c = (await containers.acquire()) as never as { userId: string };
  expect(c.userId).toBe('usr_1');
  containers.release();
  await new Promise(r => setImmediate(r));
  expect(opened[0]?.close).toHaveBeenCalledTimes(1);
});

it('closes the old handle when the user changes, even if still held', async () => {
  const { containers, opened } = setup();
  await containers.setUser('usr_1');
  await containers.acquire();
  await containers.setUser('usr_2');
  expect(opened[0]?.close).toHaveBeenCalledTimes(1);
  // The stale holder releases later; that must not close the new user's db.
  const second = (await containers.acquire()) as never as { userId: string };
  expect(second.userId).toBe('usr_2');
  containers.release(); // pairs with the first (stale) lease
  await new Promise(r => setImmediate(r));
  expect(opened[1]?.close).not.toHaveBeenCalled();
  containers.release();
  await new Promise(r => setImmediate(r));
  expect(opened[1]?.close).toHaveBeenCalledTimes(1);
});

it('logging out closes the handle and later acquires are refused', async () => {
  const { containers, opened } = setup();
  await containers.setUser('usr_1');
  await containers.acquire();
  await containers.setUser(null);
  expect(opened[0]?.close).toHaveBeenCalledTimes(1);
  await expect(containers.acquire()).rejects.toBeInstanceOf(NotSignedInError);
});

it('waits for the initial restore before deciding', async () => {
  let done!: () => void;
  const ready = new Promise<void>(r => (done = r));
  const { containers } = setup(ready);
  const pending = containers.acquire();
  await containers.setUser('usr_1');
  done();
  await expect(pending).resolves.toBeDefined();
});

it('does not open a database for an acquire released while waiting', async () => {
  let done!: () => void;
  const ready = new Promise<void>(r => (done = r));
  const { containers, opened } = setup(ready);
  const pending = containers.acquire();
  pending.catch(() => undefined);
  containers.release(); // StrictMode cleanup before the restore finished
  await containers.setUser('usr_1');
  done();
  await expect(pending).rejects.toThrow();
  expect(opened).toHaveLength(0);
});
