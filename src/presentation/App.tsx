import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { SessionService } from '@/application/auth/SessionService';
import type { ContainerSource } from '@/application/container';
import type { SyncStatusSource } from '@/application/sync/SyncStatus';
import { SessionGate } from './screens/SessionGate';
import { SessionProvider } from './sessionContext';
import { SyncProvider } from './syncContext';

interface AppProps {
  /** The session use cases and state; wired in the composition entry. */
  session: SessionService;
  /** Where the signed-in user's local database comes from. */
  containers: ContainerSource;
  /** What the sync status line reads; omit to show no line. */
  sync?: SyncStatusSource;
}

function App({ session, containers, sync }: AppProps) {
  return (
    <SessionProvider session={session}>
      <SyncProvider source={sync}>
        <SafeAreaProvider>
          <SessionGate containers={containers} />
        </SafeAreaProvider>
      </SyncProvider>
    </SessionProvider>
  );
}

export default App;
