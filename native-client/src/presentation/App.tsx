import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InMemoryLocaleStore, LocaleService } from '@/application/i18n';
import type { SessionService } from '@/application/auth/SessionService';
import type { ContainerSource } from '@/application/container';
import type { PlanSource } from '@/application/plan/PlanService';
import type { PlannerRuntime } from '@/application/planner/createPlanner';
import type { SyncStatusSource } from '@/application/sync/SyncStatus';
import { I18nProvider } from './i18n/I18nProvider';
import { SessionGate } from './screens/SessionGate';
import { SessionProvider } from './sessionContext';
import { PlanProvider } from './planContext';
import { SyncProvider } from './syncContext';

interface AppProps {
  /** The session use cases and state; wired in the composition entry. */
  session: SessionService;
  /** Where the signed-in user's local database comes from. */
  containers: ContainerSource;
  /** What the sync status line reads; omit to show no line. */
  sync?: SyncStatusSource;
  /** The plan shown in Settings; omit to show none. */
  plan?: PlanSource;
  /** Clock, timer and app lifecycle for the screens; plain globals if omitted. */
  runtime?: PlannerRuntime;
  /** The chosen language; Spanish and not saved anywhere if omitted. */
  locale?: LocaleService;
}

const DEFAULT_RUNTIME: PlannerRuntime = {
  clock: { now: () => Date.now() },
  timer: {
    schedule: (fn, delayMs) => {
      const handle = setTimeout(fn, delayMs);
      return () => clearTimeout(handle);
    },
  },
};

function App({
  session,
  containers,
  sync,
  plan,
  runtime = DEFAULT_RUNTIME,
  locale,
}: AppProps) {
  const language = useMemo(() => {
    if (locale) {
      return locale;
    }
    const fallback = new LocaleService(new InMemoryLocaleStore());
    fallback.restore();
    return fallback;
  }, [locale]);
  return (
    <I18nProvider service={language}>
      <SessionProvider session={session}>
        <SyncProvider source={sync}>
          <PlanProvider source={plan}>
            <SafeAreaProvider>
              <SessionGate containers={containers} runtime={runtime} />
            </SafeAreaProvider>
          </PlanProvider>
        </SyncProvider>
      </SessionProvider>
    </I18nProvider>
  );
}

export default App;
