import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SessionService } from '@/application/auth/SessionService';
import { InMemoryLocaleStore, LocaleService } from '@/application/i18n';
import App from '@/presentation/App';
import {
  active,
  FakeAuthGateway,
  InMemorySessionStore,
} from '../helpers/authFakes';
import { asContainer, flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn } from '../helpers/renderApp';
import { openTestWorld } from '../helpers/testRepositories';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(async () => flushAsync());

describe('switching the language', () => {
  it('re-words the open screen and the tab bar at once, from Settings', async () => {
    const env = await renderSignedIn({ locale: 'es' });
    fireEvent.press(screen.getByRole('tab', { name: 'Config' }));
    expect(
      await screen.findByRole('header', { name: 'Configuración' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Español' }).props.accessibilityState,
    ).toMatchObject({ selected: true });

    fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    await settle();
    expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy();
    expect(
      screen.getAllByRole('tab').map(t => t.props.accessibilityLabel),
    ).toEqual(['Dashboard', 'Tasks', 'Settings']);
    expect(env.locale.getSnapshot().locale).toBe('en');
  });

  it('re-words the other tabs too, including cards and notices', async () => {
    const env = await renderSignedIn({ locale: 'es' });
    await env.world.tasks.create({
      title: 'Prepare slides',
      status: 'in_progress',
      priority: 3,
      durationMs: 2 * 3_600_000,
    });
    await settle();
    expect(screen.getByText('Alta')).toBeTruthy();
    expect(screen.getByText('Tiempo restante')).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: 'Config' }));
    fireEvent.press(await screen.findByRole('radio', { name: 'English' }));
    await settle();
    fireEvent.press(screen.getByRole('tab', { name: 'Dashboard' }));
    await settle();
    expect(screen.getByRole('header', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.getByText('Time left')).toBeTruthy();
    expect(screen.getByLabelText('In Progress: 1')).toBeTruthy();
    expect(screen.queryByText('Alta')).toBeNull();
  });

  it('saves the choice on the device and a restart picks it up', async () => {
    const env = await renderSignedIn({ locale: 'es' });
    fireEvent.press(screen.getByRole('tab', { name: 'Config' }));
    fireEvent.press(await screen.findByRole('radio', { name: 'English' }));
    await settle();
    expect(env.localeStore.value).toBe('en');

    // "Restart": a new app over the same device storage.
    const world = await openTestWorld();
    const session = new SessionService({
      gateway: new FakeAuthGateway(),
      store: new InMemorySessionStore(active()),
      users: { setUser: async () => undefined },
    });
    const restarted = new LocaleService(env.localeStore);
    await restarted.restore();
    render(
      <App
        session={session}
        containers={{
          acquire: async () => asContainer(world),
          release: () => undefined,
        }}
        locale={restarted}
      />,
    );
    await act(() => session.restore());
    expect(
      (await screen.findAllByRole('header', { name: 'Dashboard' })).length,
    ).toBeGreaterThan(0);
  });

  it('starts in Spanish when nothing was saved', async () => {
    const service = new LocaleService(new InMemoryLocaleStore());
    await service.restore();
    expect(service.getSnapshot().locale).toBe('es');
  });

  it('shows nothing until the saved language is read (no flash of the wrong language)', async () => {
    const store = new InMemoryLocaleStore('en');
    let release!: () => void;
    store.load = () =>
      new Promise(resolve => {
        release = () => resolve('en');
      });
    const service = new LocaleService(store);
    const restoring = service.restore();
    const session = new SessionService({
      gateway: new FakeAuthGateway(),
      store: new InMemorySessionStore(null),
      users: { setUser: async () => undefined },
    });
    await session.restore();
    render(
      <App
        session={session}
        containers={{
          acquire: async () => asContainer(await openTestWorld()),
          release: () => undefined,
        }}
        locale={service}
      />,
    );
    expect(screen.queryByRole('header')).toBeNull();
    await act(async () => {
      release();
      await restoring;
    });
    expect(screen.getByRole('header')).toHaveTextContent('Sign In');
  });
});
