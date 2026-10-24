import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ColorDot } from '../atoms/ColorDot';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';
import type { ClassCardModel } from '../../format/classCardModel';

const makeStyles = (t: Theme) => ({
  card: {
    padding: t.spacing.md,
    borderRadius: t.radii.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    gap: t.spacing.xxs,
  },
  subjectRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
  },
  subject: {
    ...t.typography.body,
    fontWeight: '600' as const,
    color: t.colors.text,
    flex: 1,
  },
  time: { ...t.typography.callout, color: t.colors.textMuted },
  place: {
    ...t.typography.callout,
    fontWeight: '400' as const,
    color: t.colors.textMuted,
  },
  pressed: { opacity: 0.8 },
});

/**
 * The web's class card: subject, time range, "room, teacher". The class color
 * is a dot beside the subject (not a side stripe, see DESIGN.md); the card
 * opens the class for editing.
 */
export function ClassCard({
  model,
  onPress,
}: {
  model: ClassCardModel;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const spoken = [model.subject, model.time, model.place]
    .filter(part => part !== '')
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.subjectRow}>
        <ColorDot color={model.color || colors.accent} />
        <Text style={styles.subject}>{model.subject}</Text>
      </View>
      <Text style={styles.time}>{model.time}</Text>
      {model.place !== '' ? (
        <Text style={styles.place}>{model.place}</Text>
      ) : null}
    </Pressable>
  );
}
