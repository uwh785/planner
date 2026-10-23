import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { usePlanner } from '../plannerContext';

/**
 * Completes the tasks still in their undo window when the screen loses focus
 * (the tabs stay mounted, so switching tabs never unmounts a screen) and when
 * it goes away. A failed write is announced by title; if the flush itself
 * fails, a general notice says some changes were not saved. Nothing is lost
 * silently and nothing is left as an unhandled rejection.
 */
export function useFlushCompletionOnLeave(): void {
  const planner = usePlanner();
  useFocusEffect(
    useCallback(
      () => () => {
        planner.completion.flush().catch(() => {
          planner.notices.announce({ key: 'noticeFlushFailed' });
        });
      },
      [planner],
    ),
  );
}
