import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '../atoms/Button';
import { TextField } from '../atoms/TextField';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface QuickAddFieldProps {
  /** Visible label and spoken name, e.g. "Add a task" (already translated). */
  label: string;
  /** Resolves to an error sentence to show, or null when it worked. */
  onSubmit: (text: string) => Promise<string | null>;
}

const makeStyles = (t: Theme) => ({
  wrap: { paddingHorizontal: t.spacing.lg },
});

/**
 * A one-line field that adds on the keyboard's action key (or the Add
 * button), clears itself when it worked and keeps the keyboard open for the
 * next one.
 */
export function QuickAddField({ label, onSubmit }: QuickAddFieldProps) {
  const styles = useStyles(makeStyles);
  const t = useT();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  async function submit() {
    if (busy.current) {
      return;
    }
    busy.current = true;
    try {
      const problem = await onSubmit(text);
      setError(problem);
      if (problem === null) {
        setText('');
      }
    } finally {
      busy.current = false;
    }
  }

  return (
    <View style={styles.wrap}>
      <TextField
        label={label}
        value={text}
        onChangeText={value => {
          setText(value);
          setError(null);
        }}
        error={error}
        returnKeyType="done"
        blurOnSubmit={false}
        onSubmitEditing={submit}
        autoCapitalize="sentences"
        trailing={<Button variant="link" label={t('add')} onPress={submit} />}
      />
    </View>
  );
}
