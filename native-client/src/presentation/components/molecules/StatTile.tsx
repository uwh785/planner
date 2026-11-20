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
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.xxs,
    borderRadius: t.radii.control,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  value: { fontSize: 20, lineHeight: 24, fontWeight: '700' as const },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400' as const,
    color: t.colors.textMuted,
    textAlign: 'center' as const,
  },
  neutral: { color: t.colors.text },
  accent: { color: t.colors.accentText },
  success: { color: t.colors.success },
  danger: { color: t.colors.danger },
});

/**
 * One Panel counter: the number and its label, compact so the four sit in
 * one row and leave the screen to what matters. The number's color only
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
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}
