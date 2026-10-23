import { useRef } from 'react';
import { Alert } from 'react-native';
import { usePreventRemove, useNavigation } from '@react-navigation/native';

/**
 * Asks before leaving a form with unsaved edits (on-screen Back and the
 * system back button alike). Call `allowLeaving()` right before a navigation
 * the user already confirmed (after Save or Delete).
 */
export function useDiscardGuard(dirty: boolean, subject: string) {
  const navigation = useNavigation();
  const allowed = useRef(false);
  usePreventRemove(dirty, ({ data }) => {
    if (allowed.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert('Discard changes?', `Your edits to this ${subject} are not saved.`, [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });
  return {
    allowLeaving: () => {
      allowed.current = true;
    },
  };
}
