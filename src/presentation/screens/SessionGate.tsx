import React from 'react';
import type { ContainerSource } from '@/application/container';
import { MessageView } from '../components/molecules/MessageView';
import { useSession } from '../sessionContext';
import { AuthScreen } from './AuthScreen';
import { SignedInHomeScreen } from './SignedInHomeScreen';

const EXPIRED_NOTICE =
  'Your session expired. Sign in again; your offline changes are kept.';

/** Chooses what to show from the session state; no navigation library yet. */
export function SessionGate({ containers }: { containers: ContainerSource }) {
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
      return <SignedInHomeScreen user={state.user} containers={containers} />;
    case 'expired':
      return (
        <AuthScreen notice={EXPIRED_NOTICE} initialEmail={state.user.email} />
      );
    case 'signedOut':
      return <AuthScreen />;
  }
}
