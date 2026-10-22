/**
 * Told by the repositories after a local write has committed, so the sync
 * scheduler can push soon after. Never called for a write that rolled back.
 */
export interface ChangeNotifier {
  notifyChange(): void;
}

/** The listening side: who wants to hear about committed local writes. */
export interface ChangeSource {
  subscribe(listener: () => void): () => void;
}
