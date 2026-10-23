import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {
  HttpError,
  InvalidCredentialsError,
  NetworkError,
  SessionStoreUnreadableError,
} from '@/application/auth/errors';
import { SessionService } from '@/application/auth/SessionService';
import type { ContainerSource } from '@/application/container';
import type { AuthSession } from '@/domain/auth';
import App from '@/presentation/App';
import { asContainer } from '../helpers/plannerWorld';
import { withLocale } from '../helpers/i18n';
import { openTestWorld } from '../helpers/testRepositories';
import {
  active,
  FakeAuthGateway,
  InMemorySessionStore,
} from '../helpers/authFakes';

const expired: AuthSession = {
  userId: 'usr_1',
  email: 'a@b.co',
  name: 'Ann',
  accessToken: null,
  refreshToken: null,
};

function setup(initial: AuthSession | null = null) {
  const store = new InMemorySessionStore(initial);
  const gateway = new FakeAuthGateway();
  const users = { setUser: jest.fn(async (_id: string | null) => undefined) };
  const session = new SessionService({ gateway, store, users });
  const world = openTestWorld();
  const containers = {
    acquire: jest.fn(async () => asContainer(await world)),
    release: jest.fn(),
  } satisfies ContainerSource;
  return { store, gateway, users, session, containers };
}

/** The app in English (what these tests read), language already restored. */
async function renderApp(env: ReturnType<typeof setup>) {
  const { service, ready } = withLocale('en');
  await ready;
  render(
    <App session={env.session} containers={env.containers} locale={service} />,
  );
}

async function open(initial: AuthSession | null = null) {
  const env = setup(initial);
  await renderApp(env);
  await act(() => env.session.restore());
  return env;
}

const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);
const lists = () => screen.findByRole('header', { name: 'Dashboard' });
const press = (name: string) =>
  act(async () => {
    fireEvent.press(screen.getByRole('button', { name }));
    // Let the async work the press started settle inside act.
    await new Promise(resolve => setImmediate(resolve));
  });

let logSpy: jest.SpyInstance;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('loading', () => {
  it('shows a neutral loading view until the stored session is read', async () => {
    const env = setup(active());
    let finish!: (s: AuthSession | null) => void;
    env.store.get = () => new Promise(resolve => (finish = resolve));
    await renderApp(env);
    let restoring!: Promise<unknown>;
    act(() => {
      restoring = env.session.restore();
    });
    expect(await screen.findByText('Loading…')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    finish(active());
    await act(() => restoring);
    expect(await lists()).toBeTruthy();
  });
});

describe('sign in', () => {
  it('shows labeled, autofill-ready fields', async () => {
    await open();
    expect(screen.getByRole('header')).toHaveTextContent('Sign In');
    const email = screen.getByLabelText('Email');
    expect(email.props.keyboardType).toBe('email-address');
    expect(email.props.autoComplete).toBe('email');
    expect(email.props.textContentType).toBe('username');
    expect(email.props.autoCapitalize).toBe('none');
    expect(email.props.returnKeyType).toBe('next');
    const password = screen.getByLabelText('Password');
    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.autoComplete).toBe('current-password');
    expect(password.props.textContentType).toBe('password');
    expect(password.props.returnKeyType).toBe('done');
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('validates required fields client-side and sends nothing', async () => {
    const env = await open();
    await press('Sign In');
    expect(await screen.findByText('Enter your email')).toBeTruthy();
    expect(screen.getByText('Enter your password')).toBeTruthy();
    expect(env.gateway.login).not.toHaveBeenCalled();
  });

  it('submits trimmed credentials and lands on the signed-in home', async () => {
    const env = await open();
    type('Email', ' a@b.co ');
    type('Password', 'pw');
    await press('Sign In');
    expect(await lists()).toBeTruthy();
    expect(env.gateway.login).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'pw',
    });
    expect(env.users.setUser).toHaveBeenLastCalledWith('usr_1');
  });

  it('disables the button while loading and never double submits', async () => {
    const env = await open();
    let finish!: () => void;
    env.gateway.login.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve(active());
        }),
    );
    type('Email', 'a@b.co');
    type('Password', 'pw');
    await press('Sign In');
    const busy = await screen.findByRole('button', { name: 'Signing in…' });
    expect(busy.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(busy);
    fireEvent(screen.getByLabelText('Password'), 'submitEditing');
    expect(env.gateway.login).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(await lists()).toBeTruthy();
  });

  it.each([
    [new InvalidCredentialsError(), 'Email or password is incorrect.'],
    [
      new NetworkError(),
      'No connection. Signing in needs the internet the first time.',
    ],
    [new HttpError(500, 'HTTP 500'), 'Something went wrong. Please try again.'],
  ])(
    'announces %p as a message and lets the user retry',
    async (error, text) => {
      const env = await open();
      env.gateway.login.mockRejectedValueOnce(error as never);
      type('Email', 'a@b.co');
      type('Password', 'pw');
      await press('Sign In');
      const message = await screen.findByText(`Error: ${text}`);
      expect(message).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Sign In' }).props
          .accessibilityState,
      ).toMatchObject({ disabled: false });
      await press('Sign In');
      expect(await lists()).toBeTruthy();
    },
  );

  it('puts messages in a polite live region', async () => {
    await open();
    await press('Sign In');
    const note = await screen.findByText('Enter your email');
    let node = note.parent;
    let live: string | undefined;
    while (node && !live) {
      live = node.props.accessibilityLiveRegion;
      node = node.parent;
    }
    expect(live).toBe('polite');
  });

  it('shows and hides the password', async () => {
    await open();
    await press('Show password');
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    await press('Hide password');
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });
});

