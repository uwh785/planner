import React from 'react';
import { Text, View } from 'react-native';
import { SubtaskAddField } from '../molecules/SubtaskAddField';
import { SubtaskRow } from '../molecules/SubtaskRow';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

export interface SubtaskModel {
  id: string;
  title: string;
  completed: boolean;
}

interface SubtaskSectionProps {
  subtasks: readonly SubtaskModel[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  /** Resolves to an error sentence to show, or null when it worked. */
  onAdd: (title: string) => Promise<string | null>;
}

const makeStyles = (t: Theme) => ({
  section: { gap: t.spacing.sm },
  heading: { ...t.typography.headline, color: t.colors.text },
  list: { gap: t.spacing.xs },
});

/** The web's Subtasks section: the heading, the rows and the add field. */
export function SubtaskSection({
  subtasks,
  onToggle,
  onDelete,
  onAdd,
}: SubtaskSectionProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('taskSubtasks')}
      </Text>
      {subtasks.length > 0 ? (
        <View style={styles.list}>
          {subtasks.map(subtask => (
            <SubtaskRow
              key={subtask.id}
              title={subtask.title}
              completed={subtask.completed}
              onToggle={() => onToggle(subtask.id, !subtask.completed)}
              onDelete={() => onDelete(subtask.id)}
            />
          ))}
        </View>
      ) : null}
      <SubtaskAddField onSubmit={onAdd} />
    </View>
  );
}
