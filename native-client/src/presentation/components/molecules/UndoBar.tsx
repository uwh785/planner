import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../atoms/Button';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
  },
  word: { ...t.typography.callout, color: t.colors.text, flexShrink: 1 },
});

/**
 * What a task shows during the undo window: "Completed" (a polite live
 * region) and a link-style Undo. Completion cannot be reopened once saved, so
 * this is the only way back.
 */
export function UndoBar({ onUndo }: { onUndo?: () => void }) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text accessibilityLiveRegion="polite" style={styles.word}>
        {t('taskDone')}
      </Text>
      {onUndo ? (
        <Button variant="link" label={t('undo')} onPress={onUndo} />
      ) : null}
    </View>
  );
}
