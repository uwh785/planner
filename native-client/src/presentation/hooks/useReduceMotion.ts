import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the person asked the system to reduce motion (Android's "Remove
 * animations"). Starts false and corrects itself once the system answers, so
 * the first frame never waits for it.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (alive) {
          setReduce(enabled);
        }
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      enabled => setReduce(enabled),
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}
