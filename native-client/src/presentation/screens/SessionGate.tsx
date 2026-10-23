import React from 'react';
import type { ContainerSource } from '@/application/container';
import type { PlannerRuntime } from '@/application/planner/createPlanner';
import { MessageView } from '../components/molecules/MessageView';
import { useT } from '../i18n/I18nProvider';
import { useSession } from '../sessionContext';
import { AuthScreen } from './AuthScreen';
import { SignedInNavigator } from '../navigation/SignedInNavigator';

/**
 * Chooses what to show from the session state: the auth screens, or the
 * navigator (tabs and edit screens) once signed in.
 */
export function SessionGate({
  containers,
  runtime,
}: {
  containers: ContainerSource;
  runtime: PlannerRuntime;
}) {
  const { state, retryRestore } = useSession();
  const t = useT();
  switch (state.status) {
    case 'restoring':
      return <MessageView title={t('loading')} />;
    case 'unreadable':
      return (
        <MessageView
          title={t('sessionUnreadableTitle')}
          body={t('sessionUnreadableBody')}
          action={{
            label: t('tryAgain'),
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
        <AuthScreen
          notice={t('sessionExpiredNotice')}
          initialEmail={state.user.email}
        />
      );
    case 'signedOut':
      return <AuthScreen />;
  }
}
