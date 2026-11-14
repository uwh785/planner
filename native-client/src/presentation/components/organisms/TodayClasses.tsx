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
  mini: {
    minHeight: t.minTouch,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
  },
  // An ended class stays listed, dimmed.
  done: { opacity: 0.55 },
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
  const done = model.state === 'done';
  return (
    <View
      accessible
      accessibilityLabel={model.spoken}
      style={[styles.mini, done && styles.done]}
    >
      <ColorDot color={model.color || colors.accent} size={12} />
      <View style={styles.info}>
        <Text style={styles.miniSubject}>{model.subject}</Text>
        <Text style={styles.sub}>{model.detail}</Text>
      </View>
    </View>
  );
}

function CardRow({ model }: { model: TodayClassModel }) {
  const styles = useStyles(makeStyles);
  const current = model.state === 'current';
  return (
    <View
      accessible
      accessibilityLabel={model.spoken}
      style={[styles.card, current && styles.current]}
    >
      {current ? (
        <CountdownRing progress={model.progress} status="in_progress" />
      ) : null}
      <View style={styles.info}>
        <Subject model={model} />
        <Text style={styles.sub}>{model.countdown}</Text>
        <Text style={styles.sub}>{model.detail}</Text>
      </View>
    </View>
  );
}

/**
 * The Panel's "Today's classes" block: the whole day by start time. The class
 * in progress is a card with its ring and "Ends in …", the next one a card
 * with "Starts in …", the rest small rows, the ended ones dimmed. Every row
 * shows its time, room and teacher. The countdown is always written; the ring
 * only repeats it.
 */
export function TodayClasses({ model, onViewSchedule }: TodayClassesProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
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
      {model.items.map(item =>
        item.state === 'current' || item.state === 'next' ? (
          <CardRow key={item.id} model={item} />
        ) : (
          <MiniRow key={item.id} model={item} />
        ),
      )}
    </View>
  );
}
