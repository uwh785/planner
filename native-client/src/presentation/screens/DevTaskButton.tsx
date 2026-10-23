import React from 'react';
import { View } from 'react-native';
import { Button } from '../components/atoms/Button';
import { useContainer } from '../containerContext';
import { useT } from '../i18n/I18nProvider';
import { useStyles } from '../theme';
import type { Theme } from '../theme';

const makeStyles = (t: Theme) => ({ box: { marginTop: t.spacing.md } });

/**
 * Development builds only: queues one sample task in the signed-in user's own
 * database, so offline sync can be exercised by hand on a device.
 * Shown on the Config screen; renders nothing in release builds.
 */
export function DevTaskButton() {
  const styles = useStyles(makeStyles);
  const t = useT();
  const container = useContainer();
  if (!__DEV__ || container === null) {
    return null;
  }
  return (
    <View style={styles.box}>
      <Button
        variant="secondary"
        label={t('devSampleTask')}
        onPress={() => {
          container.tasks
            .create({ title: `Sample task ${new Date().toISOString()}` })
            .catch(error => console.error('sample task failed', error));
        }}
      />
    </View>
  );
}
