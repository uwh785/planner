import { AsyncStorageLocaleStore } from '@/infrastructure/storage/AsyncStorageLocaleStore';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('AsyncStorageLocaleStore', () => {
  it('reads null when nothing was saved', async () => {
    const store = new AsyncStorageLocaleStore(memoryStorage());
    await expect(store.load()).resolves.toBeNull();
  });

  it('round trips the saved language through the storage', async () => {
    const storage = memoryStorage();
    await new AsyncStorageLocaleStore(storage).save('en');
    expect(storage.data.get('planner.locale')).toBe('en');
    await expect(new AsyncStorageLocaleStore(storage).load()).resolves.toBe(
      'en',
    );
  });

  it('works with the library storage (jest mock) when none is injected', async () => {
    await new AsyncStorageLocaleStore().save('en');
    await expect(new AsyncStorageLocaleStore().load()).resolves.toBe('en');
  });
});
