import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { SessionService } from '@/application/auth/SessionService';
import {
  InMemoryLocaleStore,
  LocaleService,
  type Locale,
} from '@/application/i18n';
import type { ContainerSource } from '@/application/container';
import type { SyncStatusSource } from '@/application/sync/SyncStatus';
import App from '@/presentation/App';
import { active, FakeAuthGateway, InMemorySessionStore } from './authFakes';
import { asContainer, flushAsync } from './plannerWorld';
import { FakeLifecycle, FakeTimer } from './syncFakes';
import { openTestWorld, type TestWorld } from './testRepositories';

export interface Rendered {
  world: TestWorld;
  timer: FakeTimer;
  lifecycle: FakeLifecycle;
  session: SessionService;
  locale: LocaleService;
  localeStore: InMemoryLocaleStore;
  gateway: FakeAuthGateway;
  containers: ContainerSource & { acquire: jest.Mock; release: jest.Mock };
}

/** The whole app, signed in, over real repositories on in-memory SQLite. */
/**
 * Wraps a repository so each call runs inside `act`: the screens react to
 * the write, and React wants to see that happen.
 */
function inAct<T extends object>(repo: T): T {
  return new Proxy(repo, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== 'function') {
        return value;
      }
      return (...args: unknown[]) =>
        new Promise((resolve, reject) => {
          let result: unknown;
          // act() returns a bare thenable, not a promise: chain by hand.
          act(async () => {
            result = await value.apply(target, args);
            await flushAsync(2);
          }).then(() => resolve(result), reject);
        });
    },
  });
}

export const NOW = new Date(2026, 9, 22, 10, 0).getTime();

export async function renderSignedIn(
  options: {
    sync?: SyncStatusSource;
    world?: TestWorld;
    now?: number;
    /** The saved language; English by default so most tests read plainly. */
    locale?: Locale;
  } = {},
): Promise<Rendered> {
  const world = options.world ?? (await openTestWorld());
  world.clock.current = options.now ?? NOW;
  const timer = new FakeTimer(world.clock);
  const lifecycle = new FakeLifecycle(true);
  const gateway = new FakeAuthGateway();
  const session = new SessionService({
    gateway,
    store: new InMemorySessionStore(active()),
    users: { setUser: jest.fn(async () => undefined) },
  });
  const containers = {
    acquire: jest.fn(async () => asContainer(world)),
    release: jest.fn(),
  };
  const localeStore = new InMemoryLocaleStore(options.locale ?? 'en');
  const locale = new LocaleService(localeStore);
  await locale.restore();
  render(
    <App
      session={session}
      containers={containers}
      sync={options.sync}
      locale={locale}
      runtime={{ clock: world.clock, timer, lifecycle }}
    />,
  );
  await act(() => session.restore());
  await screen.findByRole('header', {
    name: options.locale === 'es' ? 'Panel' : 'Dashboard',
  });
  await act(async () => flushAsync());
  // The tests write through `world`; the app keeps the plain repositories.
  const written: TestWorld = {
    ...world,
    tasks: inAct(world.tasks),
    taskLists: inAct(world.taskLists),
    remoteChanges: inAct(world.remoteChanges),
  };
  return {
    world: written,
    timer,
    lifecycle,
    session,
    locale,
    localeStore,
    gateway,
    containers,
  };
}
