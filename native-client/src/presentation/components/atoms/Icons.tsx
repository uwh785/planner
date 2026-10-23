import React from 'react';
import { StyleSheet, View } from 'react-native';

const flag = StyleSheet.create({
  box: { width: 14, height: 16, flexDirection: 'row' },
  pole: { width: 2, height: 16 },
  pennant: {
    width: 11,
    height: 8,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});

/** A check mark drawn from two borders, so no icon font is needed. */
export function CheckMark({
  color,
  size = 24,
}: {
  color: string;
  size?: number;
}) {
  const mark = {
    width: size * 0.3,
    height: size * 0.55,
    marginTop: -size * 0.08,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: color,
    transform: [{ rotate: '45deg' }],
  };
  return <View importantForAccessibility="no-hide-descendants" style={mark} />;
}

/** A small flag: a pole and a pennant. Always shown next to a word. */
export function FlagIcon({ color }: { color: string }) {
  return (
    <View
      testID="priority-flag"
      importantForAccessibility="no-hide-descendants"
      style={flag.box}
    >
      <View style={[flag.pole, { backgroundColor: color }]} />
      <View style={[flag.pennant, { backgroundColor: color }]} />
    </View>
  );
}
