import React from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { ContainerSource } from '@/application/container';
import { ContainerProvider, useAcquiredContainer } from './containerContext';

const palettes = {
  light: { background: '#FAFAF7', title: '#1F2933', subtitle: '#52606D' },
  dark: { background: '#14181C', title: '#F1F3F5', subtitle: '#AAB4BE' },
} as const;

interface AppProps {
  /** Where the local database comes from; wired in the composition entry. */
  containers: ContainerSource;
}

function App({ containers }: AppProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = palettes[scheme];

  // The database opens in the background; the screen never waits for it.
  const container = useAcquiredContainer(containers);

  return (
    <ContainerProvider value={container}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <View style={styles.content}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.title }]}
            >
              Planner
            </Text>
            <Text style={[styles.subtitle, { color: colors.subtitle }]}>
              Your tasks, calm and offline.
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </ContainerProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 32, fontWeight: '600' },
  subtitle: { fontSize: 16, lineHeight: 24, marginTop: 8 },
});

export default App;
