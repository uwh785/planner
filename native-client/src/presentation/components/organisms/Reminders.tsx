import React from 'react';
import { Text, View } from 'react-native';
import { GroupedRow, groupPosition } from '../atoms/GroupedRow';
import { ReminderRow } from '../molecules/ReminderRow';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import type { ReminderModel } from '../../format/remindersModel';

const makeStyles = (t: Theme) => ({
  section: { gap: t.spacing.sm },
  heading: { ...t.typography.headline, color: t.colors.text },
});

/**
 * The Panel's "Reminders": a heading and one grouped surface with a row per
 * flagged event, soonest first.
 */
export function Reminders({
  reminders,
  onOpenEvent,
}: {
  reminders: readonly ReminderModel[];
  onOpenEvent: (id: string) => void;
}) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('dashboardReminders')}
      </Text>
      <View>
        {reminders.map((model, index) => (
          <GroupedRow
            key={model.id}
            position={groupPosition(index, reminders.length)}
          >
            <ReminderRow model={model} onPress={() => onOpenEvent(model.id)} />
          </GroupedRow>
        ))}
      </View>
    </View>
  );
}
