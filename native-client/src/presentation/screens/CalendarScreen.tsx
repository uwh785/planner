import React, { useMemo, useState } from 'react';
import { Frame } from '../components/atoms/Screen';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import { CalendarView } from '../components/organisms/CalendarView';
import { eventsOnDay } from '@/application/calendar/eventDays';
import { startOfLocalDay } from '@/application/calendar/localDate';
import { buildMonthGrid, shiftMonth } from '@/application/calendar/monthGrid';
import { eventCardModel, monthNames } from '../format/eventCardModel';
import { monthCellModel } from '../format/monthCellModel';
import { useI18n } from '../i18n/I18nProvider';
import type { TabScreenProps } from '../navigation/routes';
import { useLiveQuery, useNotice, usePlanner } from '../plannerContext';

/** Calendar: one month at a time, and the selected day's events. Container. */
export function CalendarScreen({ navigation }: TabScreenProps<'Calendar'>) {
  const { t } = useI18n();
  const planner = usePlanner();
  const notice = useNotice();
  // Opens on this month with today selected; both choices are the screen's.
  const [visible, setVisible] = useState(() => {
    const now = new Date(planner.now());
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [picked, setPicked] = useState<number | null>(null);
  const { year, month } = visible;
  const live = useLiveQuery(
    p => p.queries.watchCalendarMonth(year, month),
    [year, month],
  );
  const data = live.status === 'loading' ? null : live.data;

  const todayStart = startOfLocalDay(planner.now());
  const firstOfMonth = new Date(year, month, 1).getTime();
  const todayVisible =
    new Date(todayStart).getFullYear() === year &&
    new Date(todayStart).getMonth() === month;
  // A tap picks a day; otherwise today, or the 1st of another month.
  const inMonth = (ms: number) =>
    new Date(ms).getFullYear() === year && new Date(ms).getMonth() === month;
  const selected =
    picked !== null && inMonth(picked)
      ? picked
      : todayVisible
      ? todayStart
      : firstOfMonth;

  const weeks = useMemo(
    () =>
      buildMonthGrid(year, month, data?.events ?? [], data?.tasks ?? []).map(
        week =>
          week.map(cell =>
            cell === null
              ? null
              : monthCellModel(cell, year, month, todayStart, selected, t),
          ),
      ),
    [data, year, month, todayStart, selected, t],
  );
  const cards = useMemo(
    () =>
      eventsOnDay(data?.events ?? [], selected).map(event =>
        eventCardModel(event, t),
      ),
    [data, selected, t],
  );
  const names = monthNames(t);
  const selectedDate = new Date(selected);

  function move(delta: number) {
    setVisible(shiftMonth(year, month, delta));
    setPicked(null);
  }

  return (
    <Frame>
      <CalendarView
        header={
          <ScreenHeader
            title={t('navCalendar')}
            actions={[
              {
                label: t('eventNew'),
                onPress: () =>
                  navigation.navigate('EventEdit', { date: selected }),
              },
            ]}
          />
        }
        monthLabel={`${names[month]} ${year}`}
        onPrevMonth={() => move(-1)}
        onNextMonth={() => move(1)}
        weeks={weeks}
        onSelectDay={setPicked}
        dayLabel={t('calendarDayLabel', {
          day: selectedDate.getDate(),
          month: names[month] ?? '',
          year,
        })}
        events={cards}
        error={live.status === 'error' && !data ? t('calendarLoadError') : null}
        notice={notice}
        onOpenEvent={eventId => navigation.navigate('EventEdit', { eventId })}
      />
    </Frame>
  );
}
