import React, { useState } from 'react';
import { useT } from '../../i18n/I18nProvider';
import { Button } from '../atoms/Button';
import { TextField } from '../atoms/TextField';
import type { TextFieldProps } from '../atoms/TextField';

/** A TextField for secrets with a show/hide toggle. */
export function PasswordField(props: Omit<TextFieldProps, 'trailing'>) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Button
          variant="link"
          label={visible ? t('passwordHide') : t('passwordShow')}
          onPress={() => setVisible(shown => !shown)}
        />
      }
    />
  );
}
