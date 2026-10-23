import React from 'react';
import { Text, View } from 'react-native';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

const makeStyles = (t: Theme) => ({
  wrap: { marginBottom: t.spacing.lg },
  heading: {
    ...t.typography.callout,
    color: t.colors.textMuted,
    marginBottom: t.spacing.xxs,
  },
});

/** A labeled block of a form (a heading, then its controls). */
export function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {children}
    </View>
  );
}
