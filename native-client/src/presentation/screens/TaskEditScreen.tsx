import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Frame } from '../components/atoms/Screen';
import { MessageView } from '../components/molecules/MessageView';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import {
  TaskEditForm,
  type TaskEditValues,
} from '../components/organisms/TaskEditForm';
import { dueDateTimeText } from '../format/dueText';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import type { ScreenProps } from '../navigation/routes';
import { pickDate, pickTime } from '../pickers';
import { errorSentence, useLiveQuery, usePlanner } from '../plannerContext';

const DEFAULT_HOUR = 9;
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const same = (a: TaskEditValues, b: TaskEditValues) =>
  a.title === b.title &&
  a.description === b.description &&
  a.priority === b.priority &&
  a.dueDate === b.dueDate &&
  a.dueAllDay === b.dueAllDay &&
  a.listId === b.listId;

/** The basic edit screen. Explicit Save, confirmed Delete, a guard on Back. */
export function TaskEditScreen({ navigation, route }: ScreenProps<'TaskEdit'>) {
  const { taskId } = route.params;
  const planner = usePlanner();
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
  const { allowLeaving } = useDiscardGuard(dirty, 'task');
  const goBack = () => navigation.goBack();

  if (values === null || loaded.status !== 'ready') {
    if (loaded.status === 'ready' && loaded.data === null) {
      return (
        <MessageView
          title="This task no longer exists"
          body="It was deleted. Nothing is left to edit."
          action={{ label: 'Back', onPress: goBack }}
        />
      );
    }
    return null;
  }
  if (loaded.data === null && initial.current !== null && !busy) {
    return (
      <MessageView
        title="This task no longer exists"
        body="It was deleted. Nothing is left to edit."
        action={{ label: 'Back', onPress: goBack }}
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
      allowLeaving();
      goBack();
    } catch (problem) {
      setError(errorSentence(problem));
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete this task?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await planner.tasks.remove(taskId);
            allowLeaving();
            goBack();
          } catch (problem) {
            setError(errorSentence(problem));
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <Frame>
      <ScreenHeader title="Edit task" onBack={goBack} />
      <TaskEditForm
        values={values}
        lists={loaded.data?.lists ?? []}
        dueText={
          values.dueDate === null
            ? null
            : dueDateTimeText(values.dueDate, values.dueAllDay, planner.now())
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
