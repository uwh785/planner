import React from 'react';
import { ScrollView, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

const makeStyles = (t: Theme) => ({
  root: { flex: 1, backgroundColor: t.colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center' as const,
    padding: t.spacing.lg,
    paddingVertical: t.spacing.xl,
  },
});

/** Page frame: safe area, theme background, scrolls when the font is large. */
export function Screen({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  const dark = useColorScheme() === 'dark';
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
