import React, { useEffect, useRef, useState } from 'react';
import { validateCredentials } from '@/application/auth/credentials';
import type { CredentialErrors } from '@/application/auth/credentials';
import { Screen } from '../components/atoms/Screen';
import { AuthForm } from '../components/organisms/AuthForm';
import type { AuthFormValues } from '../components/organisms/AuthForm';
import { useSession } from '../sessionContext';
import { authErrorMessage } from './authMessages';
import type { AuthMode } from './authMessages';

interface AuthScreenProps {
  /** Shown above the form, e.g. after the session expired. */
  notice?: string | null;
  initialEmail?: string;
}

/** Container: validates, calls the session use cases and maps their errors. */
export function AuthScreen({ notice, initialEmail }: AuthScreenProps) {
  const { login, register } = useSession();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  // The ref closes the gap before `busy` re-renders, so a fast double tap
  // cannot send two requests.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function submit(values: AuthFormValues) {
    if (inFlight.current) {
      return;
    }
    const invalid = validateCredentials(values.email, values.password);
    if (invalid.email || invalid.password) {
      setFormError(null);
      setFieldErrors(invalid);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (mode === 'signIn') {
        await login({ email: values.email, password: values.password });
      } else {
        await register({
          email: values.email,
          name: values.name,
          password: values.password,
        });
      }
    } catch (error) {
      if (mounted.current) {
        setFormError(authErrorMessage(error, mode));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  function switchMode() {
    setMode(current => (current === 'signIn' ? 'register' : 'signIn'));
    setFormError(null);
    setFieldErrors({});
  }

  return (
    <Screen>
      <AuthForm
        mode={mode}
        busy={busy}
        initialEmail={initialEmail}
        notice={notice}
        formError={formError}
        fieldErrors={fieldErrors}
        onSubmit={submit}
        onSwitchMode={switchMode}
      />
    </Screen>
  );
}
