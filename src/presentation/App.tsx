import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { SessionService } from '@/application/auth/SessionService';
import type { ContainerSource } from '@/application/container';
import { SessionGate } from './screens/SessionGate';
import { SessionProvider } from './sessionContext';

interface AppProps {
  /** The session use cases and state; wired in the composition entry. */
  session: SessionService;
  /** Where the signed-in user's local database comes from. */
  containers: ContainerSource;
}

function App({ session, containers }: AppProps) {
  return (
    <SessionProvider session={session}>
      <SafeAreaProvider>
        <SessionGate containers={containers} />
      </SafeAreaProvider>
    </SessionProvider>
  );
}

export default App;
