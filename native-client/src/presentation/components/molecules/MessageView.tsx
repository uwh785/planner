import React from 'react';
import { Text, View } from 'react-native';
import { Screen } from '../atoms/Screen';
import { Button } from '../atoms/Button';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface MessageViewProps {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}

const makeStyles = (t: Theme) => ({
  title: {
    fontSize: t.type.heading,
    fontWeight: '600' as const,
    color: t.colors.text,
  },
  body: {
    fontSize: t.type.body,
    lineHeight: 24,
    color: t.colors.textMuted,
    marginTop: t.spacing.sm,
  },
  action: { marginTop: t.spacing.lg },
});

/** A full-screen title, short explanation and optional single action. */
export function MessageView({ title, body, action }: MessageViewProps) {
  const styles = useStyles(makeStyles);
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {body ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </Screen>
  );
}
