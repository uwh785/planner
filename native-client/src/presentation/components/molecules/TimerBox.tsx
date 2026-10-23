import React from 'react';
import { Text, View } from 'react-native';
import type { TaskStatus } from '@/domain';
import { formatDuration, formatRemaining } from '../../format/duration';
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
  // The detail screen's card: Surface and a hairline like the web's timer
  // section, the large ring and a larger gap.
  card: {
    gap: t.spacing.md,
    padding: t.spacing.md,
    borderRadius: t.radii.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
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
 * The `card` variant is the detail screen's: the large ring on Surface, and
 * a spoken label that also gives the share of the time used (the ring's
 * text equivalent).
 */
export function TimerBox({
  status,
  timer,
  variant = 'inline',
}: {
  status: TaskStatus;
  timer: TimerModel;
  variant?: 'inline' | 'card';
}) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const done = status === 'completed';
  const over = !done && timer.progress >= 1;
  const card = variant === 'card';
  const time = card
    ? formatRemaining(timer.remainingMs, t)
    : formatDuration(timer.remainingMs, t);
  const spoken = done
    ? t('taskDone')
    : over
    ? t('taskTimeOver')
    : card
    ? t('timerSpoken', {
        time,
        percent: Math.round(timer.progress * 100),
      })
    : t('timerRemaining', { time });
  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={[styles.box, card ? styles.card : null]}
      testID="timer-box"
    >
      <CountdownRing
        progress={timer.progress}
        status={status}
        size={card ? 'large' : 'compact'}
      />
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
