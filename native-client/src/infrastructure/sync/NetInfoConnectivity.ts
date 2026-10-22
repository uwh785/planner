import NetInfo from '@react-native-community/netinfo';
import type { Connectivity } from '@/application/ports/Connectivity';

/**
 * Connectivity from the OS (`@react-native-community/netinfo`). It starts
 * listening the first time it is asked (so an adapter nobody uses costs
 * nothing) and keeps listening, so `isOnline()` is current whenever a
 * scheduler is built. Only `isConnected` counts: "internet reachable" is a
 * probe of a public host, which says nothing about the Planner server. Until
 * NetInfo reports (it does so right after subscribing) the answer is
 * optimistic; a failed request would show the truth anyway.
 */
export class NetInfoConnectivity implements Connectivity {
  private online = true;
  private readonly listeners = new Set<(online: boolean) => void>();
  private unsubscribe: (() => void) | null = null;

  private listen(): void {
    this.unsubscribe ??= NetInfo.addEventListener(state => {
      const online = state.isConnected !== false;
      if (online !== this.online) {
        this.online = online;
        [...this.listeners].forEach(listener => listener(online));
      }
    });
  }

  isOnline(): boolean {
    this.listen();
    return this.online;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listen();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }
}
