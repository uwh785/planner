import type { IdGenerator, IdPrefix } from '@/application/ports/IdGenerator';

type FillRandom = (bytes: Uint8Array<ArrayBuffer>) => unknown;

/** The platform CSPRNG: `crypto.getRandomValues`, read at call time. */
const platformRandom: FillRandom = bytes => {
  const source = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof source?.getRandomValues !== 'function') {
    // Never fall back to Math.random: ids are what keeps devices from colliding.
    throw new Error(
      'crypto.getRandomValues is unavailable; import react-native-get-random-values at the app entry',
    );
  }
  return source.getRandomValues(bytes);
};

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

/**
 * Ids as the backend makes them: `<prefix>_<16 hex>` (64 random bits).
 * Change ids are `c` plus 32 hex (128 random bits): 33 visible ASCII chars.
 */
export class RandomIdGenerator implements IdGenerator {
  constructor(private readonly fillRandom: FillRandom = platformRandom) {}

  private random(length: number): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(length);
    this.fillRandom(bytes);
    return bytes;
  }

  newId(prefix: IdPrefix): string {
    return `${prefix}_${hex(this.random(8))}`;
  }

  newChangeId(): string {
    return `c${hex(this.random(16))}`;
  }
}
