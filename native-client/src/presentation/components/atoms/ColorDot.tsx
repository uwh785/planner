import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';

const ring = StyleSheet.create({ hollow: { borderWidth: 2 } });

/**
 * A list's color as a non-text marker. It never stands alone: the list name
 * is always beside it. `null` draws a hollow ring (the "All tasks" row).
 */
export function ColorDot({
  color,
  size = 16,
}: {
  color: string | null;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID="color-marker"
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        color === null
          ? [ring.hollow, { borderColor: colors.borderStrong }]
          : { backgroundColor: color },
      ]}
    />
  );
}
