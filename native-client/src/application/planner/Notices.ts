import type { MessageRef } from '../i18n';
import type { Timer } from '../ports/Timer';

/** How long a notice stays before it clears itself. */
export const NOTICE_MS = 5_000;

export interface Notice {
  /** Grows with every announcement, so the same words can be announced again. */
  id: number;
  /** What to say; the screen words it in the current language. */
  message: MessageRef;
}

/**
 * The one short line the screens say out loud ("Added Buy milk", "Deleted
 * Buy milk"), kept as a message key so it follows the language. Shown as a polite live region, so it is read without
 * interrupting. Shared, so a deletion made on the edit screen is still
 * heard on the list it returns to.
 */
export class Notices {
  private current: Notice | null = null;
  private seq = 0;
  private cancelClear: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly timer?: Timer) {}

  getSnapshot = (): Notice | null => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  announce(message: MessageRef): void {
    this.cancelClear?.();
    this.seq += 1;
    this.current = { id: this.seq, message };
    this.cancelClear =
      this.timer?.schedule(() => {
        this.current = null;
        this.cancelClear = null;
        this.emit();
      }, NOTICE_MS) ?? null;
    this.emit();
  }

  dispose(): void {
    this.cancelClear?.();
    this.cancelClear = null;
  }

  private emit(): void {
    [...this.listeners].forEach(listener => listener());
  }
}
