import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../atoms/Button';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface EmptyStateProps {
  title: string;
  body: string;
  /** At most one, and only when the screen has no better way to act. */
  action?: { label: string; onPress: () => void };
}

const makeStyles = (t: Theme) => ({
  wrap: {
    alignItems: 'center' as const,
    paddingTop: t.spacing.xxl,
    paddingHorizontal: t.spacing.lg,
  },
  title: {
    ...t.typography.headline,
    color: t.colors.text,
    textAlign: 'center' as const,
  },
  body: {
    ...t.typography.body,
    color: t.colors.textMuted,
    textAlign: 'center' as const,
    marginTop: t.spacing.xs,
  },
  action: { marginTop: t.spacing.lg },
});

/** A headline, one muted line about what belongs here, at most one button. */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}
