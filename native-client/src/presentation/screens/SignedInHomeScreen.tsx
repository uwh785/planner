import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ContainerSource } from '@/application/container';
import type { AuthUser } from '@/domain/auth';
import { Button } from '../components/atoms/Button';
import { Screen } from '../components/atoms/Screen';
import { ContainerProvider, useAcquiredContainer } from '../containerContext';
import { useSession } from '../sessionContext';
import { useStyles } from '../theme';
import { DevTaskButton } from './DevTaskButton';
import { SyncStatusLine } from './SyncStatusLine';
import type { Theme } from '../theme';

const makeStyles = (t: Theme) => ({
  title: { ...t.typography.title, color: t.colors.text },
  group: {
    marginTop: t.spacing.lg,
    padding: t.spacing.md,
    borderRadius: t.radii.card,
    borderWidth: StyleSheet.hairlineWidth,
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
  hint: {
    ...t.typography.body,
    color: t.colors.textMuted,
    marginTop: t.spacing.lg,
  },
  actions: { marginTop: t.spacing.xl },
});

/**
 * Placeholder home until the real screens (M5). Holds the user's database
 * open while it is on screen and signs the user out on request.
 */
export function SignedInHomeScreen({
  user,
  containers,
}: {
  user: AuthUser;
  containers: ContainerSource;
}) {
  const styles = useStyles(makeStyles);
  const { logout } = useSession();
  const container = useAcquiredContainer(containers);
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    try {
      await logout();
    } catch {
      // The session is gone locally either way; the gate shows the sign-in form.
    }
  }

  return (
    <ContainerProvider value={container}>
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Planner
        </Text>
        <View style={styles.group}>
          <Text style={styles.caption}>Signed in as</Text>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
        <Text style={styles.hint}>Your tasks will live here.</Text>
        <SyncStatusLine />
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label="Sign out"
            busyLabel="Signing out…"
            busy={leaving}
            onPress={signOut}
          />
        </View>
        <DevTaskButton />
      </Screen>
    </ContainerProvider>
  );
}
