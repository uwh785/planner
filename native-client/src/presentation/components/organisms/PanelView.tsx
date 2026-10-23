import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import { StatTile } from '../molecules/StatTile';
import { TaskCard, type TaskCardModel } from '../molecules/TaskCard';

export interface PanelCounts {
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

interface PanelViewProps {
  /** Rendered first inside the scroll (the screen header). */
  header: React.ReactNode;
  counts: PanelCounts;
  active: readonly TaskCardModel[];
  onOpenTask: (id: string) => void;
  /** Rendered last (the discreet sync line). */
  footer?: React.ReactNode;
}

const makeStyles = (t: Theme) => ({
  content: { paddingBottom: t.spacing.xl },
  body: { paddingHorizontal: t.spacing.lg, gap: t.spacing.md },
  stats: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: t.spacing.sm,
  },
  heading: {
    ...t.typography.headline,
    color: t.colors.text,
    marginTop: t.spacing.xs,
  },
  cards: { gap: t.spacing.sm },
  empty: { paddingVertical: t.spacing.lg, alignItems: 'center' as const },
  emptyTitle: {
    ...t.typography.body,
    color: t.colors.text,
    textAlign: 'center' as const,
  },
  emptyBody: {
    ...t.typography.callout,
    fontWeight: '400' as const,
    color: t.colors.textMuted,
    textAlign: 'center' as const,
    marginTop: t.spacing.xxs,
  },
});

/**
 * The web's Panel on a phone: the four counters, then the active tasks as
 * cards (ring and time left). Counters carry their label, not only color.
 */
export function PanelView({
  header,
  counts,
  active,
  onOpenTask,
  footer,
}: PanelViewProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {header}
      <View style={styles.body}>
        <View style={styles.stats}>
          <StatTile label={t('dashboardPending')} count={counts.pending} />
          <StatTile
            label={t('dashboardInProgress')}
            count={counts.inProgress}
            tone="accent"
          />
          <StatTile
            label={t('dashboardCompleted')}
            count={counts.completed}
            tone="success"
          />
          <StatTile
            label={t('dashboardOverdue')}
            count={counts.overdue}
            tone="danger"
          />
        </View>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('dashboardActive')}
        </Text>
        {active.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('dashboardNoActive')}</Text>
            <Text style={styles.emptyBody}>{t('dashboardNoActiveHint')}</Text>
          </View>
        ) : (
          <View style={styles.cards}>
            {active.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onOpen={() => onOpenTask(task.id)}
              />
            ))}
          </View>
        )}
        {footer}
      </View>
    </ScrollView>
  );
}
