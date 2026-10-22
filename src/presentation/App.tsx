import React, { useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { databaseFileName } from '@/infrastructure/db/databaseName';
import { initDatabase } from '@/infrastructure/db/initDatabase';

const palettes = {
  light: { background: '#FAFAF7', title: '#1F2933', subtitle: '#52606D' },
  dark: { background: '#14181C', title: '#F1F3F5', subtitle: '#AAB4BE' },
} as const;

function App() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = palettes[scheme];

  // Open and migrate the local database without blocking the first render.
  // The per-user file name arrives with auth (M3); until then a local one.
  useEffect(() => {
    initDatabase(databaseFileName('local'))
      .then(({ schemaVersion }) => {
        if (__DEV__) {
          console.log(`db ready (schema v${schemaVersion})`);
        }
      })
      .catch(error => console.error('db init failed', error));
  }, []);

  return (
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 32, fontWeight: '600' },
  subtitle: { fontSize: 16, lineHeight: 24, marginTop: 8 },
});

export default App;
