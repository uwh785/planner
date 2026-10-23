import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../atoms/Button';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

export interface HeaderAction {
  label: string;
  onPress: () => void;
}

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  actions?: readonly HeaderAction[];
}

const makeStyles = (t: Theme) => ({
  wrap: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.xs,
    paddingBottom: t.spacing.sm,
  },
  bar: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginHorizontal: -t.spacing.md,
  },
  actions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
  title: { ...t.typography.title, color: t.colors.text },
});

/**
 * The top of a screen: Back on the left, actions on the right, the title
 * below so it can wrap at large text sizes without pushing anything off.
 */
export function ScreenHeader({
  title,
  onBack,
  actions = [],
}: ScreenHeaderProps) {
  const styles = useStyles(makeStyles);
  const t = useT();
  return (
    <View style={styles.wrap}>
      {onBack || actions.length > 0 ? (
        <View style={styles.bar}>
          {onBack ? (
            <Button variant="link" label={t('back')} onPress={onBack} />
          ) : (
            <View />
          )}
          <View style={styles.actions}>
            {actions.map(action => (
              <Button
                key={action.label}
                variant="link"
                label={action.label}
                onPress={action.onPress}
              />
            ))}
          </View>
        </View>
      ) : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
    </View>
  );
}
