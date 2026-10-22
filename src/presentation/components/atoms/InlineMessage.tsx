import React from 'react';
import { Text, View } from 'react-native';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface InlineMessageProps {
  /** Nothing is shown for null; the live region stays mounted either way. */
  message: string | null | undefined;
  kind: 'error' | 'notice';
}

const makeStyles = (t: Theme) => ({
  box: {
    borderLeftWidth: 4,
    borderRadius: t.radius,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    marginBottom: t.spacing.md,
  },
  error: {
    borderLeftColor: t.colors.danger,
    backgroundColor: t.colors.surface,
  },
  notice: {
    borderLeftColor: t.colors.noticeBar,
    backgroundColor: t.colors.noticeSurface,
  },
  text: { fontSize: t.type.body, lineHeight: 24, color: t.colors.text },
  errorText: { color: t.colors.danger },
});

/**
 * A short message that screen readers announce when it appears. The wrapper
 * is always mounted so TalkBack sees the change; errors also carry a leading
 * "Error:" so color is never the only signal.
 */
export function InlineMessage({ message, kind }: InlineMessageProps) {
  const styles = useStyles(makeStyles);
  return (
    <View accessibilityLiveRegion="polite">
      {message ? (
        <View style={[styles.box, styles[kind]]}>
          <Text style={[styles.text, kind === 'error' && styles.errorText]}>
            {kind === 'error' ? `Error: ${message}` : message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
