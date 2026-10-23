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
  top: { justifyContent: 'flex-start' as const, paddingVertical: t.spacing.md },
});

/**
 * Page frame: safe area and theme background. Children fill it as they like
 * (a list needs the whole height); see `Screen` for the scrolling version.
 */
export function Frame({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  const dark = useColorScheme() === 'dark';
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      {children}
    </SafeAreaView>
  );
}

/**
 * Page frame that scrolls when the font is large. `align="center"` (the
 * default) suits short forms and messages; `align="top"` suits long ones.
 */
export function Screen({
  children,
  align = 'center',
}: {
  children: React.ReactNode;
  align?: 'center' | 'top';
}) {
  const styles = useStyles(makeStyles);
  return (
    <Frame>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          align === 'top' ? styles.top : null,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Frame>
  );
}
