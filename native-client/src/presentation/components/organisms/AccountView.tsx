import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../atoms/Button';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface AccountViewProps {
  name: string;
  email: string;
  signingOut: boolean;
  onSignOut: () => void;
  /** Development-only controls, rendered below; absent in release builds. */
  developer?: React.ReactNode;
}

const makeStyles = (t: Theme) => ({
  content: { paddingHorizontal: t.spacing.lg },
  group: {
    padding: t.spacing.md,
    borderRadius: t.radii.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  caption: { ...t.typography.caption, color: t.colors.textMuted },
  name: {
    ...t.typography.headline,
    color: t.colors.text,
    marginTop: t.spacing.xxs,
  },
  email: { ...t.typography.callout, color: t.colors.textMuted },
  actions: { marginTop: t.spacing.xl },
  dev: { marginTop: t.spacing.xl },
  devTitle: { ...t.typography.callout, color: t.colors.textMuted },
});

/** Who is signed in, Sign out, and the development-only items. */
export function AccountView({
  name,
  email,
  signingOut,
  onSignOut,
  developer,
}: AccountViewProps) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.content}>
      <View style={styles.group}>
        <Text style={styles.caption}>Signed in as</Text>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>
      <View style={styles.actions}>
        <Button
          variant="secondary"
          label="Sign out"
          busyLabel="Signing out…"
          busy={signingOut}
          onPress={onSignOut}
        />
      </View>
      {developer ? (
        <View style={styles.dev}>
          <Text accessibilityRole="header" style={styles.devTitle}>
            Development
          </Text>
          {developer}
        </View>
      ) : null}
    </View>
  );
}
