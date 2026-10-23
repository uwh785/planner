import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { SessionService } from '@/application/auth/SessionService';
import type { ContainerSource } from '@/application/container';
import {
  INITIAL_SYNC_SNAPSHOT,
  SyncStatus,
  type SyncSnapshot,
} from '@/application/sync/SyncStatus';
import App from '@/presentation/App';
import { SyncProvider, useSyncStatus } from '@/presentation/syncContext';
import { syncStatusText } from '@/presentation/syncStatusText';
import { asContainer } from '../helpers/plannerWorld';
import { withLocale, words } from '../helpers/i18n';
import { openTestWorld } from '../helpers/testRepositories';
import {
  active,
  FakeAuthGateway,
  InMemorySessionStore,
} from '../helpers/authFakes';

const NOW = 1_700_000_000_000;
const snap = (patch: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
  ...INITIAL_SYNC_SNAPSHOT,
  ...patch,
});

describe('syncStatusText', () => {
  it.each([
    [{ phase: 'syncing' }, 'Syncing…'],
    [{ phase: 'paused', pendingCount: 3 }, 'Sync paused. Sign in again.'],
    [{ phase: 'offline', pendingCount: 3 }, 'Offline. 3 changes waiting.'],
    [{ phase: 'offline', pendingCount: 1 }, 'Offline. 1 change waiting.'],
    [{ phase: 'offline' }, 'Offline.'],
    [{ blockedCount: 1 }, '1 change needs attention'],
    [{ blockedCount: 1, rejectedCount: 2 }, '3 changes need attention'],
    [{ rejectedCount: 2, phase: 'offline' }, '2 changes need attention'],
    [{ phase: 'error' }, "Couldn't sync. Will try again."],
    [{ pendingCount: 2 }, '2 changes waiting'],
    [{ lastSyncAt: null }, 'Not synced yet'],
    [{ lastSyncAt: NOW - 20_000 }, 'Synced just now'],
    [{ lastSyncAt: NOW + 5_000 }, 'Synced just now'],
    [{ lastSyncAt: NOW - 61_000 }, 'Synced 1 min ago'],
    [{ lastSyncAt: NOW - 59 * 60_000 }, 'Synced 59 min ago'],
    [{ lastSyncAt: NOW - 3 * 3_600_000 }, 'Synced 3 h ago'],
    [{ lastSyncAt: NOW - 49 * 3_600_000 }, 'Synced 2 d ago'],
  ] as [Partial<SyncSnapshot>, string][])('%j -> %s', (patch, text) => {
    expect(syncStatusText(snap(patch), NOW, words('en').t)).toBe(text);
  });

  it('puts a paused session before everything and attention before syncing', () => {
    expect(
      syncStatusText(
        snap({ phase: 'paused', blockedCount: 4 }),
        NOW,
        words('en').t,
      ),
    ).toBe('Sync paused. Sign in again.');
    expect(
      syncStatusText(
        snap({ phase: 'syncing', rejectedCount: 1 }),
        NOW,
        words('en').t,
      ),
    ).toBe('1 change needs attention');
  });
});

describe('syncStatusText in Spanish', () => {
  it.each([
    [{ phase: 'syncing' }, 'Sincronizando…'],
    [
      { phase: 'offline', pendingCount: 3 },
      'Sin conexión. 3 cambios en espera.',
    ],
    [
      { phase: 'offline', pendingCount: 1 },
      'Sin conexión. 1 cambio en espera.',
    ],
    [{ blockedCount: 1 }, '1 cambio necesita atención'],
    [{ blockedCount: 1, rejectedCount: 2 }, '3 cambios necesitan atención'],
    [{ lastSyncAt: NOW - 5_000 }, 'Sincronizado hace un momento'],
    [{ lastSyncAt: NOW - 61_000 }, 'Sincronizado hace 1 min'],
    [{ lastSyncAt: NOW - 3 * 3_600_000 }, 'Sincronizado hace 3 h'],
  ] as [Partial<SyncSnapshot>, string][])('%j -> %s', (patch, text) => {
    expect(syncStatusText(snap(patch), NOW, words('es').t)).toBe(text);
  });
});

describe('useSyncStatus', () => {
  it('returns null without a provider source', () => {
    const { result } = renderHook(() => useSyncStatus());
    expect(result.current).toBeNull();
  });

  it('follows the source', () => {
    const source = new SyncStatus();
    const { result } = renderHook(() => useSyncStatus(), {
      wrapper: ({ children }) => (
        <SyncProvider source={source}>{children}</SyncProvider>
      ),
    });
    expect(result.current?.phase).toBe('idle');
    act(() => source.update({ phase: 'offline', pendingCount: 2 }));
    expect(result.current).toMatchObject({ phase: 'offline', pendingCount: 2 });
  });
});

async function renderHome(source?: SyncStatus) {
  const world = await openTestWorld();
  const store = new InMemorySessionStore(active());
  const session = new SessionService({
    gateway: new FakeAuthGateway(),
    store,
    users: { setUser: jest.fn(async () => undefined) },
  });
  const containers: ContainerSource = {
    acquire: jest.fn(async () => asContainer(world)),
    release: jest.fn(),
  };
  const { service, ready } = withLocale('en');
  await ready;
  render(
    <App
      session={session}
      containers={containers}
      sync={source}
      locale={service}
    />,
  );
  return act(() => session.restore());
}

describe('status line on the Panel', () => {
  beforeEach(() =>
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
  );
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows one polite live-region line that follows the status', async () => {
    const source = new SyncStatus();
    source.update({ lastSyncAt: Date.now() });
    await renderHome(source);
    const line = await screen.findByText('Synced just now');
    expect(line.props.accessibilityLiveRegion).toBe('polite');
    expect(line.props.allowFontScaling).not.toBe(false);

    act(() => source.update({ phase: 'syncing' }));
    expect(screen.getByText('Syncing…')).toBeTruthy();
    act(() => source.update({ phase: 'offline', pendingCount: 2 }));
    expect(screen.getByText('Offline. 2 changes waiting.')).toBeTruthy();
    act(() => source.update({ phase: 'idle', blockedCount: 1 }));
    expect(screen.getByText('1 change needs attention')).toBeTruthy();
    act(() => source.update({ phase: 'paused' }));
    expect(screen.getByText('Sync paused. Sign in again.')).toBeTruthy();
  });

  it('is absent when no sync status is provided', async () => {
    await renderHome(undefined);
    await screen.findByRole('header', { name: 'Dashboard' });
    expect(screen.queryByText(/sync/i)).toBeNull();
  });

  it('keeps its relative time fresh', async () => {
    jest.useFakeTimers({ now: NOW });
    const source = new SyncStatus();
    source.update({ lastSyncAt: NOW });
    await renderHome(source);
    expect(screen.getByText('Synced just now')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(5 * 60_000);
    });
    expect(screen.getByText('Synced 5 min ago')).toBeTruthy();
  });
});
