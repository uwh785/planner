/** The operating system's view of the network (not proof the server is up). */
export interface Connectivity {
  /** Whether the OS reports a connection. Optimistic before it knows. */
  isOnline(): boolean;
  /** Called on every change of that state; returns the unsubscribe function. */
  subscribe(listener: (online: boolean) => void): () => void;
}
