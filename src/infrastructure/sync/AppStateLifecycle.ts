import { AppState } from 'react-native';
import type { AppLifecycle } from '@/application/ports/AppLifecycle';

const isForeground = (state: string | null | undefined): boolean =>
  state !== 'background' && state !== 'inactive';

/** Foreground/background from React Native's AppState. */
export class AppStateLifecycle implements AppLifecycle {
  isForeground(): boolean {
    return isForeground(AppState.currentState);
  }

  subscribe(listener: (foreground: boolean) => void): () => void {
    let last = this.isForeground();
    const subscription = AppState.addEventListener('change', state => {
      const now = isForeground(state);
      if (now !== last) {
        last = now;
        listener(now);
      }
    });
    return () => subscription.remove();
  }
}
