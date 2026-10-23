import React, { useEffect, useState } from 'react';
import type { MessageKey } from '@/application/i18n';
import type { ContainerSource } from '@/application/container';
import type { PlannerRuntime } from '@/application/planner/createPlanner';
import { MessageView } from '../components/molecules/MessageView';
import { useT } from '../i18n/I18nProvider';
import { useSession } from '../sessionContext';
import { SignOutNoticeContext } from '../signOutNotice';
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
  const [leftover, setLeftover] = useState<MessageKey | null>(null);
  // The sentence belongs to one sign-out: a new sign-in clears it.
  useEffect(() => {
    if (state.status === 'signedIn') {
      setLeftover(null);
    }
  }, [state.status]);
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
      return (
        <SignOutNoticeContext.Provider value={setLeftover}>
          <SignedInNavigator containers={containers} runtime={runtime} />
        </SignOutNoticeContext.Provider>
      );
    case 'expired':
      return (
        <AuthScreen
          notice={t('sessionExpiredNotice')}
          initialEmail={state.user.email}
        />
      );
    case 'signedOut':
      return <AuthScreen notice={leftover === null ? null : t(leftover)} />;
  }
}
