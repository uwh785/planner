import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

/** What a ref to the underlying input gives you (focus, blur, ...). */
export type TextInputHandle = React.ComponentRef<typeof TextInput>;

export interface TextFieldProps
  extends Omit<TextInputProps, 'style' | 'accessibilityLabel'> {
  label: string;
  error?: string | null;
  /** Rendered inside the field on the right, e.g. a show/hide toggle. */
  trailing?: React.ReactNode;
  ref?: React.Ref<TextInputHandle>;
}

const makeStyles = (t: Theme) => ({
  wrap: { marginBottom: t.spacing.md },
  label: {
    ...t.typography.callout,
    color: t.colors.textMuted,
    marginBottom: t.spacing.xxs,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: t.minTouch,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
    borderRadius: t.radii.control,
    backgroundColor: t.colors.surface,
  },
  rowFocused: { borderColor: t.colors.accent, borderWidth: 2 },
  rowError: { borderColor: t.colors.danger, borderWidth: 2 },
  input: {
    flex: 1,
    minHeight: t.minTouch,
    paddingHorizontal: t.spacing.md,
    ...t.typography.body,
    color: t.colors.text,
  },
  error: {
    ...t.typography.caption,
    color: t.colors.danger,
    marginTop: t.spacing.xxs,
  },
});

/** A labeled single-line input; the label is visible and read by TalkBack. */
export function TextField({
  label,
  error,
  trailing,
  ref,
  ...inputProps
}: TextFieldProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const { onFocus, onBlur } = inputProps;
  return (
    <View style={styles.wrap}>
      <Text importantForAccessibility="no" style={styles.label}>
        {label}
      </Text>
      <View
        style={[
          styles.row,
          focused ? styles.rowFocused : null,
          error ? styles.rowError : null,
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          {...inputProps}
          onFocus={event => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={event => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {trailing}
      </View>
      <View accessibilityLiveRegion="polite">
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}
