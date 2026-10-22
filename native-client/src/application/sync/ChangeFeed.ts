import type { ChangeNotifier, ChangeSource } from '../ports/ChangeNotifier';

/** Fans a "something was written locally" signal out to its listeners. */
export class ChangeFeed implements ChangeNotifier, ChangeSource {
  private readonly listeners = new Set<() => void>();

  get listenerCount(): number {
    return this.listeners.size;
  }

  notifyChange(): void {
    [...this.listeners].forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
