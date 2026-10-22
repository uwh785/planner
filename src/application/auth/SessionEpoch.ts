/**
 * Counts how many times the identity behind the stored session changed
 * (logout, sign-in, register). Work that started under one epoch must not
 * persist its result once the epoch moved on: that is how a refresh that
 * finishes after logout is kept from signing the user back in.
 *
 * `exclusive` serializes the check-and-write sections, so a store write
 * either completes before a logout clears the store or is skipped.
 */
export class SessionEpoch {
  private value = 0;
  private tail: Promise<unknown> = Promise.resolve();

  current(): number {
    return this.value;
  }

  /** Invalidates everything captured under the previous epoch. */
  advance(): void {
    this.value += 1;
  }

  exclusive<T>(section: () => Promise<T>): Promise<T> {
    const run = this.tail.then(section, section);
    this.tail = run.catch(() => undefined);
    return run;
  }
}
