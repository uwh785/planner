import { databaseFileName } from '@/infrastructure/db/databaseName';

describe('databaseFileName', () => {
  it.each(['local', 'usr_8f3a9c01', 'A-b_9', 'x'.repeat(128)])(
    'accepts the normal id %s',
    id => {
      expect(databaseFileName(id)).toBe(`planner_${id}.db`);
    },
  );

  it.each([
    ['a path separator', 'a/b'],
    ['a backslash', 'a\\b'],
    ['parent traversal', '..'],
    ['traversal inside a path', '../etc/passwd'],
    ['a dot', 'a.b'],
    ['an empty id', ''],
    ['whitespace', 'a b'],
    ['a null byte', 'a\0b'],
    ['a non-ASCII id', 'usér'],
    ['an absurd length', 'x'.repeat(129)],
  ])('rejects %s', (_label, id) => {
    expect(() => databaseFileName(id)).toThrow(/unsafe user id/i);
  });
});
