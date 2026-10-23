import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { GroupedRow } from '../atoms/GroupedRow';
import { ChevronRight } from '../atoms/icons';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

interface NavRowProps {
  title: string;
  hint?: string;
  onPress: () => void;
}

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: t.minTouch,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    gap: t.spacing.sm,
  },
  pressed: { opacity: 0.8 },
  text: { flex: 1 },
  title: { ...t.typography.body, color: t.colors.text },
  hint: { ...t.typography.caption, color: t.colors.textMuted },
});

/** A row that opens another screen (a chevron says so; the title says what). */
export function NavRow({ title, hint, onPress }: NavRowProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <GroupedRow position="only">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hint ? `${title}, ${hint}` : title}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </Pressable>
    </GroupedRow>
  );
}
