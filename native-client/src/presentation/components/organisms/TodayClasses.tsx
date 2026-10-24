import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../atoms/Button';
import { ColorDot } from '../atoms/ColorDot';
import { CountdownRing } from '../atoms/CountdownRing';
import { useT } from '../../i18n/I18nProvider';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';
import type {
  TodayClassesModel,
  TodayClassModel,
} from '../../format/todayClassesModel';

interface TodayClassesProps {
  model: TodayClassesModel;
  onViewSchedule: () => void;
}

const makeStyles = (t: Theme) => ({
  section: { gap: t.spacing.sm },
  header: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  heading: { ...t.typography.headline, color: t.colors.text },
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderRadius: t.radii.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  // The class in progress takes the accent edge, as the active task card does.
  current: { borderColor: t.colors.accent },
  info: { flex: 1, gap: t.spacing.xxs },
  subjectRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
  },
  subject: {
    ...t.typography.body,
    fontWeight: '600' as const,
    color: t.colors.text,
    flex: 1,
  },
  sub: { ...t.typography.callout, color: t.colors.textMuted },
  rest: { gap: t.spacing.xxs },
  mini: {
    minHeight: t.minTouch,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
  },
  miniSubject: { ...t.typography.body, color: t.colors.text, flex: 1 },
});

function Subject({ model }: { model: TodayClassModel }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.subjectRow}>
      <ColorDot color={model.color || colors.accent} />
      <Text style={styles.subject}>{model.subject}</Text>
    </View>
  );
}

function MiniRow({ model }: { model: TodayClassModel }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${model.subject}, ${model.time}`}
      style={styles.mini}
    >
      <ColorDot color={model.color || colors.accent} size={12} />
      <Text style={styles.miniSubject}>{model.subject}</Text>
      <Text style={styles.sub}>{model.time}</Text>
    </View>
  );
}

/**
 * The Panel's "Today's classes" block, as on the web: the class in progress
 * with its ring and "Ends in …", the next one with "Starts in …", then the
 * rest as small rows. The countdown is always written; the ring only repeats it.
 */
export function TodayClasses({ model, onViewSchedule }: TodayClassesProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const { current, next, upcoming } = model;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('scheduleTodayTitle')}
        </Text>
        <Button
          variant="link"
          label={t('scheduleViewLink')}
          onPress={onViewSchedule}
        />
      </View>
      {current ? (
        <View
          accessible
          accessibilityLabel={`${current.subject}, ${current.countdown}`}
          style={[styles.card, styles.current]}
        >
          <CountdownRing progress={current.progress} status="in_progress" />
          <View style={styles.info}>
            <Subject model={current} />
            <Text style={styles.sub}>{current.countdown}</Text>
          </View>
        </View>
      ) : null}
      {next ? (
        <View
          accessible
          accessibilityLabel={`${next.subject}, ${next.countdown}`}
          style={styles.card}
        >
          <View style={styles.info}>
            <Subject model={next} />
            <Text style={styles.sub}>{next.countdown}</Text>
          </View>
        </View>
      ) : null}
      {upcoming.length > 0 ? (
        <View style={styles.rest}>
          {upcoming.map(item => (
            <MiniRow key={item.id} model={item} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
