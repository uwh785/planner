import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../atoms/Button';
import { InlineMessage } from '../atoms/InlineMessage';
import { TextField } from '../atoms/TextField';
import type { TextInputHandle } from '../atoms/TextField';
import { LanguageLink } from '../molecules/LanguageLink';
import { PasswordField } from '../molecules/PasswordField';
import type { MessageKey } from '@/application/i18n';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

export type AuthFormMode = 'signIn' | 'register';

export interface AuthFormValues {
  email: string;
  name: string;
  password: string;
}

interface AuthFormProps {
  mode: AuthFormMode;
  busy: boolean;
  initialEmail?: string;
  /** Calm information above the form, e.g. "Your session expired...". */
  notice?: string | null;
  /** A failed attempt, announced to screen readers. */
  formError?: string | null;
  /** A new object per failed check; focus moves to the first invalid field. */
  fieldErrors?: { email?: string; password?: string };
  onSubmit: (values: AuthFormValues) => void;
  onSwitchMode: () => void;
}

/** The catalog keys for each mode's copy. */
const COPY: Record<
  AuthFormMode,
  {
    title: MessageKey;
    submit: MessageKey;
    busy: MessageKey;
    switchTo: MessageKey;
  }
> = {
  signIn: {
    title: 'loginTitle',
    submit: 'loginButton',
    busy: 'authSigningIn',
    switchTo: 'registerButton',
  },
  register: {
    title: 'registerTitle',
    submit: 'registerButton',
    busy: 'authCreatingAccount',
    switchTo: 'registerLogin',
  },
};

const makeStyles = (t: Theme) => ({
  title: {
    ...t.typography.title,
    color: t.colors.text,
    marginBottom: t.spacing.lg,
  },
  actions: { marginTop: t.spacing.xs },
  switchRow: { marginTop: t.spacing.sm, alignItems: 'center' as const },
  hidden: { height: 0 },
});

/** Presentational sign-in / register form: props in, callbacks out. */
export function AuthForm({
  mode,
  busy,
  initialEmail = '',
  notice,
  formError,
  fieldErrors,
  onSubmit,
  onSwitchMode,
}: AuthFormProps) {
  const styles = useStyles(makeStyles);
  const t = useT();
  const copy = COPY[mode];
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const emailRef = useRef<TextInputHandle>(null);
  const nameRef = useRef<TextInputHandle>(null);
  const passwordRef = useRef<TextInputHandle>(null);

  useEffect(() => {
    if (fieldErrors?.email) {
      emailRef.current?.focus();
    } else if (fieldErrors?.password) {
      passwordRef.current?.focus();
    }
  }, [fieldErrors]);

  const submit = () => onSubmit({ email, name, password });
  const register = mode === 'register';

  return (
    <View>
      <Text accessibilityRole="header" style={styles.title}>
        {t(copy.title)}
      </Text>
      <InlineMessage kind="notice" message={notice} />
      <InlineMessage kind="error" message={formError} />
      <TextField
        ref={emailRef}
        label={t('loginEmail')}
        value={email}
        onChangeText={setEmail}
        error={fieldErrors?.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() =>
          (register ? nameRef : passwordRef).current?.focus()
        }
      />
      {register ? (
        <TextField
          ref={nameRef}
          label={t('registerNameOptional')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      ) : null}
      <PasswordField
        ref={passwordRef}
        label={t('loginPassword')}
        value={password}
        onChangeText={setPassword}
        error={fieldErrors?.password}
        autoComplete={register ? 'new-password' : 'current-password'}
        textContentType={register ? 'newPassword' : 'password'}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={styles.actions}>
        <Button
          label={t(copy.submit)}
          busyLabel={t(copy.busy)}
          busy={busy}
          onPress={submit}
        />
      </View>
      <View style={styles.switchRow}>
        <Button
          variant="link"
          label={t(copy.switchTo)}
          disabled={busy}
          onPress={onSwitchMode}
        />
      </View>
      <View style={styles.switchRow}>
        <LanguageLink />
      </View>
    </View>
  );
}
