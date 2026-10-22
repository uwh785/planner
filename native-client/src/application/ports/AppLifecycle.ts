/** Whether the app is on screen. */
export interface AppLifecycle {
  isForeground(): boolean;
  /** Called on every change; returns the unsubscribe function. */
  subscribe(listener: (foreground: boolean) => void): () => void;
}
