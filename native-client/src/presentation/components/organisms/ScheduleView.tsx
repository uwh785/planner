import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { InlineMessage } from '../atoms/InlineMessage';
import { Announcement } from '../molecules/Announcement';
import { ClassCard } from '../molecules/ClassCard';
import { DayTabs } from '../molecules/DayTabs';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import type { MessageRef } from '@/application/i18n';
import type { ClassCardModel } from '../../format/classCardModel';

interface ScheduleViewProps {
  /** Rendered first inside the scroll (the screen header). */
  header: React.ReactNode;
  /** The selected weekday, 0 (Sunday) to 6. */
  day: number;
  onChangeDay: (dayOfWeek: number) => void;
  /** That day's classes, by start time. */
  classes: readonly ClassCardModel[];
  /** A message when the classes could not be read. */
  error?: string | null;
  notice?: { id: number; message: MessageRef } | null;
  onOpenClass: (id: string) => void;
}

const makeStyles = (t: Theme) => ({
  content: { paddingBottom: t.spacing.xl },
  body: { paddingHorizontal: t.spacing.lg, gap: t.spacing.md },
  cards: { gap: t.spacing.sm },
  empty: { paddingVertical: t.spacing.lg, alignItems: 'center' as const },
  emptyText: {
    ...t.typography.body,
    color: t.colors.textMuted,
    textAlign: 'center' as const,
  },
});

/**
 * The web's Schedule on a phone: the weekday tabs, then the selected day's
 * classes as cards, or one line when the day is free.
 */
export function ScheduleView({
  header,
  day,
  onChangeDay,
  classes,
  error = null,
  notice = null,
  onOpenClass,
}: ScheduleViewProps) {
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
        <DayTabs label={t('scheduleDay')} value={day} onChange={onChangeDay} />
        <InlineMessage kind="error" message={error} />
        {classes.length === 0 && error === null ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('scheduleEmptyDay')}</Text>
          </View>
        ) : (
          <View style={styles.cards}>
            {classes.map(model => (
              <ClassCard
                key={model.id}
                model={model}
                onPress={() => onOpenClass(model.id)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
