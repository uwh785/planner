import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CLASS_COLORS } from '@/application/schedule/classColors';
import { minuteToTime } from '@/application/schedule/scheduleTime';
import {
  filterSubjects,
  normalizeSubject,
  type KnownSubject,
} from '@/application/schedule/subjects';
import { Button } from '../atoms/Button';
import { ColorDot } from '../atoms/ColorDot';
import { InlineMessage } from '../atoms/InlineMessage';
import { TextField } from '../atoms/TextField';
import { DayTabs } from '../molecules/DayTabs';
import { FormSection } from '../molecules/FormSection';
import { RadioGroup } from '../molecules/RadioGroup';
import { TimeField } from '../molecules/TimeField';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

export interface ClassFormValues {
  subject: string;
  /** 0 (Sunday) to 6. */
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  room: string;
  teacher: string;
  color: string;
}

interface ClassEditFormProps {
  values: ClassFormValues;
  /** The subjects already used, by folded key. */
  subjects: ReadonlyMap<string, KnownSubject>;
  /** Teacher and color were taken from a known subject. */
  inherited: boolean;
  subjectError: string | null;
  endError: string | null;
  error: string | null;
  busy: boolean;
  /** Shows Delete. */
  editing: boolean;
  onChange: (patch: Partial<ClassFormValues>) => void;
  onPickSubject: (known: KnownSubject) => void;
  onPickStart: () => void;
  onPickEnd: () => void;
  onSave: () => void;
  onDelete: () => void;
}

const makeStyles = (t: Theme) => ({
  content: { padding: t.spacing.lg, paddingBottom: t.spacing.xxl },
  times: { flexDirection: 'row' as const, gap: t.spacing.sm },
  timesWrap: { marginBottom: t.spacing.md },
  suggestions: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radii.card,
    backgroundColor: t.colors.surface,
    marginBottom: t.spacing.xs,
    overflow: 'hidden' as const,
  },
  suggestion: {
    minHeight: t.minTouch,
    justifyContent: 'center' as const,
    paddingHorizontal: t.spacing.md,
  },
  suggestionText: { ...t.typography.body, color: t.colors.text },
  pressed: { opacity: 0.8 },
  hint: {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginBottom: t.spacing.xs,
  },
  subjectActions: { alignItems: 'flex-start' as const },
  actions: { gap: t.spacing.sm, marginTop: t.spacing.xs },
});

/**
 * The web's class form: a subject that suggests the subjects already in use
 * (and lends their teacher and color), the weekday, start and end, room,
 * teacher and color; Delete when editing. Every swatch is shown with its name.
 */
export function ClassEditForm({
  values,
  subjects,
  inherited,
  subjectError,
  endError,
  error,
  busy,
  editing,
  onChange,
  onPickSubject,
  onPickStart,
  onPickEnd,
  onSave,
  onDelete,
}: ClassEditFormProps) {
  const styles = useStyles(makeStyles);
  const t = useT();
  const [focused, setFocused] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Typing narrows the list; "Show subjects" lists every one.
  const matches = showAll
    ? filterSubjects(subjects, '')
    : focused
    ? filterSubjects(subjects, values.subject)
    : [];
  const typed = normalizeSubject(values.subject);
  const suggestions = matches.filter(
    known => showAll || normalizeSubject(known.subject) !== typed,
  );

  const known = CLASS_COLORS.some(
    c => c.value.toLowerCase() === values.color.toLowerCase(),
  );
  const colorOptions = CLASS_COLORS.map(c => ({
    value: c.value.toLowerCase(),
    label: t(`color${c.key}`),
    leading: <ColorDot color={c.value} />,
  }));

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <InlineMessage kind="error" message={error} />
      <TextField
        label={t('scheduleSubject')}
        value={values.subject}
        error={subjectError}
        onChangeText={subject => onChange({ subject })}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="next"
      />
      {subjects.size > 0 ? (
        <View style={styles.subjectActions}>
          <Button
            variant="link"
            label={
              showAll
                ? t('scheduleSubjectHideAll')
                : t('scheduleSubjectShowAll')
            }
            onPress={() => setShowAll(current => !current)}
          />
        </View>
      ) : null}
      {suggestions.length > 0 ? (
        <View
          accessibilityLabel={t('scheduleSubjectSuggestions')}
          style={styles.suggestions}
        >
          {suggestions.map(option => (
            <Pressable
              key={option.subject}
              accessibilityRole="button"
              accessibilityLabel={option.subject}
              onPress={() => {
                onPickSubject(option);
                setShowAll(false);
              }}
              style={({ pressed }) => [
                styles.suggestion,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.suggestionText}>{option.subject}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {inherited ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {t('scheduleSubjectInherited')}
        </Text>
      ) : null}
      <FormSection title={t('scheduleDay')}>
        <DayTabs
          label={t('scheduleDay')}
          value={values.dayOfWeek}
          onChange={dayOfWeek => onChange({ dayOfWeek })}
        />
      </FormSection>
      <View style={styles.timesWrap}>
        <View style={styles.times}>
          <TimeField
            label={t('scheduleStart')}
            time={minuteToTime(values.startMinute)}
            onPress={onPickStart}
          />
          <TimeField
            label={t('scheduleEnd')}
            time={minuteToTime(values.endMinute)}
            error={endError}
            onPress={onPickEnd}
          />
        </View>
      </View>
      <TextField
        label={t('scheduleRoom')}
        value={values.room}
        onChangeText={room => onChange({ room })}
        returnKeyType="next"
      />
      <TextField
        label={t('scheduleTeacher')}
        value={values.teacher}
        onChangeText={teacher => onChange({ teacher })}
        returnKeyType="done"
      />
      <FormSection title={t('scheduleColor')}>
        <RadioGroup<string>
          value={values.color.toLowerCase()}
          onChange={color => {
            const match = CLASS_COLORS.find(
              c => c.value.toLowerCase() === color,
            );
            onChange({ color: match?.value ?? color });
          }}
          options={
            known
              ? colorOptions
              : [
                  {
                    value: values.color.toLowerCase(),
                    label: t('colorCustom'),
                    leading: <ColorDot color={values.color} />,
                  },
                  ...colorOptions,
                ]
          }
        />
      </FormSection>
      <View style={styles.actions}>
        <Button
          label={t('save')}
          busyLabel={t('saving')}
          busy={busy}
          onPress={onSave}
        />
        {editing ? (
          <Button
            variant="destructive"
            label={t('scheduleDeleteAction')}
            disabled={busy}
            onPress={onDelete}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}
