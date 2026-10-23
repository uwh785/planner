import React from 'react';
import { Text, View } from 'react-native';
import type { TaskStatus } from '@/domain';
import { formatDuration } from '../../format/duration';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import { CountdownRing } from '../atoms/CountdownRing';

export interface TimerModel {
  /** 0 to 1. */
  progress: number;
  remainingMs: number;
}

const makeStyles = (t: Theme) => ({
  box: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.sm,
    padding: t.spacing.sm,
    borderRadius: 8,
    backgroundColor: t.colors.surface2,
  },
  info: { flexShrink: 1 },
  // Surface 2 only carries primary text (DESIGN.md), so the label is `text`.
  label: { ...t.typography.caption, color: t.colors.text },
  value: {
    ...t.typography.headline,
    color: t.colors.text,
    fontWeight: '700' as const,
  },
});

/**
 * The web's remaining-time box: the ring and "Time left 1 h 58 min". The
 * box is one spoken unit ("1 h 58 min left"), so the ring needs no words.
 */
export function TimerBox({
  status,
  timer,
}: {
  status: TaskStatus;
  timer: TimerModel;
}) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const done = status === 'completed';
  const over = !done && timer.progress >= 1;
  const time = formatDuration(timer.remainingMs, t);
  const spoken = done
    ? t('taskDone')
    : over
    ? t('taskTimeOver')
    : t('timerRemaining', { time });
  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={styles.box}
      testID="timer-box"
    >
      <CountdownRing progress={timer.progress} status={status} />
      <View style={styles.info}>
        {done ? (
          <Text style={styles.value}>{t('taskDone')}</Text>
        ) : over ? (
          <Text style={styles.value}>{t('taskTimeOver')}</Text>
        ) : (
          <>
            <Text style={styles.label}>{t('taskTimeLeft')}</Text>
            <Text style={styles.value}>{time}</Text>
          </>
        )}
      </View>
    </View>
  );
}
