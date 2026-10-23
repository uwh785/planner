import React from 'react';
import { Text, View } from 'react-native';
import type { MessageRef } from '@/application/i18n';
import { useI18n } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface AnnouncementProps {
  /** The message and a number that grows with each one; null for none. */
  notice: { id: number; message: MessageRef } | null;
}

const makeStyles = (t: Theme) => ({
  text: {
    ...t.typography.caption,
    color: t.colors.textMuted,
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.xs,
  },
});

/**
 * One quiet caption that is also a polite live region: added, completed and
 * deleted items are read out without interrupting. The wrapper stays mounted
 * so TalkBack sees the text change.
 */
export function Announcement({ notice }: AnnouncementProps) {
  const styles = useStyles(makeStyles);
  const { say } = useI18n();
  return (
    <View accessibilityLiveRegion="polite">
      {notice ? (
        <Text key={notice.id} style={styles.text}>
          {say(notice.message)}
        </Text>
      ) : null}
    </View>
  );
}
