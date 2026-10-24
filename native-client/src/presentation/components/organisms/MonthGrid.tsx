import React from 'react';
import { Text, View } from 'react-native';
import type { MessageKey } from '@/application/i18n';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import type { MonthCellModel } from '../../format/monthCellModel';
import { DayCell } from '../molecules/DayCell';

interface MonthGridProps {
  /** Weeks of seven, Sunday first; null is a blank before or after the month. */
  weeks: readonly (readonly (MonthCellModel | null)[])[];
  onSelectDay: (dayStart: number) => void;
}

const SUNDAY_FIRST = [0, 1, 2, 3, 4, 5, 6];

const makeStyles = (t: Theme) => ({
  grid: { gap: t.spacing.xxs },
  week: { flexDirection: 'row' as const, gap: t.spacing.xxs },
  blank: { flex: 1 },
  header: {
    flex: 1,
    paddingVertical: t.spacing.xs,
    textAlign: 'center' as const,
    ...t.typography.caption,
    fontWeight: '700' as const,
    color: t.colors.textMuted,
  },
});

/**
 * The web's month grid: a Sunday-first weekday row, then the weeks. The
 * weekday letters are spoken as the full day names.
 */
export function MonthGrid({ weeks, onSelectDay }: MonthGridProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.grid}>
      <View style={styles.week}>
        {SUNDAY_FIRST.map(dow => (
          <Text
            key={dow}
            accessibilityLabel={t(`scheduleDayName${dow}` as MessageKey)}
            style={styles.header}
          >
            {t(`scheduleDayShort${dow}` as MessageKey)}
          </Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((cell, i) =>
            cell === null ? (
              <View key={i} style={styles.blank} />
            ) : (
              <DayCell
                key={cell.dayStart}
                model={cell}
                onPress={() => onSelectDay(cell.dayStart)}
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
}
