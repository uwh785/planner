/** One-shot timers, injected so schedulers are testable without waiting. */
export interface Timer {
  /** Runs `fn` once after `delayMs`; returns a function that cancels it. */
  schedule(fn: () => void, delayMs: number): () => void;
}
