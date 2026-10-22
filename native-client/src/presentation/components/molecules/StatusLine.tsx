import React from 'react';
import { Text } from 'react-native';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

const makeStyles = (t: Theme) => ({
  text: {
    fontSize: t.type.small,
    lineHeight: 20,
    color: t.colors.textMuted,
    marginTop: t.spacing.md,
  },
});

/**
 * One quiet line of status text. A polite live region, so a screen reader
 * mentions a change without interrupting; it scales with the system font.
 */
export function StatusLine({ text }: { text: string }) {
  const styles = useStyles(makeStyles);
  return (
    <Text accessibilityLiveRegion="polite" style={styles.text}>
      {text}
    </Text>
  );
}
