import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '../atoms/Button';
import { IconButton } from '../atoms/IconButton';
import { Pencil, Trash } from '../atoms/icons';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface DetailHeaderProps {
  title: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const makeStyles = (t: Theme) => ({
  wrap: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.xs,
    paddingBottom: t.spacing.sm,
  },
  bar: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginLeft: -t.spacing.md,
    gap: t.spacing.xs,
  },
  actions: { flexDirection: 'row' as const, gap: t.spacing.xs },
  title: { ...t.typography.title, color: t.colors.text },
});

/**
 * The web's detail header: Back on the left, the Edit (pencil) and Delete
 * (trash) icon buttons on the right, and the title below so it can wrap at
 * large text sizes. The icon buttons are named for screen readers.
 */
export function DetailHeader({
  title,
  onBack,
  onEdit,
  onDelete,
}: DetailHeaderProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Button variant="link" label={t('back')} onPress={onBack} />
        <View style={styles.actions}>
          <IconButton
            icon={Pencil}
            label={t('taskEditTitle')}
            onPress={onEdit}
          />
          <IconButton
            icon={Trash}
            tone="danger"
            label={t('taskDeleteAction')}
            onPress={onDelete}
          />
        </View>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
    </View>
  );
}
