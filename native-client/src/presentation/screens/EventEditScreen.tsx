import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  eventTimesFromInputs,
  isEventEndValid,
} from '@/application/calendar/eventDays';
import { DEFAULT_EVENT_COLOR } from '@/application/calendar/eventColors';
import { dateInDays } from '@/application/calendar/reminders';
import {
  fromDateInputValue,
  startOfLocalDay,
  toDateInputValue,
  toTimeInputValue,
} from '@/application/calendar/localDate';
import { Frame } from '../components/atoms/Screen';
import { MessageView } from '../components/molecules/MessageView';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import {
  EventEditForm,
  SHORTCUT_DAYS,
  type EventFormValues,
  type ShortcutDays,
} from '../components/organisms/EventEditForm';
import { errorSentence } from '../errorMessages';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { useI18n } from '../i18n/I18nProvider';
import { dateText } from '../format/dates';
import type { ScreenProps } from '../navigation/routes';
import { pickDate, pickTime } from '../pickers';
import { useLiveQuery, usePlanner } from '../plannerContext';

const DEFAULT_START = '09:00';

const sameValues = (a: EventFormValues, b: EventFormValues): boolean =>
  a.title === b.title &&
  a.date === b.date &&
  a.allDay === b.allDay &&
  a.remind === b.remind &&
  a.startTime === b.startTime &&
  a.endTime === b.endTime &&
  a.location === b.location &&
  a.description === b.description &&
  a.color === b.color;

/** The Date a time dialog opens on for an "HH:MM" text. */
function dateAtTime(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Add an event (on the day it was opened from) or edit one. Like the web, a
 * timed event is one day: the date plus a start and an optional end time.
 * Explicit Save, confirmed Delete. Container.
 */
export function EventEditScreen({
  navigation,
  route,
}: ScreenProps<'EventEdit'>) {
  const { eventId, date } = route.params;
  const editing = eventId !== undefined;
  const planner = usePlanner();
  const i18n = useI18n();
  const { t } = i18n;
  const stored = useLiveQuery(p => p.queries.watchEvents(), []);
  const [values, setValues] = useState<EventFormValues | null>(null);
  const initial = useRef<EventFormValues | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const events = stored.status === 'loading' ? null : stored.data?.events;

  // Seed the form once the events are in (an edit needs its event).
  useEffect(() => {
    if (initial.current !== null || events === null || events === undefined) {
      return;
    }
    const existing = editing ? events.find(e => e.id === eventId) : undefined;
    if (editing && existing === undefined) {
      return;
    }
    const seed: EventFormValues = existing
      ? {
          title: existing.title,
          date: startOfLocalDay(existing.startAt),
          allDay: existing.allDay,
          remind: existing.remind,
          startTime: existing.allDay
            ? DEFAULT_START
            : toTimeInputValue(existing.startAt),
          endTime:
            existing.endAt !== null && !existing.allDay
              ? toTimeInputValue(existing.endAt)
              : '',
          location: existing.location,
          description: existing.description,
          color: existing.color || DEFAULT_EVENT_COLOR,
        }
      : {
          title: '',
          date: startOfLocalDay(date ?? planner.now()),
          allDay: false,
          remind: false,
          startTime: DEFAULT_START,
          endTime: '',
          location: '',
          description: '',
          color: DEFAULT_EVENT_COLOR,
        };
    initial.current = seed;
    setValues(seed);
  }, [events, eventId, date, editing, planner]);

  const dirty =
    values !== null &&
    initial.current !== null &&
    !sameValues(values, initial.current);
  const { leaveWith } = useDiscardGuard(dirty, 'event');
  const goBack = () => navigation.goBack();

  if (
    editing &&
    events !== null &&
    events !== undefined &&
    !events.some(e => e.id === eventId) &&
    !busy
  ) {
    return (
      <MessageView
        title={t('eventNotFound')}
        action={{ label: t('back'), onPress: goBack }}
      />
    );
  }
  if (values === null) {
    return null;
  }

  const times = eventTimesFromInputs(
    toDateInputValue(values.date),
    values.allDay,
    values.startTime,
    values.endTime,
  );
  // A multi-day event shows only its end time, as on the web; leave its
  // dates alone (and unchecked) unless the user changed them, so saving a
  // note keeps them.
  const timesUntouched =
    editing &&
    initial.current !== null &&
    values.date === initial.current.date &&
    values.allDay === initial.current.allDay &&
    values.startTime === initial.current.startTime &&
    values.endTime === initial.current.endTime;
  const titleError =
    submitted && values.title.trim() === '' ? t('errorTitleRequired') : null;
  const startError =
    submitted && times === null ? t('eventStartRequired') : null;
  const endError =
    submitted && !timesUntouched && !isEventEndValid(times)
      ? t('eventEndAfterStart')
      : null;

  function change(patch: Partial<EventFormValues>) {
    setError(null);
    setValues({ ...values!, ...patch });
  }

  async function pickDay() {
    const picked = await pickDate(new Date(values!.date));
    if (picked !== null) {
      change({ date: startOfLocalDay(picked.getTime()) });
    }
  }

  // A shortcut counts from today, whatever day the form is on. The new date
  // differs from the seed, so it also makes the form dirty and the times
  // touched.
  function applyShortcut(days: ShortcutDays) {
    const picked = fromDateInputValue(dateInDays(planner.now(), days));
    if (picked !== null) {
      change({ date: picked, remind: true });
    }
  }

  async function pickClock(which: 'startTime' | 'endTime') {
    const picked = await pickTime(
      dateAtTime(values![which] || values!.startTime),
    );
    if (picked !== null) {
      change({
        [which]: `${pad(picked.getHours())}:${pad(picked.getMinutes())}`,
      });
    }
  }

  async function save() {
    setSubmitted(true);
    if (
      values!.title.trim() === '' ||
      times === null ||
      (!timesUntouched && !isEventEndValid(times))
    ) {
      return;
    }
    if (!dirty) {
      goBack();
      return;
    }
    const fields = {
      title: values!.title,
      description: values!.description,
      location: values!.location,
      allDay: values!.allDay,
      remind: values!.remind,
      color: values!.color,
    };
    setBusy(true);
    try {
      if (editing) {
        await planner.events.update(
          eventId,
          timesUntouched ? fields : { ...fields, ...times },
        );
      } else {
        await planner.events.create({ ...fields, ...times });
      }
      leaveWith(goBack);
    } catch (problem) {
      setError(errorSentence(problem, t));
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!editing) {
      return;
    }
    Alert.alert(t('eventDeleteConfirm'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await planner.events.remove(eventId);
            leaveWith(goBack);
          } catch (problem) {
            setError(errorSentence(problem, t));
            setBusy(false);
          }
        },
      },
    ]);
  }

  const today = planner.now();
  const formDate = toDateInputValue(values.date);
  const shortcut =
    SHORTCUT_DAYS.find(days => dateInDays(today, days) === formDate) ?? null;

  return (
    <Frame>
      <ScreenHeader
        title={t(editing ? 'eventEdit' : 'eventNew')}
        onBack={goBack}
      />
      <EventEditForm
        values={values}
        dateText={dateText(values.date, today, i18n.locale)}
        shortcut={shortcut}
        titleError={titleError}
        startError={startError}
        endError={endError}
        error={error}
        busy={busy}
        editing={editing}
        onChange={change}
        onPickDate={pickDay}
        onShortcut={applyShortcut}
        onPickStart={() => pickClock('startTime')}
        onPickEnd={() => pickClock('endTime')}
        onSave={save}
        onDelete={confirmDelete}
      />
    </Frame>
  );
}
