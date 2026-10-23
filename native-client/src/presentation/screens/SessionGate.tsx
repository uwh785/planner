import React from 'react';
import type { ContainerSource } from '@/application/container';
import type { PlannerRuntime } from '@/application/planner/createPlanner';
import { MessageView } from '../components/molecules/MessageView';
import { useSession } from '../sessionContext';
import { AuthScreen } from './AuthScreen';
import { SignedInNavigator } from '../navigation/SignedInNavigator';

const EXPIRED_NOTICE =
  'Your session expired. Sign in again; your offline changes are kept.';

/**
 * Chooses what to show from the session state: the auth screens, or the
 * navigator (lists, tasks, account) once signed in.
 */
export function SessionGate({
  containers,
  runtime,
}: {
  containers: ContainerSource;
  runtime: PlannerRuntime;
}) {
  const { state, retryRestore } = useSession();
  switch (state.status) {
    case 'restoring':
      return <MessageView title="Loading" />;
    case 'unreadable':
      return (
        <MessageView
          title="Can't read your saved session"
          body="Your sign-in is stored securely on this device, and it could not be read. Your data is safe."
          action={{
            label: 'Try again',
            onPress: () => {
              retryRestore();
            },
          }}
        />
      );
    case 'signedIn':
      return <SignedInNavigator containers={containers} runtime={runtime} />;
    case 'expired':
      return (
        <AuthScreen notice={EXPIRED_NOTICE} initialEmail={state.user.email} />
      );
    case 'signedOut':
      return <AuthScreen />;
  }
}
