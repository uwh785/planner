import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import type { MessageRef } from '@/application/i18n';
import { Announcement } from '../molecules/Announcement';
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
  /** The latest short message to say out loud (see Announcement). */
  notice?: { id: number; message: MessageRef } | null;
  /** Ids of the tasks in their undo window. */
  completing?: ReadonlySet<string>;
  onOpenTask: (id: string) => void;
  onStartTask: (id: string) => void;
  onPauseTask: (id: string) => void;
  onCompleteTask: (id: string) => void;
  onUndo: (id: string) => void;
  /** Rendered last (the discreet sync line). */
  footer?: React.ReactNode;
}

const NONE: ReadonlySet<string> = new Set();

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
 * cards (ring, time left, Pause and Complete). Counters carry their label,
 * not only color.
 */
export function PanelView({
  header,
  counts,
  active,
  notice = null,
  completing = NONE,
  onOpenTask,
  onStartTask,
  onPauseTask,
  onCompleteTask,
  onUndo,
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
      <Announcement notice={notice} />
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
                completing={completing.has(task.id)}
                onOpen={() => onOpenTask(task.id)}
                onStart={() => onStartTask(task.id)}
                onPause={() => onPauseTask(task.id)}
                onComplete={() => onCompleteTask(task.id)}
                onUndo={() => onUndo(task.id)}
              />
            ))}
          </View>
        )}
        {footer}
      </View>
    </ScrollView>
  );
}
