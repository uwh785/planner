import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CalendarDays, MapPin } from '../atoms/icons';
import { ColorDot } from '../atoms/ColorDot';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';
import type { EventCardModel } from '../../format/eventCardModel';

const makeStyles = (t: Theme) => ({
  card: {
    padding: t.spacing.md,
    borderRadius: t.radii.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    gap: t.spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
  },
  title: {
    ...t.typography.body,
    fontWeight: '700' as const,
    color: t.colors.text,
    flex: 1,
  },
  meta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
  },
  metaText: {
    ...t.typography.callout,
    fontWeight: '400' as const,
    color: t.colors.textMuted,
    flexShrink: 1,
  },
  pressed: { opacity: 0.8 },
});

/**
 * The web's event card: bold title, a calendar icon with the time, a map
 * pin with the location. The event color is a dot beside the title (not a
 * side stripe, see DESIGN.md); the card opens the event for editing.
 */
export function EventCard({
  model,
  onPress,
}: {
  model: EventCardModel;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const spoken = [model.title, model.time, model.location]
    .filter(part => part !== '')
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.titleRow}>
        <ColorDot color={model.color || colors.accent} />
        <Text style={styles.title}>{model.title}</Text>
      </View>
      <View style={styles.meta}>
        <CalendarDays size={14} color={colors.textMuted} />
        <Text style={styles.metaText}>{model.time}</Text>
      </View>
      {model.location !== '' ? (
        <View style={styles.meta}>
          <MapPin size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{model.location}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
