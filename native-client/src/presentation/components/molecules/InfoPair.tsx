import React from 'react';
import { Text, View } from 'react-native';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface InfoPairProps {
  label: string;
  /** Already translated: never a raw value like `in_progress`. */
  value: string;
  /** A marker before the value (status dot, flag). Decorative. */
  leading?: React.ReactNode;
}

const makeStyles = (t: Theme) => ({
  pair: { flexGrow: 1, flexBasis: 140, gap: t.spacing.xxs },
  label: { ...t.typography.caption, color: t.colors.textMuted },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
  },
  value: {
    ...t.typography.callout,
    color: t.colors.text,
    fontWeight: '600' as const,
    flexShrink: 1,
  },
});

/**
 * The web's meta item: a small muted label over its value ("Priority" over
 * "High", "Status" over "In progress"). One spoken unit, "Status: In
 * progress"; the marker is decorative and the value is always a word.
 */
export function InfoPair({ label, value, leading }: InfoPairProps) {
  const styles = useStyles(makeStyles);
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={styles.pair}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {leading ? (
          <View importantForAccessibility="no-hide-descendants">{leading}</View>
        ) : null}
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}
