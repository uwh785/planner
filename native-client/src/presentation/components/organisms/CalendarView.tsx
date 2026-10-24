import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { InlineMessage } from '../atoms/InlineMessage';
import { IconButton } from '../atoms/IconButton';
import { ChevronLeft, ChevronRight } from '../atoms/icons';
import { Announcement } from '../molecules/Announcement';
import { EventCard } from '../molecules/EventCard';
import { MonthGrid } from './MonthGrid';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import type { MessageRef } from '@/application/i18n';
import type { EventCardModel } from '../../format/eventCardModel';
import type { MonthCellModel } from '../../format/monthCellModel';

interface CalendarViewProps {
  /** Rendered first inside the scroll (the screen header). */
  header: React.ReactNode;
  /** "Oct 2026". */
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  weeks: readonly (readonly (MonthCellModel | null)[])[];
  onSelectDay: (dayStart: number) => void;
  /** "Oct 22, 2026", the selected day written out. */
  dayLabel: string;
  /** The selected day's events, all-day first. */
  events: readonly EventCardModel[];
  /** A message when the month could not be read. */
  error?: string | null;
  notice?: { id: number; message: MessageRef } | null;
  onOpenEvent: (id: string) => void;
}

const makeStyles = (t: Theme) => ({
  content: { paddingBottom: t.spacing.xl },
  body: { paddingHorizontal: t.spacing.lg, gap: t.spacing.md },
  nav: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  month: { ...t.typography.headline, color: t.colors.text },
  section: { gap: t.spacing.sm },
  heading: { ...t.typography.headline, color: t.colors.text },
  day: { ...t.typography.callout, color: t.colors.textMuted },
  cards: { gap: t.spacing.sm },
  empty: { paddingVertical: t.spacing.md, alignItems: 'center' as const },
  emptyText: {
    ...t.typography.body,
    color: t.colors.textMuted,
    textAlign: 'center' as const,
  },
});

/**
 * The web's Calendar on a phone: previous and next month around the month
 * label, the grid, then the selected day's events as cards (or one line
 * when the day is free). The web opens the day's task list instead; here the
 * events show under the grid.
 */
export function CalendarView({
  header,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  weeks,
  onSelectDay,
  dayLabel,
  events,
  error = null,
  notice = null,
  onOpenEvent,
}: CalendarViewProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {header}
      <Announcement notice={notice} />
      <View style={styles.body}>
        <View style={styles.nav}>
          <IconButton
            label={t('calendarPrevMonth')}
            onPress={onPrevMonth}
            icon={ChevronLeft}
          />
          <Text accessibilityRole="header" style={styles.month}>
            {monthLabel}
          </Text>
          <IconButton
            label={t('calendarNextMonth')}
            onPress={onNextMonth}
            icon={ChevronRight}
          />
        </View>
        <InlineMessage kind="error" message={error} />
        <MonthGrid weeks={weeks} onSelectDay={onSelectDay} />
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {t('eventsDayTitle')}
          </Text>
          <Text style={styles.day}>{dayLabel}</Text>
          {events.length === 0 && error === null ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('eventsEmptyDay')}</Text>
            </View>
          ) : (
            <View style={styles.cards}>
              {events.map(model => (
                <EventCard
                  key={model.id}
                  model={model}
                  onPress={() => onOpenEvent(model.id)}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
