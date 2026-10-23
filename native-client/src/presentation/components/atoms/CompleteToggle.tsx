import React from 'react';
import { Pressable, View } from 'react-native';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';
import { CheckMark } from './Icons';

interface CompleteToggleProps {
  checked: boolean;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

const makeStyles = (t: Theme) => ({
  touch: {
    minWidth: t.minTouch,
    minHeight: t.minTouch,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pressed: { opacity: 0.8 },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.colors.borderStrong,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  filled: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
});

/** The complete control of a task row: a 24dp circle in a 48dp target. */
export function CompleteToggle({
  checked,
  label,
  onPress,
  disabled = false,
}: CompleteToggleProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.touch, pressed && styles.pressed]}
    >
      <View style={[styles.circle, checked ? styles.filled : null]}>
        {checked ? <CheckMark color={colors.onPrimary} size={24} /> : null}
      </View>
    </Pressable>
  );
}
