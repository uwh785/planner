import React from 'react';
import { Switch, Text, View } from 'react-native';
import { Button } from '../atoms/Button';
import { GroupedRow } from '../atoms/GroupedRow';
import { useT } from '../../i18n/I18nProvider';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

interface DueDateFieldProps {
  /** What the date reads as ("Dec 3", "Dec 3, 14:30"), or null for none. */
  text: string | null;
  allDay: boolean;
  onPickDate: () => void;
  onClear: () => void;
  onAllDayChange: (allDay: boolean) => void;
  onPickTime: () => void;
}

const makeStyles = (t: Theme) => ({
  value: {
    ...t.typography.body,
    color: t.colors.text,
    paddingHorizontal: t.spacing.md,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.xxs,
  },
  empty: { color: t.colors.textMuted },
  actions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    paddingHorizontal: t.spacing.xs,
  },
  switchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: t.minTouch,
    paddingHorizontal: t.spacing.md,
    gap: t.spacing.sm,
  },
  switchLabel: { ...t.typography.body, color: t.colors.text, flexShrink: 1 },
});

/**
 * Due date and optional time: the current value in words, buttons that open
 * the system pickers, a clear action, and an "All day" switch once a date is
 * set. Everything is a labeled control; nothing relies on color.
 */
export function DueDateField({
  text,
  allDay,
  onPickDate,
  onClear,
  onAllDayChange,
  onPickTime,
}: DueDateFieldProps) {
  const styles = useStyles(makeStyles);
  const t = useT();
  const { colors } = useTheme();
  return (
    <GroupedRow position="only">
      <Text style={[styles.value, text === null ? styles.empty : null]}>
        {text ?? t('dueNone')}
      </Text>
      <View style={styles.actions}>
        <Button
          variant="link"
          label={text === null ? t('dateSet') : t('dateChange')}
          onPress={onPickDate}
        />
        {text !== null ? (
          <Button variant="link" label={t('dateClear')} onPress={onClear} />
        ) : null}
        {text !== null && !allDay ? (
          <Button variant="link" label={t('timeSet')} onPress={onPickTime} />
        ) : null}
      </View>
      {text !== null ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('allDay')}</Text>
          <Switch
            accessibilityRole="switch"
            accessibilityLabel={t('allDay')}
            value={allDay}
            onValueChange={onAllDayChange}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>
      ) : null}
    </GroupedRow>
  );
}
