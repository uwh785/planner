import React, { useState } from 'react';
import { Frame } from '../components/atoms/Screen';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import { ConfigView } from '../components/organisms/ConfigView';
import { useI18n } from '../i18n/I18nProvider';
import type { TabScreenProps } from '../navigation/routes';
import { usePlanner } from '../plannerContext';
import { useSession } from '../sessionContext';
import { DevTaskButton } from './DevTaskButton';
import { SyncStatusLine } from './SyncStatusLine';

/**
 * Settings: language, lists, who is signed in and Sign out, the sync line and
 * the development-only controls. Signing out first completes any task still
 * in its undo window, so nothing is lost.
 */
export function ConfigScreen({ navigation }: TabScreenProps<'Config'>) {
  const { t } = useI18n();
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
      <ConfigView
        header={<ScreenHeader title={t('configTitle')} />}
        name={user?.name ?? ''}
        email={user?.email ?? ''}
        signingOut={leaving}
        onOpenLists={() => navigation.navigate('Lists')}
        onSignOut={signOut}
        sync={<SyncStatusLine />}
        developer={__DEV__ ? <DevTaskButton /> : undefined}
      />
    </Frame>
  );
}
