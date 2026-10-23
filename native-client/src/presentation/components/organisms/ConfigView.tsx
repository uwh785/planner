import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import { Button } from '../atoms/Button';
import { FormSection } from '../molecules/FormSection';
import { LanguageSelector } from '../molecules/LanguageSelector';
import { NavRow } from '../molecules/NavRow';

interface ConfigViewProps {
  /** Rendered first inside the scroll (the screen header). */
  header: React.ReactNode;
  name: string;
  email: string;
  signingOut: boolean;
  onOpenLists: () => void;
  onSignOut: () => void;
  /** The discreet sync line. */
  sync?: React.ReactNode;
  /** Development-only controls; absent in release builds. */
  developer?: React.ReactNode;
}

const makeStyles = (t: Theme) => ({
  content: { paddingBottom: t.spacing.xl },
  body: { paddingHorizontal: t.spacing.lg },
  account: {
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
  lists: { marginBottom: t.spacing.lg },
  signOut: { marginTop: t.spacing.sm },
});

/** The web's Settings: language, lists, the account and sign out, sync state. */
export function ConfigView({
  header,
  name,
  email,
  signingOut,
  onOpenLists,
  onSignOut,
  sync,
  developer,
}: ConfigViewProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {header}
      <View style={styles.body}>
        <FormSection title={t('configLanguage')}>
          <LanguageSelector />
        </FormSection>
        <View style={styles.lists}>
          <NavRow
            title={t('configLists')}
            hint={t('configListsHint')}
            onPress={onOpenLists}
          />
        </View>
        <FormSection title={t('configAccount')}>
          <View style={styles.account}>
            <Text style={styles.caption}>{t('configSignedInAs')}</Text>
            {name !== '' && name !== email ? (
              <Text style={styles.name}>{name}</Text>
            ) : null}
            <Text style={styles.email}>{email}</Text>
          </View>
          <View style={styles.signOut}>
            <Button
              variant="secondary"
              label={t('configLogout')}
              busyLabel={t('configSigningOut')}
              busy={signingOut}
              onPress={onSignOut}
            />
          </View>
        </FormSection>
        {sync ? (
          <FormSection title={t('configSync')}>{sync}</FormSection>
        ) : null}
        {developer ? (
          <FormSection title={t('configDevelopment')}>{developer}</FormSection>
        ) : null}
      </View>
    </ScrollView>
  );
}
