import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { IconButton } from '../atoms/IconButton';
import { Square, SquareCheck, X } from '../atoms/icons';
import { useT } from '../../i18n/I18nProvider';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

interface SubtaskRowProps {
  title: string;
  completed: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
    paddingLeft: t.spacing.xs,
    paddingRight: t.spacing.xs,
    borderRadius: t.radii.control,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  check: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.sm,
    minHeight: t.minTouch,
    paddingVertical: t.spacing.xs,
  },
  pressed: { opacity: 0.8 },
  title: { ...t.typography.body, color: t.colors.text, flex: 1 },
  done: {
    color: t.colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
});

/**
 * One subtask: a checkbox with its title (checked state and strike-through,
 * never color alone) and a delete button. The title wraps; both targets are
 * 48dp. The delete button is named after the subtask.
 */
export function SubtaskRow({
  title,
  completed,
  onToggle,
  onDelete,
}: SubtaskRowProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const Box = completed ? SquareCheck : Square;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={title}
        accessibilityState={{ checked: completed }}
        onPress={onToggle}
        style={({ pressed }) => [styles.check, pressed && styles.pressed]}
      >
        <Box
          size={22}
          strokeWidth={2.25}
          color={completed ? colors.accentText : colors.text}
        />
        <Text style={[styles.title, completed ? styles.done : null]}>
          {title}
        </Text>
      </Pressable>
      <IconButton
        icon={X}
        label={t('subtaskDelete', { title })}
        onPress={onDelete}
      />
    </View>
  );
}
