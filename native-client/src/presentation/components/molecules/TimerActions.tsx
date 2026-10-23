import React from 'react';
import { View } from 'react-native';
import type { TaskStatus } from '@/domain';
import { TimerButton } from '../atoms/TimerButton';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface TimerActionsProps {
  status: TaskStatus;
  /** For the spoken names: "Start Write report". */
  title: string;
  variant?: 'filled' | 'outlined';
  /** Ignores presses (a write is under way). */
  busy?: boolean;
  /** An action is shown only when its handler is given. */
  onStart?: () => void;
  onPause?: () => void;
  onComplete?: () => void;
}

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: t.spacing.sm,
  },
  // The detail screen's buttons share the row; a card's keep their size.
  grow: { flexGrow: 1, flexBasis: 120 },
});

/**
 * The web's Start / Pause / Complete buttons by status: a pending task offers
 * Start, one in progress offers Pause, both offer Complete, a completed one
 * offers nothing. Wraps to a second line at large font sizes.
 */
export function TimerActions({
  status,
  title,
  variant = 'filled',
  busy = false,
  onStart,
  onPause,
  onComplete,
}: TimerActionsProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  if (status === 'completed') {
    return null;
  }
  const first = status === 'pending' ? onStart : onPause;
  const slot = variant === 'filled' ? styles.grow : undefined;
  return (
    <View testID="timer-actions" style={styles.row}>
      {first ? (
        <View style={slot}>
          {status === 'pending' ? (
            <TimerButton
              tone="start"
              variant={variant}
              label={t('taskStart')}
              accessibilityLabel={t('taskStartLabel', { title })}
              disabled={busy}
              onPress={first}
            />
          ) : (
            <TimerButton
              tone="pause"
              variant={variant}
              label={t('taskPause')}
              accessibilityLabel={t('taskPauseLabel', { title })}
              disabled={busy}
              onPress={first}
            />
          )}
        </View>
      ) : null}
      {onComplete ? (
        <View style={slot}>
          <TimerButton
            tone="complete"
            variant={variant}
            label={t('taskComplete')}
            accessibilityLabel={t('taskMarkDone', { title })}
            disabled={busy}
            onPress={onComplete}
          />
        </View>
      ) : null}
    </View>
  );
}
