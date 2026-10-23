import React from 'react';
import { Pressable } from 'react-native';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

/** What a Lucide icon takes, so any of them can be passed as `icon`. */
export type IconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

interface IconButtonProps {
  icon: IconComponent;
  /** The spoken name. An icon alone never says what a button does. */
  label: string;
  onPress: () => void;
  /** `danger` colors the icon with the error color (delete). */
  tone?: 'default' | 'danger';
  disabled?: boolean;
  testID?: string;
}

const makeStyles = (t: Theme) => ({
  base: {
    minWidth: t.minTouch,
    minHeight: t.minTouch,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: t.radii.control,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
  },
  danger: { borderColor: t.colors.danger },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.6 },
});

/** A 48dp square button with one icon, named by `label` for screen readers. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  tone = 'default',
  disabled = false,
  testID,
}: IconButtonProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        tone === 'danger' ? styles.danger : null,
        pressed && styles.pressed,
        disabled && styles.inactive,
      ]}
    >
      <Icon
        size={20}
        strokeWidth={2.25}
        color={tone === 'danger' ? colors.danger : colors.text}
      />
    </Pressable>
  );
}
