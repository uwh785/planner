import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MessageKey } from '@/application/i18n';
import { mondayIndexToDow } from '@/application/schedule/scheduleTime';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface DayTabsProps {
  /** Spoken name of the whole group, e.g. "Day". */
  label: string;
  /** The selected weekday, 0 (Sunday) to 6. */
  value: number;
  onChange: (dayOfWeek: number) => void;
}

const WEEK = [0, 1, 2, 3, 4, 5, 6].map(mondayIndexToDow);

const makeStyles = (t: Theme) => ({
  row: { flexDirection: 'row' as const, gap: t.spacing.xxs },
  tab: {
    flex: 1,
    minHeight: t.minTouch,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: t.radii.control,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
  },
  // Selected is not color alone: a thicker accent edge, a surface fill and a
  // heavier letter.
  tabOn: {
    borderWidth: 2,
    borderColor: t.colors.accent,
    backgroundColor: t.colors.surface,
  },
  pressed: { opacity: 0.8 },
  letter: { ...t.typography.callout, color: t.colors.textMuted },
  letterOn: { color: t.colors.accentText, fontWeight: '700' as const },
});

/**
 * The seven weekdays as one row of single letters, Monday first (the web's
 * day tabs). Each tab is spoken as the full day name; the selected one is
 * announced as selected.
 */
export function DayTabs({ label, value, onChange }: DayTabsProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={styles.row}
    >
      {WEEK.map(dow => {
        const selected = dow === value;
        const name = t(`scheduleDayName${dow}` as MessageKey);
        return (
          <Pressable
            key={dow}
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ selected }}
            onPress={() => onChange(dow)}
            style={({ pressed }) => [
              styles.tab,
              selected ? styles.tabOn : null,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.letter, selected ? styles.letterOn : null]}>
              {t(`scheduleDayShort${dow}` as MessageKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
