import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { ContainerSource } from '@/application/container';
import type { AuthUser } from '@/domain/auth';
import { Button } from '../components/atoms/Button';
import { Screen } from '../components/atoms/Screen';
import { ContainerProvider, useAcquiredContainer } from '../containerContext';
import { useSession } from '../sessionContext';
import { useStyles } from '../theme';
import type { Theme } from '../theme';

const makeStyles = (t: Theme) => ({
  title: {
    fontSize: t.type.title,
    fontWeight: '600' as const,
    color: t.colors.text,
  },
  caption: {
    fontSize: t.type.small,
    color: t.colors.textMuted,
    marginTop: t.spacing.lg,
  },
  name: {
    fontSize: t.type.heading,
    fontWeight: '600' as const,
    color: t.colors.text,
  },
  email: { fontSize: t.type.body, color: t.colors.textMuted },
  hint: {
    fontSize: t.type.body,
    lineHeight: 24,
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
        <Text style={styles.caption}>Signed in as</Text>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.hint}>Your tasks will live here.</Text>
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label="Sign out"
            busyLabel="Signing out…"
            busy={leaving}
            onPress={signOut}
          />
        </View>
      </Screen>
    </ContainerProvider>
  );
}
