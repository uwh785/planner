import type { Timer } from '@/application/ports/Timer';

/** The platform's setTimeout behind the Timer port. */
export class SystemTimer implements Timer {
  schedule(fn: () => void, delayMs: number): () => void {
    const handle = setTimeout(fn, delayMs);
    return () => clearTimeout(handle);
  }
}