describe('create account', () => {
  async function toRegister() {
    const env = await open();
    await press('Create Account');
    return env;
  }

  it('switches to the register form and back', async () => {
    await toRegister();
    expect(screen.getByRole('header')).toHaveTextContent('Create Account');
    expect(screen.getByLabelText('Name (optional)')).toBeTruthy();
    expect(screen.getByLabelText('Password').props.autoComplete).toBe(
      'new-password',
    );
    expect(screen.getByLabelText('Password').props.textContentType).toBe(
      'newPassword',
    );
    await press('Sign In');
    expect(screen.getByRole('header')).toHaveTextContent('Sign In');
  });

  it('registers with email, name and password', async () => {
    const env = await toRegister();
    type('Email', 'new@b.co');
    type('Name (optional)', ' Nia ');
    type('Password', 'pw');
    await press('Create Account');
    await waitFor(() => expect(env.gateway.register).toHaveBeenCalled());
    expect(env.gateway.register).toHaveBeenCalledWith({
      email: 'new@b.co',
      name: 'Nia',
      password: 'pw',
    });
    expect(await lists()).toBeTruthy();
  });

  it('shows the server refusal for a taken email', async () => {
    const env = await toRegister();
    env.gateway.register.mockRejectedValueOnce(
      new HttpError(409, 'email already registered') as never,
    );
    type('Email', 'a@b.co');
    type('Password', 'pw');
    await press('Create Account');
    expect(
      await screen.findByText('Error: Email already registered.'),
    ).toBeTruthy();
  });
});

describe('session states', () => {
  it('tells the user the session expired and keeps their email', async () => {
    await open(expired);
    expect(
      screen.getByText(
        'Your session expired. Sign in again; your offline changes are kept.',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Email').props.value).toBe('a@b.co');
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
  });

  it('shows a retry, not the sign-in form, when the saved session is unreadable', async () => {
    const env = setup(active());
    const read = env.store.get.bind(env.store);
    env.store.get = async () => {
      throw new SessionStoreUnreadableError();
    };
    await renderApp(env);
    await act(() => env.session.restore());
    expect(
      await screen.findByText("Can't read your saved session"),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Email')).toBeNull();
    env.store.get = read;
    await press('Try again');
    expect(await lists()).toBeTruthy();
  });
});

describe('signed in', () => {
  it('shows the Panel, holds the user database and keeps the account one tap away in Settings', async () => {
    const env = await open(active());
    expect(await lists()).toBeTruthy();
    expect(env.containers.acquire).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(logSpy).toHaveBeenCalledWith('db ready (schema v2)'),
    );
    expect(screen.queryByText('Your tasks will live here.')).toBeNull();
    fireEvent.press(screen.getByRole('tab', { name: 'Settings' }));
    expect(await screen.findByText('Ann')).toBeTruthy();
    expect(screen.getByText('a@b.co')).toBeTruthy();
  });

  it('signs out: clears secure storage, closes the database, keeps local data', async () => {
    const env = await open(active());
    await lists();
    fireEvent.press(screen.getByRole('tab', { name: 'Settings' }));
    await press('Sign Out');
    expect(await screen.findByRole('header', { name: 'Sign In' })).toBeTruthy();
    expect(env.store.value).toBeNull();
    expect(env.users.setUser).toHaveBeenLastCalledWith(null);
    expect(env.containers.release).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ann')).toBeNull();
  });

  it('returns to the sign-in form when the session expires mid-use', async () => {
    const env = await open(active());
    await lists();
    act(() => env.session.handleExpired());
    expect(await screen.findByText(/Your session expired/)).toBeTruthy();
  });
});

describe('language on the sign-in screen', () => {
  it('speaks the saved language and switches with one tap, then remembers it', async () => {
    const env = setup();
    const { service, ready } = withLocale('es');
    await ready;
    render(
      <App
        session={env.session}
        containers={env.containers}
        locale={service}
      />,
    );
    await act(() => env.session.restore());
    expect(screen.getByRole('header')).toHaveTextContent('Iniciar Sesión');
    expect(screen.getByLabelText('Correo electrónico')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
    await press('English');
    expect(screen.getByRole('header')).toHaveTextContent('Sign In');
    expect(service.getSnapshot().locale).toBe('en');
    await press('Español');
    expect(screen.getByRole('header')).toHaveTextContent('Iniciar Sesión');
  });
});
