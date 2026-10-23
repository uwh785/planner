import React from 'react';
import { ScrollView, View } from 'react-native';
import type { MessageKey } from '@/application/i18n';
import type { Priority } from '@/domain';
import { Button } from '../atoms/Button';
import { ColorDot } from '../atoms/ColorDot';
import { Flag } from '../atoms/icons';
import { InlineMessage } from '../atoms/InlineMessage';
import { TextField } from '../atoms/TextField';
import { DueDateField } from '../molecules/DueDateField';
import { FormSection } from '../molecules/FormSection';
import { RadioGroup } from '../molecules/RadioGroup';
import { useT } from '../../i18n/I18nProvider';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

export interface TaskEditValues {
  title: string;
  description: string;
  priority: Priority;
  dueDate: number | null;
  dueAllDay: boolean;
  listId: string | null;
}

interface TaskEditFormProps {
  values: TaskEditValues;
  lists: readonly { id: string; name: string; color: string }[];
  /** The due moment in words, or null when there is none. */
  dueText: string | null;
  error: string | null;
  busy: boolean;
  onChange: (patch: Partial<TaskEditValues>) => void;
  onPickDate: () => void;
  onPickTime: () => void;
  onClearDate: () => void;
  onAllDayChange: (allDay: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
}

const makeStyles = (t: Theme) => ({
  content: { padding: t.spacing.lg, paddingBottom: t.spacing.xxl },
  notes: { minHeight: 96, textAlignVertical: 'top' as const },
  actions: { gap: t.spacing.sm, marginTop: t.spacing.xs },
});

const PRIORITIES: readonly { value: Priority; label: MessageKey }[] = [
  { value: 0, label: 'taskPriorityNone' },
  { value: 1, label: 'taskPriorityLow' },
  { value: 2, label: 'taskPriorityMedium' },
  { value: 3, label: 'taskPriorityHigh' },
];

/** The basic task form: explicit Save, a confirmed Delete. Props in, callbacks out. */
export function TaskEditForm({
  values,
  lists,
  dueText,
  error,
  busy,
  onChange,
  onPickDate,
  onPickTime,
  onClearDate,
  onAllDayChange,
  onSave,
  onDelete,
}: TaskEditFormProps) {
  const styles = useStyles(makeStyles);
  const t = useT();
  const { colors } = useTheme();
  const priorityColor = [
    colors.priority.none,
    colors.priority.low,
    colors.priority.medium,
    colors.priority.high,
  ];
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <InlineMessage kind="error" message={error} />
      <TextField
        label={t('taskTitle')}
        value={values.title}
        onChangeText={title => onChange({ title })}
        returnKeyType="next"
      />
      <TextField
        label={t('taskDescription')}
        value={values.description}
        onChangeText={description => onChange({ description })}
        multiline
        numberOfLines={4}
        autoCapitalize="sentences"
      />
      <FormSection title={t('taskPriority')}>
        <RadioGroup
          value={values.priority}
          onChange={priority => onChange({ priority })}
          options={PRIORITIES.map(({ value, label }) => ({
            value,
            label: t(label),
            leading:
              value === 0 ? undefined : (
                <Flag
                  size={16}
                  color={priorityColor[value]!}
                  strokeWidth={2.5}
                />
              ),
          }))}
        />
      </FormSection>
      <FormSection title={t('taskDueDate')}>
        <DueDateField
          text={dueText}
          allDay={values.dueAllDay}
          onPickDate={onPickDate}
          onPickTime={onPickTime}
          onClear={onClearDate}
          onAllDayChange={onAllDayChange}
        />
      </FormSection>
      <FormSection title={t('fieldList')}>
        <RadioGroup<string | null>
          value={values.listId}
          onChange={listId => onChange({ listId })}
          options={[
            { value: null, label: t('listNone') },
            ...lists.map(list => ({
              value: list.id,
              label: list.name,
              leading: <ColorDot color={list.color} />,
            })),
          ]}
        />
      </FormSection>
      <View style={styles.actions}>
        <Button
          label={t('save')}
          busyLabel={t('saving')}
          busy={busy}
          onPress={onSave}
        />
        <Button
          variant="destructive"
          label={t('taskDeleteAction')}
          disabled={busy}
          onPress={onDelete}
        />
      </View>
    </ScrollView>
  );
}
