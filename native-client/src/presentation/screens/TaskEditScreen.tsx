import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Frame } from '../components/atoms/Screen';
import { MessageView } from '../components/molecules/MessageView';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import {
  TaskEditForm,
  type TaskEditValues,
} from '../components/organisms/TaskEditForm';
import { errorSentence } from '../errorMessages';
import { dueDateTimeText } from '../format/dueText';
import { useI18n } from '../i18n/I18nProvider';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import type { ScreenProps } from '../navigation/routes';
import { pickDate, pickTime } from '../pickers';
import { useLiveQuery, usePlanner } from '../plannerContext';

const DEFAULT_HOUR = 9;
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const same = (a: TaskEditValues, b: TaskEditValues) =>
  a.title === b.title &&
  a.description === b.description &&
  a.priority === b.priority &&
  a.dueDate === b.dueDate &&
  a.dueAllDay === b.dueAllDay &&
  a.durationMs === b.durationMs &&
  a.listId === b.listId;

/** The basic edit screen. Explicit Save, confirmed Delete, a guard on Back. */
export function TaskEditScreen({ navigation, route }: ScreenProps<'TaskEdit'>) {
  const { taskId } = route.params;
  const planner = usePlanner();
  const i18n = useI18n();
  const { t } = i18n;
  const loaded = useLiveQuery(p => p.queries.watchTaskEdit(taskId), [taskId]);
  const [values, setValues] = useState<TaskEditValues | null>(null);
  const initial = useRef<TaskEditValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The form is seeded once; later changes from sync never overwrite typing.
  useEffect(() => {
    if (initial.current === null && loaded.status === 'ready' && loaded.data) {
      const { task } = loaded.data;
      const seed: TaskEditValues = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        dueAllDay: task.dueAllDay,
        durationMs: task.durationMs,
        listId: task.listId,
      };
      initial.current = seed;
      setValues(seed);
    }
  }, [loaded]);

  const dirty =
    values !== null &&
    initial.current !== null &&
    !same(values, initial.current);
  const { leaveWith } = useDiscardGuard(dirty, 'task');
  const goBack = () => navigation.goBack();
  // A deleted task leaves nothing behind it, the detail included.
  const leaveAll = () => navigation.popToTop();

  if (values === null || loaded.status !== 'ready') {
    if (loaded.status === 'ready' && loaded.data === null) {
      return (
        <MessageView
          title={t('taskGoneTitle')}
          body={t('taskGoneBody')}
          action={{ label: t('back'), onPress: leaveAll }}
        />
      );
    }
    return null;
  }
  if (loaded.data === null && initial.current !== null && !busy) {
    return (
      <MessageView
        title={t('taskGoneTitle')}
        body={t('taskGoneBody')}
        action={{ label: t('back'), onPress: leaveAll }}
      />
    );
  }

  const change = (patch: Partial<TaskEditValues>) => {
    setError(null);
    setValues(current => (current ? { ...current, ...patch } : current));
  };

  async function pickDay() {
    const now = planner.now();
    const current = values!.dueDate ?? now;
    const picked = await pickDate(new Date(current));
    if (picked === null) {
      return;
    }
    const day = startOfDay(picked);
    if (values!.dueDate === null || values!.dueAllDay) {
      change({
        dueDate: day,
        dueAllDay: values!.dueDate === null ? true : values!.dueAllDay,
      });
    } else {
      const old = new Date(values!.dueDate);
      change({
        dueDate: new Date(
          picked.getFullYear(),
          picked.getMonth(),
          picked.getDate(),
          old.getHours(),
          old.getMinutes(),
        ).getTime(),
      });
    }
  }

  async function pickClock() {
    const current = new Date(values!.dueDate ?? planner.now());
    const picked = await pickTime(current);
    if (picked === null || values!.dueDate === null) {
      return;
    }
    const day = new Date(values!.dueDate);
    change({
      dueDate: new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        picked.getHours(),
        picked.getMinutes(),
      ).getTime(),
    });
  }

  function setAllDay(allDay: boolean) {
    if (values!.dueDate === null) {
      return;
    }
    const day = new Date(values!.dueDate);
    change({
      dueAllDay: allDay,
      dueDate: allDay
        ? startOfDay(day)
        : new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            DEFAULT_HOUR,
          ).getTime(),
    });
  }

  async function save() {
    if (!dirty) {
      goBack();
      return;
    }
    setBusy(true);
    try {
      await planner.tasks.edit(taskId, { ...values! });
      leaveWith(goBack);
    } catch (problem) {
      setError(errorSentence(problem, t));
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert(t('taskDeleteConfirm'), t('taskDeleteHint'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await planner.tasks.remove(taskId);
            leaveWith(leaveAll);
          } catch (problem) {
            setError(errorSentence(problem, t));
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <Frame>
      <ScreenHeader title={t('taskEditTitle')} onBack={goBack} />
      <TaskEditForm
        values={values}
        lists={loaded.data?.lists ?? []}
        dueText={
          values.dueDate === null
            ? null
            : dueDateTimeText(
                values.dueDate,
                values.dueAllDay,
                planner.now(),
                i18n,
              )
        }
        error={error}
        busy={busy}
        onChange={change}
        onPickDate={pickDay}
        onPickTime={pickClock}
        onClearDate={() => change({ dueDate: null, dueAllDay: false })}
        onAllDayChange={setAllDay}
        onSave={save}
        onDelete={confirmDelete}
      />
    </Frame>
  );
}
