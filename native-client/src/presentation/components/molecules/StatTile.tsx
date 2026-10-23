import React from 'react';
import { Text, View } from 'react-native';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

export type StatTone = 'neutral' | 'accent' | 'success' | 'danger';

interface StatTileProps {
  label: string;
  count: number;
  tone?: StatTone;
}

const makeStyles = (t: Theme) => ({
  tile: {
    flexGrow: 1,
    flexBasis: '45%' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xxs,
    padding: t.spacing.md,
    borderRadius: t.radii.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  value: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  label: {
    ...t.typography.caption,
    color: t.colors.textMuted,
    textAlign: 'center' as const,
  },
  neutral: { color: t.colors.text },
  accent: { color: t.colors.accentText },
  success: { color: t.colors.success },
  danger: { color: t.colors.danger },
});

/**
 * One Panel counter: the number, big, and its label. The number's color only
 * reinforces the label (the web's blue, green and red, in AA-safe values);
 * the tile is read as one "label: count".
 */
export function StatTile({ label, count, tone = 'neutral' }: StatTileProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <View
      accessible
      accessibilityLabel={t('statTileLabel', { label, count })}
      style={styles.tile}
    >
      <Text style={[styles.value, styles[tone]]}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
