import { useRef } from 'react';
import { Alert } from 'react-native';
import { usePreventRemove, useNavigation } from '@react-navigation/native';
import { useT } from '../i18n/I18nProvider';

/**
 * Asks before leaving a form with unsaved edits (on-screen Back and the
 * system back button alike). Call `allowLeaving()` right before a navigation
 * the user already confirmed (after Save or Delete).
 */
export function useDiscardGuard(dirty: boolean, subject: 'task' | 'list') {
  const navigation = useNavigation();
  const t = useT();
  const allowed = useRef(false);
  usePreventRemove(dirty, ({ data }) => {
    if (allowed.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert(
      t('discardTitle'),
      t(subject === 'task' ? 'discardBodyTask' : 'discardBodyList'),
      [
        { text: t('keepEditing'), style: 'cancel' },
        {
          text: t('discard'),
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });
  return {
    allowLeaving: () => {
      allowed.current = true;
    },
  };
}
