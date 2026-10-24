import React, { useMemo, useState } from 'react';
import { Frame } from '../components/atoms/Screen';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import { ScheduleView } from '../components/organisms/ScheduleView';
import { classCardModel } from '../format/classCardModel';
import { useI18n } from '../i18n/I18nProvider';
import type { TabScreenProps } from '../navigation/routes';
import { useLiveQuery, useNotice, usePlanner } from '../plannerContext';
import { weekdayOf } from '@/application/schedule/scheduleTime';

/** Schedule: the week's classes one day at a time. Container. */
export function ScheduleScreen({ navigation }: TabScreenProps<'Schedule'>) {
  const { t } = useI18n();
  const planner = usePlanner();
  const schedule = useLiveQuery(p => p.queries.watchSchedule(), []);
  const notice = useNotice();
  // Opens on today; the choice is the screen's own and resets with it.
  const [day, setDay] = useState(() => weekdayOf(planner.now()));
  const classes = schedule.status === 'loading' ? null : schedule.data;
  const cards = useMemo(
    () =>
      (classes?.classes ?? [])
        .filter(c => c.dayOfWeek === day)
        .sort((a, b) => a.startMinute - b.startMinute)
        .map(classCardModel),
    [classes, day],
  );

  return (
    <Frame>
      <ScheduleView
        header={
          <ScreenHeader
            title={t('scheduleTitle')}
            actions={[
              {
                label: t('scheduleAddClass'),
                onPress: () => navigation.navigate('ClassEdit', { day }),
              },
            ]}
          />
        }
        day={day}
        onChangeDay={setDay}
        classes={cards}
        error={
          schedule.status === 'error' && !classes
            ? t('scheduleLoadError')
            : null
        }
        notice={notice}
        onOpenClass={classId => navigation.navigate('ClassEdit', { classId })}
      />
    </Frame>
  );
}
