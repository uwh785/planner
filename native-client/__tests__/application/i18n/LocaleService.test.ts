import { InMemoryLocaleStore, LocaleService } from '@/application/i18n';
import type { LocaleStore } from '@/application/ports/LocaleStore';

describe('LocaleService', () => {
  it('starts in Spanish and is not ready until restored', async () => {
    const service = new LocaleService(new InMemoryLocaleStore());
    expect(service.getSnapshot()).toEqual({ locale: 'es', ready: false });
    await service.restore();
    expect(service.getSnapshot()).toEqual({ locale: 'es', ready: true });
  });

  it('restores the saved language', async () => {
    const service = new LocaleService(new InMemoryLocaleStore('en'));
    await service.restore();
    expect(service.getSnapshot()).toEqual({ locale: 'en', ready: true });
  });

  it('ignores a stored value that is not a supported language', async () => {
    const service = new LocaleService(new InMemoryLocaleStore('fr'));
    await service.restore();
    expect(service.getSnapshot().locale).toBe('es');
  });

  it('falls back to Spanish and becomes ready when the store cannot be read', async () => {
    const store: LocaleStore = {
      load: async () => {
        throw new Error('storage down');
      },
      save: async () => undefined,
    };
    const service = new LocaleService(store);
    await expect(service.restore()).resolves.toBeUndefined();
    expect(service.getSnapshot()).toEqual({ locale: 'es', ready: true });
  });

  it('switches at once, notifies subscribers and persists the choice', async () => {
    const store = new InMemoryLocaleStore();
    const service = new LocaleService(store);
    await service.restore();
    const listener = jest.fn();
    service.subscribe(listener);
    await service.set('en');
    expect(service.getSnapshot().locale).toBe('en');
    expect(listener).toHaveBeenCalled();
    expect(store.value).toBe('en');
  });

  it('survives a restart: a new service over the same store reads the choice', async () => {
    const store = new InMemoryLocaleStore();
    const first = new LocaleService(store);
    await first.restore();
    await first.set('en');
    const second = new LocaleService(store);
    await second.restore();
    expect(second.getSnapshot().locale).toBe('en');
  });

  it('keeps the new language for this session when saving fails', async () => {
    const store: LocaleStore = {
      load: async () => null,
      save: async () => {
        throw new Error('disk full');
      },
    };
    const service = new LocaleService(store);
    await service.restore();
    await expect(service.set('en')).resolves.toBeUndefined();
    expect(service.getSnapshot().locale).toBe('en');
  });

  it('does not wake subscribers when the language does not change', async () => {
    const service = new LocaleService(new InMemoryLocaleStore());
    await service.restore();
    const listener = jest.fn();
    service.subscribe(listener);
    await service.set('es');
    expect(listener).not.toHaveBeenCalled();
  });
});
