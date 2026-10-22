import type { AppLifecycle } from '@/application/ports/AppLifecycle';
import type { Connectivity } from '@/application/ports/Connectivity';
import type { Timer } from '@/application/ports/Timer';
import type { FakeClock } from './testRepositories';

interface Scheduled {
  id: number;
  at: number;
  fn: () => void;
}

/** Timer driven by hand; advancing it also advances the fake clock. */
export class FakeTimer implements Timer {
  private seq = 0;
  private items: Scheduled[] = [];
  constructor(private readonly clock: FakeClock) {}

  get size(): number {
    return this.items.length;
  }

  schedule(fn: () => void, delayMs: number): () => void {
    this.seq += 1;
    const item = { id: this.seq, at: this.clock.now() + delayMs, fn };
    this.items.push(item);
    return () => {
      this.items = this.items.filter(i => i.id !== item.id);
    };
  }

  /** Runs every timer that falls due within `ms`, in order. */
  advance(ms: number): void {
    const end = this.clock.now() + ms;
    for (;;) {
      const next = this.items
        .filter(i => i.at <= end)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (next === undefined) {
        break;
      }
      this.items = this.items.filter(i => i !== next);
      this.clock.current = Math.max(this.clock.current, next.at);
      next.fn();
    }
    this.clock.current = end;
  }
}

class Emitter<T> {
  private listeners = new Set<(value: T) => void>();
  get count(): number {
    return this.listeners.size;
  }
  add(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  emit(value: T): void {
    [...this.listeners].forEach(l => l(value));
  }
}

export class FakeConnectivity implements Connectivity {
  private readonly emitter = new Emitter<boolean>();
  constructor(private online = true) {}
  get listeners(): number {
    return this.emitter.count;
  }
  isOnline(): boolean {
    return this.online;
  }
  subscribe(listener: (online: boolean) => void): () => void {
    return this.emitter.add(listener);
  }
  set(online: boolean): void {
    this.online = online;
    this.emitter.emit(online);
  }
}

export class FakeLifecycle implements AppLifecycle {
  private readonly emitter = new Emitter<boolean>();
  constructor(private foreground = true) {}
  get listeners(): number {
    return this.emitter.count;
  }
  isForeground(): boolean {
    return this.foreground;
  }
  subscribe(listener: (foreground: boolean) => void): () => void {
    return this.emitter.add(listener);
  }
  set(foreground: boolean): void {
    this.foreground = foreground;
    this.emitter.emit(foreground);
  }
}
