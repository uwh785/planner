import React from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import { EmptyState } from '../molecules/EmptyState';
import { TaskCard, type TaskCardModel } from '../molecules/TaskCard';

/**
 * How the completed tasks show: collapsed behind a header (the "All" view),
 * always open (the "Completed" filter) or not at all (other filters).
 */
export type CompletedMode = 'collapsible' | 'open' | 'none';

interface TasksViewProps {
  /** Rendered first inside the scroll: header, quick add, filters. */
  header: React.ReactNode;
  open: readonly TaskCardModel[];
  completed: readonly TaskCardModel[];
  /** The real number of completed tasks, which may exceed `completed`. */
  completedTotal: number;
  completedMode: CompletedMode;
  /** Whether the "All" view has anything at all (decides the empty state). */
  filtered: boolean;
  completing: ReadonlySet<string>;
  completedExpanded: boolean;
  onToggleCompleted: () => void;
  onCompleteTask: (id: string) => void;
  onUndo: (id: string) => void;
  onOpenTask: (id: string) => void;
}

interface Section {
  key: 'open' | 'completed';
  data: readonly TaskCardModel[];
}

const makeStyles = (t: Theme) => ({
  content: { paddingBottom: t.spacing.xl },
  inset: { paddingHorizontal: t.spacing.lg },
  heading: {
    ...t.typography.callout,
    color: t.colors.textMuted,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.xs,
  },
  completedHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: t.minTouch,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.xs,
    gap: t.spacing.sm,
  },
  pressed: { opacity: 0.8 },
  completedTitle: {
    ...t.typography.callout,
    color: t.colors.textMuted,
    flexShrink: 1,
  },
  toggleWord: {
    ...t.typography.callout,
    color: t.colors.accentText,
    textDecorationLine: 'underline' as const,
  },
  caption: {
    ...t.typography.caption,
    color: t.colors.textMuted,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.xs,
  },
  gap: { height: t.spacing.sm },
  header: { paddingBottom: t.spacing.xs },
});

/** The space between two cards. */
function Gap() {
  const styles = useStyles(makeStyles);
  return <View style={styles.gap} />;
}

/** Open task cards, then a collapsed Completed section, under the screen header. */
export function TasksView({
  header,
  open,
  completed,
  completedTotal,
  completedMode,
  filtered,
  completing,
  completedExpanded,
  onToggleCompleted,
  onCompleteTask,
  onUndo,
  onOpenTask,
}: TasksViewProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const expanded = completedMode === 'open' || completedExpanded;
  const sections: Section[] = [{ key: 'open', data: open }];
  if (completedMode !== 'none' && completedTotal > 0) {
    sections.push({ key: 'completed', data: expanded ? completed : [] });
  }
  const nothingAtAll =
    open.length === 0 && (completedMode === 'none' || completedTotal === 0);
  return (
    <SectionList<TaskCardModel, Section>
      sections={sections}
      keyExtractor={task => task.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={<View style={styles.header}>{header}</View>}
      ItemSeparatorComponent={Gap}
      renderSectionHeader={({ section }) => {
        if (section.key === 'open') {
          return completedMode === 'collapsible' && completedTotal > 0 ? (
            <Text accessibilityRole="header" style={styles.heading}>
              {t('sectionOpen')}
            </Text>
          ) : null;
        }
        if (completedMode === 'open') {
          return (
            <Text accessibilityRole="header" style={styles.heading}>
              {t('completedHeader', { count: completedTotal })}
            </Text>
          );
        }
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('completedHeaderLabel', {
              count: completedTotal,
              state: completedExpanded
                ? t('completedShown')
                : t('completedHidden'),
            })}
            accessibilityState={{ expanded: completedExpanded }}
            onPress={onToggleCompleted}
            style={({ pressed }) => [
              styles.completedHeader,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.completedTitle}>
              {t('completedHeader', { count: completedTotal })}
            </Text>
            <Text style={styles.toggleWord}>
              {completedExpanded ? t('hide') : t('show')}
            </Text>
          </Pressable>
        );
      }}
      renderItem={({ item }) => (
        <View style={styles.inset}>
          <TaskCard
            task={item}
            completing={completing.has(item.id)}
            onOpen={() => onOpenTask(item.id)}
            onComplete={() => onCompleteTask(item.id)}
            onUndo={() => onUndo(item.id)}
          />
        </View>
      )}
      renderSectionFooter={({ section }) => {
        if (section.key === 'open' && open.length === 0) {
          if (nothingAtAll) {
            return filtered ? (
              <EmptyState title={t('tasksEmpty')} body={t('tasksNoMatch')} />
            ) : (
              <EmptyState title={t('tasksEmpty')} body={t('tasksEmptyHint')} />
            );
          }
          return (
            <EmptyState
              title={t('nothingOpenTitle')}
              body={t('nothingOpenBody')}
            />
          );
        }
        if (
          section.key === 'completed' &&
          expanded &&
          completedTotal > completed.length
        ) {
          return (
            <View>
              <Text style={styles.caption}>
                {t('completedCap', {
                  shown: completed.length,
                  total: completedTotal,
                })}
              </Text>
            </View>
          );
        }
        return null;
      }}
    />
  );
}
