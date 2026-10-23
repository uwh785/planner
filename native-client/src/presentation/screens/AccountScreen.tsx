import React, { useState } from 'react';
import { Frame } from '../components/atoms/Screen';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import { AccountView } from '../components/organisms/AccountView';
import type { ScreenProps } from '../navigation/routes';
import { usePlanner } from '../plannerContext';
import { useSession } from '../sessionContext';
import { DevTaskButton } from './DevTaskButton';

/**
 * Who is signed in, Sign out and the development-only controls. Signing out
 * first completes any task still in its undo window, so nothing is lost.
 */
export function AccountScreen({ navigation }: ScreenProps<'Account'>) {
  const { state, logout } = useSession();
  const planner = usePlanner();
  const [leaving, setLeaving] = useState(false);
  const user =
    state.status === 'signedIn' || state.status === 'expired'
      ? state.user
      : null;

  async function signOut() {
    setLeaving(true);
    try {
      await planner.completion.flush();
      await logout();
    } catch {
      // The session is gone locally either way; the gate shows the sign-in form.
    } finally {
      setLeaving(false);
    }
  }

  return (
    <Frame>
      <ScreenHeader title="Account" onBack={() => navigation.goBack()} />
      {user ? (
        <AccountView
          name={user.name}
          email={user.email}
          signingOut={leaving}
          onSignOut={signOut}
          developer={__DEV__ ? <DevTaskButton /> : undefined}
        />
      ) : null}
    </Frame>
  );
}
