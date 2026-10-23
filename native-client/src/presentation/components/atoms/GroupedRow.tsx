import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

/** Where a row sits in its group, which decides its corners and separator. */
export type GroupPosition = 'only' | 'first' | 'middle' | 'last';

export const groupPosition = (index: number, count: number): GroupPosition =>
  count <= 1
    ? 'only'
    : index === 0
    ? 'first'
    : index === count - 1
    ? 'last'
    : 'middle';

const makeStyles = (t: Theme) => ({
  base: {
    minHeight: t.minTouch,
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  only: {
    borderRadius: t.radii.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  first: {
    borderTopLeftRadius: t.radii.card,
    borderTopRightRadius: t.radii.card,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  middle: {},
  last: {
    borderBottomLeftRadius: t.radii.card,
    borderBottomRightRadius: t.radii.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: t.spacing.md,
    backgroundColor: t.colors.border,
  },
});

/**
 * One row of a grouped list: a Surface strip with a hairline outline, the
 * group's outer corners rounded and a hairline separator inset 16dp.
 */
export function GroupedRow({
  position,
  testID,
  children,
}: {
  position: GroupPosition;
  testID?: string;
  children: React.ReactNode;
}) {
  const styles = useStyles(makeStyles);
  const separated = position === 'middle' || position === 'last';
  return (
    <View testID={testID} style={[styles.base, styles[position]]}>
      {separated ? <View style={styles.separator} /> : null}
      {children}
    </View>
  );
}
