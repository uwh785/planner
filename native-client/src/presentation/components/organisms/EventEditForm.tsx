import React from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { EVENT_COLORS } from '@/application/calendar/eventColors';
import { Button } from '../atoms/Button';
import { ColorDot } from '../atoms/ColorDot';
import { CalendarDays } from '../atoms/icons';
import { InlineMessage } from '../atoms/InlineMessage';
import { TextField } from '../atoms/TextField';
import { FormSection } from '../molecules/FormSection';
import { RadioGroup } from '../molecules/RadioGroup';
import { TimeField } from '../molecules/TimeField';
import { useT } from '../../i18n/I18nProvider';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

export interface EventFormValues {
  title: string;
  /** Local midnight of the event's day. */
  date: number;
  allDay: boolean;
  /** "09:00". */
  startTime: string;
  /** "10:30", or empty for no end. */
  endTime: string;
  location: string;
  description: string;
  color: string;
}

/** The web's limits (backend model/event.go). */
export const EVENT_LIMITS = {
  title: 200,
  location: 200,
  description: 5000,
} as const;

interface EventEditFormProps {
  values: EventFormValues;
  /** "Oct 22, 2026". */
  dateText: string;
  titleError: string | null;
  /** The start-time or end-before-start sentence, under the times. */
  startError: string | null;
  endError: string | null;
  error: string | null;
  busy: boolean;
  /** Shows Delete. */
  editing: boolean;
  onChange: (patch: Partial<EventFormValues>) => void;
  onPickDate: () => void;
  onPickStart: () => void;
  onPickEnd: () => void;
  onSave: () => void;
  onDelete: () => void;
}

const makeStyles = (t: Theme) => ({
  content: { padding: t.spacing.lg, paddingBottom: t.spacing.xxl },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: t.minTouch,
    gap: t.spacing.sm,
    marginBottom: t.spacing.md,
  },
  rowLabel: { ...t.typography.body, color: t.colors.text, flexShrink: 1 },
  times: { flexDirection: 'row' as const, gap: t.spacing.sm },
  timesWrap: { marginBottom: t.spacing.xs },
  notes: { minHeight: 96, textAlignVertical: 'top' as const },
  actions: { gap: t.spacing.sm, marginTop: t.spacing.xs },
  clear: { alignItems: 'flex-start' as const, marginBottom: t.spacing.md },
});

/**
 * The web's event form: title, date, an all-day switch, start and optional
 * end (hidden for an all-day event), location, notes and the eight color
 * swatches (each with its name); Delete when editing.
 */
export function EventEditForm({
  values,
  dateText,
  titleError,
  startError,
  endError,
  error,
  busy,
  editing,
  onChange,
  onPickDate,
  onPickStart,
  onPickEnd,
  onSave,
  onDelete,
}: EventEditFormProps) {
  const styles = useStyles(makeStyles);
  const t = useT();
  const { colors } = useTheme();
  const known = EVENT_COLORS.some(
    c => c.value.toLowerCase() === values.color.toLowerCase(),
  );
  const colorOptions = EVENT_COLORS.map(c => ({
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
        label={t('eventTitle')}
        value={values.title}
        error={titleError}
        maxLength={EVENT_LIMITS.title}
        onChangeText={title => onChange({ title })}
        returnKeyType="next"
      />
      <View style={styles.timesWrap}>
        <TimeField
          label={t('eventDate')}
          time={dateText}
          icon={CalendarDays}
          onPress={onPickDate}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t('allDay')}</Text>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={t('allDay')}
          value={values.allDay}
          onValueChange={allDay => onChange({ allDay })}
          trackColor={{ false: colors.borderStrong, true: colors.primary }}
          thumbColor={colors.surface}
        />
      </View>
      {values.allDay ? null : (
        <View style={styles.timesWrap}>
          <View style={styles.times}>
            <TimeField
              label={t('eventStart')}
              time={values.startTime}
              error={startError}
              onPress={onPickStart}
            />
            <TimeField
              label={t('eventEnd')}
              time={values.endTime || '--:--'}
              error={endError}
              onPress={onPickEnd}
            />
          </View>
          {values.endTime !== '' ? (
            <View style={styles.clear}>
              <Button
                variant="link"
                label={t('eventEndClear')}
                onPress={() => onChange({ endTime: '' })}
              />
            </View>
          ) : null}
        </View>
      )}
      <TextField
        label={t('eventLocation')}
        value={values.location}
        maxLength={EVENT_LIMITS.location}
        onChangeText={location => onChange({ location })}
        returnKeyType="next"
      />
      <TextField
        label={t('eventNotes')}
        value={values.description}
        maxLength={EVENT_LIMITS.description}
        multiline
        onChangeText={description => onChange({ description })}
      />
      <FormSection title={t('eventColor')}>
        <RadioGroup<string>
          value={values.color.toLowerCase()}
          onChange={color => {
            const match = EVENT_COLORS.find(
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
            label={t('eventDelete')}
            disabled={busy}
            onPress={onDelete}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}
