import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { SessionService } from '@/application/auth/SessionService';
import type { SessionState } from '@/application/auth/sessionState';
import type {
  LoginInput,
  RegisterInput,
} from '@/application/ports/AuthGateway';
import type { AuthSession } from '@/domain/auth';

const SessionContext = createContext<SessionService | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: SessionService;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export interface SessionApi {
  state: SessionState;
  login(input: LoginInput): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  logout(): Promise<void>;
  /** Reads the stored session again, e.g. after it was unreadable. */
  retryRestore(): Promise<unknown>;
}

/** The session state (re-renders on change) and the actions that change it. */
export function useSession(): SessionApi {
  const service = useContext(SessionContext);
  if (service === null) {
    throw new Error('useSession needs a SessionProvider');
  }
  const subscribe = useCallback(
    (listener: () => void) => service.subscribe(listener),
    [service],
  );
  const state = useSyncExternalStore(subscribe, () => service.state());
  return useMemo(
    () => ({
      state,
      login: input => service.login(input),
      register: input => service.register(input),
      logout: () => service.logout(),
      retryRestore: () => service.restore(),
    }),
    [service, state],
  );
}
