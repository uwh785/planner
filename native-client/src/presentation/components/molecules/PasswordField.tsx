import React, { useState } from 'react';
import { Button } from '../atoms/Button';
import { TextField } from '../atoms/TextField';
import type { TextFieldProps } from '../atoms/TextField';

/** A TextField for secrets with a show/hide toggle. */
export function PasswordField(props: Omit<TextFieldProps, 'trailing'>) {
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
          label={visible ? 'Hide password' : 'Show password'}
          onPress={() => setVisible(shown => !shown)}
        />
      }
    />
  );
}
