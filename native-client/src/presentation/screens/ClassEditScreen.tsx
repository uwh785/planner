import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { DEFAULT_CLASS_COLOR } from '@/application/schedule/classColors';
import { weekdayOf } from '@/application/schedule/scheduleTime';
import {
  buildSubjectCatalog,
  inheritFromSubject,
  type KnownSubject,
} from '@/application/schedule/subjects';
import { Frame } from '../components/atoms/Screen';
import { MessageView } from '../components/molecules/MessageView';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import {
  ClassEditForm,
  type ClassFormValues,
} from '../components/organisms/ClassEditForm';
import { errorSentence } from '../errorMessages';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import { useI18n } from '../i18n/I18nProvider';
import type { ScreenProps } from '../navigation/routes';
import { pickTime } from '../pickers';
import { useLiveQuery, usePlanner } from '../plannerContext';

const DEFAULT_START = 8 * 60;
const DEFAULT_END = 9 * 60;

const sameValues = (a: ClassFormValues, b: ClassFormValues): boolean =>
  a.subject === b.subject &&
  a.dayOfWeek === b.dayOfWeek &&
  a.startMinute === b.startMinute &&
  a.endMinute === b.endMinute &&
  a.room === b.room &&
  a.teacher === b.teacher &&
  a.color === b.color;

/** The Date a time dialog opens on for a minute of the day. */
function dateAtMinute(minute: number): Date {
  const date = new Date();
  date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return date;
}

/**
 * Add a class (on the day it was opened from) or edit one. Typing a subject
 * that is already used lends its teacher and color unless the user already
 * chose them; editing an existing class counts as having chosen. Explicit
 * Save, confirmed Delete. Container.
 */
export function ClassEditScreen({
  navigation,
  route,
}: ScreenProps<'ClassEdit'>) {
  const { classId, day } = route.params;
  const editing = classId !== undefined;
  const planner = usePlanner();
  const { t } = useI18n();
  const schedule = useLiveQuery(p => p.queries.watchSchedule(), []);
  const [values, setValues] = useState<ClassFormValues | null>(null);
  const initial = useRef<ClassFormValues | null>(null);
  const edited = useRef({ teacher: editing, color: editing });
  const [inherited, setInherited] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const classes = schedule.status === 'loading' ? null : schedule.data?.classes;
  const subjects = useMemo(() => buildSubjectCatalog(classes ?? []), [classes]);

  // Seed the form once the classes are in (an edit needs its class).
  useEffect(() => {
    if (initial.current !== null || classes === null || classes === undefined) {
      return;
    }
    const existing = editing ? classes.find(c => c.id === classId) : undefined;
    if (editing && existing === undefined) {
      return;
    }
    const seed: ClassFormValues = existing
      ? {
          subject: existing.subject,
          dayOfWeek: existing.dayOfWeek,
          startMinute: existing.startMinute,
          endMinute: existing.endMinute,
          room: existing.room,
          teacher: existing.teacher,
          color: existing.color || DEFAULT_CLASS_COLOR,
        }
      : {
          subject: '',
          dayOfWeek: day ?? weekdayOf(planner.now()),
          startMinute: DEFAULT_START,
          endMinute: DEFAULT_END,
          room: '',
          teacher: '',
          color: DEFAULT_CLASS_COLOR,
        };
    initial.current = seed;
    setValues(seed);
  }, [classes, classId, day, editing, planner]);

  const dirty =
    values !== null &&
    initial.current !== null &&
    !sameValues(values, initial.current);
  const { leaveWith } = useDiscardGuard(dirty, 'class');
  const goBack = () => navigation.goBack();

  if (
    editing &&
    classes !== null &&
    classes !== undefined &&
    !classes.some(c => c.id === classId) &&
    !busy
  ) {
    return (
      <MessageView
        title={t('scheduleGoneTitle')}
        body={t('scheduleGoneBody')}
        action={{ label: t('back'), onPress: goBack }}
      />
    );
  }
  if (values === null) {
    return null;
  }

  const subjectError =
    submitted && values.subject.trim() === ''
      ? t('errorSubjectRequired')
      : null;
  const endError =
    submitted && values.endMinute <= values.startMinute
      ? t('scheduleEndAfterStart')
      : null;

  function change(patch: Partial<ClassFormValues>) {
    setError(null);
    let next = { ...values!, ...patch };
    if (patch.teacher !== undefined) {
      edited.current.teacher = true;
    }
    if (patch.color !== undefined) {
      edited.current.color = true;
    }
    if (patch.subject !== undefined) {
      const lent = inheritFromSubject(
        subjects,
        patch.subject,
        next,
        edited.current,
      );
      setInherited(lent?.inherited ?? false);
      if (lent) {
        next = { ...next, teacher: lent.teacher, color: lent.color };
      }
    } else if (patch.teacher !== undefined || patch.color !== undefined) {
      setInherited(false);
    }
    setValues(next);
  }

  function pickSubject(known: KnownSubject) {
    change({ subject: known.subject });
  }

  async function pick(which: 'startMinute' | 'endMinute') {
    const picked = await pickTime(dateAtMinute(values![which]));
    if (picked !== null) {
      change({ [which]: picked.getHours() * 60 + picked.getMinutes() });
    }
  }

  async function save() {
    setSubmitted(true);
    if (
      values!.subject.trim() === '' ||
      values!.endMinute <= values!.startMinute
    ) {
      return;
    }
    if (!dirty) {
      goBack();
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await planner.classes.update(classId, values!);
      } else {
        await planner.classes.create(values!);
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
    Alert.alert(t('scheduleDeleteConfirm'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await planner.classes.remove(classId);
            leaveWith(goBack);
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
      <ScreenHeader
        title={t(editing ? 'scheduleEditClass' : 'scheduleNewClass')}
        onBack={goBack}
      />
      <ClassEditForm
        values={values}
        subjects={subjects}
        inherited={inherited}
        subjectError={subjectError}
        endError={endError}
        error={error}
        busy={busy}
        editing={editing}
        onChange={change}
        onPickSubject={pickSubject}
        onPickStart={() => pick('startMinute')}
        onPickEnd={() => pick('endMinute')}
        onSave={save}
        onDelete={confirmDelete}
      />
    </Frame>
  );
}
