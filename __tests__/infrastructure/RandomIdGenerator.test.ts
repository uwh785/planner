import { RandomIdGenerator } from '@/infrastructure/system/RandomIdGenerator';
import { SystemClock } from '@/infrastructure/system/SystemClock';

const fill = (bytes: Uint8Array) => {
  bytes.forEach((_, i) => {
    bytes[i] = (i * 37 + 11) % 256;
  });
  return bytes;
};

describe('RandomIdGenerator', () => {
  it('produces <prefix>_<16 hex> with every backend prefix', () => {
    const gen = new RandomIdGenerator();
    for (const prefix of ['lst', 'tsk', 'sub', 'tag', 'cls', 'evt'] as const) {
      expect(gen.newId(prefix)).toMatch(new RegExp(`^${prefix}_[0-9a-f]{16}$`));
    }
  });

  it('draws from the injected random source', () => {
    const gen = new RandomIdGenerator(fill);
    expect(gen.newId('tsk')).toBe('tsk_0b30557a9fc4e90e');
  });

  it('does not repeat over many ids', () => {
    const gen = new RandomIdGenerator();
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) {
      seen.add(gen.newId('tsk'));
      seen.add(gen.newChangeId());
    }
    expect(seen.size).toBe(10000);
  });

  it('change ids are 1-64 visible ASCII characters', () => {
    const gen = new RandomIdGenerator();
    for (let i = 0; i < 100; i += 1) {
      expect(gen.newChangeId()).toMatch(/^[\x21-\x7e]{1,64}$/);
    }
  });

  it('fails loudly instead of falling back when no secure source exists', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
    });
    try {
      expect(() => new RandomIdGenerator().newId('tsk')).toThrow(
        /getRandomValues/,
      );
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: original,
        configurable: true,
      });
    }
  });
});

describe('SystemClock', () => {
  it('returns epoch milliseconds', () => {
    const before = Date.now();
    const now = new SystemClock().now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
