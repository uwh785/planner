import React from 'react';
import { Text, View } from 'react-native';
import { EventCard } from '../molecules/EventCard';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import type { EventCardModel } from '../../format/eventCardModel';

const makeStyles = (t: Theme) => ({
  section: { gap: t.spacing.sm },
  heading: { ...t.typography.headline, color: t.colors.text },
});

/** The Panel's "Today's events": a heading and one card per event. */
export function TodayEvents({
  events,
  onOpenEvent,
}: {
  events: readonly EventCardModel[];
  onOpenEvent: (id: string) => void;
}) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {t('dashboardTodayEvents')}
      </Text>
      {events.map(model => (
        <EventCard
          key={model.id}
          model={model}
          onPress={() => onOpenEvent(model.id)}
        />
      ))}
    </View>
  );
}
