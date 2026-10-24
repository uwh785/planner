import { useRef } from 'react';
import { Alert } from 'react-native';
import { usePreventRemove, useNavigation } from '@react-navigation/native';
import { useT } from '../i18n/I18nProvider';

const DISCARD_BODY = {
  task: 'discardBodyTask',
  list: 'discardBodyList',
  class: 'discardBodyClass',
} as const;

/**
 * Asks before leaving a form with unsaved edits (on-screen Back and the
 * system back button alike). Run a navigation the user already confirmed
 * (after Save or Delete) through `leaveWith(navigate)`: the guard lets that
 * one call through and is armed again right after it, whether the navigation
 * went through, reached the guard or threw, so a failed or ignored Back can
 * never leave the screen open to a silent discard later.
 */
export function useDiscardGuard(
  dirty: boolean,
  subject: 'task' | 'list' | 'class',
) {
  const navigation = useNavigation();
  const t = useT();
  const allowed = useRef(false);
  usePreventRemove(dirty, ({ data }) => {
    if (allowed.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert(t('discardTitle'), t(DISCARD_BODY[subject]), [
      { text: t('keepEditing'), style: 'cancel' },
      {
        text: t('discard'),
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });
  return {
    leaveWith: (navigate: () => void) => {
      allowed.current = true;
      try {
        navigate();
      } finally {
        allowed.current = false;
      }
    },
  };
}
