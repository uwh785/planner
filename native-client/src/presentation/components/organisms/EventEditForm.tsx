import React from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { EVENT_COLORS } from '@/application/calendar/eventColors';
import { Button } from '../atoms/Button';
import { ColorDot } from '../atoms/ColorDot';
import { CalendarDays } from '../atoms/icons';
import { InlineMessage } from '../atoms/InlineMessage';
import { TextField } from '../atoms/TextField';
import { FilterChips } from '../molecules/FilterChips';
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
  /** Show on the home panel with a days-left countdown. */
  remind: boolean;
  /** "09:00". */
  startTime: string;
  /** "10:30", or empty for no end. */
  endTime: string;
  location: string;
  description: string;
  color: string;
}

/** The "in N days" date shortcuts, in days from today. */
export const SHORTCUT_DAYS = [30, 60, 90] as const;
export type ShortcutDays = (typeof SHORTCUT_DAYS)[number];

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
  /** The shortcut the form date matches today, if any. */
  shortcut: ShortcutDays | null;
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
  /** Sets the date to today plus the days and turns the reminder on. */
  onShortcut: (days: ShortcutDays) => void;
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
  // The chips bring the screen's side padding themselves, so the row scrolls
  // edge to edge and still starts on the form's margin.
  shortcuts: { marginHorizontal: -t.spacing.lg, marginBottom: t.spacing.xs },
});

/**
 * The web's event form: title, date with its "in N days" shortcuts, an
 * all-day switch, start and optional end (hidden for an all-day event), the
 * reminder switch, location, notes and the eight color swatches (each with
 * its name); Delete when editing.
 */
export function EventEditForm({
  values,
  dateText,
  shortcut,
  titleError,
  startError,
  endError,
  error,
  busy,
  editing,
  onChange,
  onPickDate,
  onShortcut,
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
  const shortcutOptions = SHORTCUT_DAYS.map(days => ({
    value: String(days),
    label: t('eventInDays', { count: days }),
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
      <View style={styles.shortcuts}>
        <FilterChips
          label={t('eventShortcuts')}
          options={shortcutOptions}
          value={shortcut === null ? '' : String(shortcut)}
          onChange={picked => {
            const days = SHORTCUT_DAYS.find(d => String(d) === picked);
            if (days !== undefined) {
              onShortcut(days);
            }
          }}
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
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t('eventRemind')}</Text>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={t('eventRemind')}
          value={values.remind}
          onValueChange={remind => onChange({ remind })}
          trackColor={{ false: colors.borderStrong, true: colors.primary }}
          thumbColor={colors.surface}
        />
      </View>
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
