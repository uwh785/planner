import React from 'react';
import { Text, View } from 'react-native';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface InlineMessageProps {
  /** Nothing is shown for null; the live region stays mounted either way. */
  message: string | null | undefined;
  kind: 'error' | 'notice';
}

const makeStyles = (t: Theme) => ({
  box: {
    borderRadius: t.radii.control,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    marginBottom: t.spacing.md,
  },
  error: {
    borderWidth: 1,
    borderColor: t.colors.danger,
    backgroundColor: t.colors.surface,
  },
  notice: { backgroundColor: t.colors.surface2 },
  text: { ...t.typography.body, color: t.colors.text },
  errorText: { color: t.colors.danger },
});

/**
 * A short message that screen readers announce when it appears. The wrapper
 * is always mounted so TalkBack sees the change; errors also carry a leading
 * "Error:" so color is never the only signal.
 */
export function InlineMessage({ message, kind }: InlineMessageProps) {
  const styles = useStyles(makeStyles);
  const t = useT();
  return (
    <View accessibilityLiveRegion="polite">
      {message ? (
        <View style={[styles.box, styles[kind]]}>
          <Text style={[styles.text, kind === 'error' && styles.errorText]}>
            {kind === 'error' ? `${t('errorPrefix')} ${message}` : message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
