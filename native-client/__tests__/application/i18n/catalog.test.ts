import {
  catalogs,
  DEFAULT_LOCALE,
  LOCALES,
  translate,
  type Message,
  type MessageKey,
} from '@/application/i18n';

const keys = Object.keys(catalogs.es) as MessageKey[];

const forms = (message: Message): string[] =>
  typeof message === 'string' ? [message] : [message.one, message.other];

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]!).sort();

describe('message catalogs', () => {
  it('defaults to Spanish and offers English', () => {
    expect(DEFAULT_LOCALE).toBe('es');
    expect([...LOCALES]).toEqual(['es', 'en']);
  });

  it('has the same keys in both languages', () => {
    expect(Object.keys(catalogs.en).sort()).toEqual([...keys].sort());
  });

  it.each(LOCALES)('has no empty value in %s', locale => {
    for (const key of keys) {
      for (const text of forms(catalogs[locale][key])) {
        expect({ key, blank: text.trim() === '' }).toEqual({
          key,
          blank: false,
        });
      }
    }
  });

  it('has the same interpolation placeholders in both languages', () => {
    for (const key of keys) {
      const es = forms(catalogs.es[key]).flatMap(placeholders);
      const en = forms(catalogs.en[key]).flatMap(placeholders);
      expect({ key, placeholders: [...new Set(es)].sort() }).toEqual({
        key,
        placeholders: [...new Set(en)].sort(),
      });
    }
  });

  it('gives plural messages both forms in both languages, counting with {count}', () => {
    for (const key of keys) {
      const es = catalogs.es[key];
      const en = catalogs.en[key];
      expect({ key, plural: typeof es !== 'string' }).toEqual({
        key,
        plural: typeof en !== 'string',
      });
      if (typeof es !== 'string' && typeof en !== 'string') {
        for (const form of [es.one, es.other, en.one, en.other]) {
          expect(form).toContain('{count}');
        }
      }
    }
  });

  it('never uses an em dash in UI copy', () => {
    for (const locale of LOCALES) {
      for (const key of keys) {
        for (const text of forms(catalogs[locale][key])) {
          expect(text).not.toMatch(/—/);
        }
      }
    }
  });

  it('reuses the web app wording for keys the web already has', () => {
    const es = (key: MessageKey) => translate('es', key);
    const en = (key: MessageKey) => translate('en', key);
    expect(es('navDashboard')).toBe('Panel');
    expect(es('navTasks')).toBe('Tareas');
    expect(es('navSchedule')).toBe('Horario');
    expect(es('scheduleEmptyDay')).toBe('No hay clases este día');
    expect(es('scheduleTodayTitle')).toBe('Clases de hoy');
    expect(en('scheduleAddClass')).toBe('Add class');
    expect(es('dashboardPending')).toBe('Pendientes');
    expect(es('dashboardInProgress')).toBe('En progreso');
    expect(es('dashboardCompleted')).toBe('Completadas');
    expect(es('dashboardOverdue')).toBe('Vencidas');
    expect(es('dashboardActive')).toBe('Tareas activas');
    expect(es('taskTimeLeft')).toBe('Tiempo restante');
    expect(es('taskPriorityHigh')).toBe('Alta');
    expect(es('configLanguage')).toBe('Idioma');
    expect(en('navDashboard')).toBe('Dashboard');
    expect(en('navConfig')).toBe('Settings');
    expect(en('dashboardInProgress')).toBe('In Progress');
    expect(en('taskPriorityHigh')).toBe('High');
    expect(en('taskTimeLeft')).toBe('Time left');
  });
});

describe('translate', () => {
  it('fills placeholders', () => {
    expect(translate('en', 'noticeAdded', { title: 'Buy milk' })).toBe(
      'Added Buy milk',
    );
    expect(translate('es', 'noticeAdded', { title: 'Comprar leche' })).toBe(
      'Se agregó Comprar leche',
    );
  });

  it('picks the plural form from {count} (one only for exactly 1)', () => {
    expect(translate('en', 'listOpenCount', { count: 0 })).toBe('0 open tasks');
    expect(translate('en', 'listOpenCount', { count: 1 })).toBe('1 open task');
    expect(translate('en', 'listOpenCount', { count: 3 })).toBe('3 open tasks');
    expect(translate('es', 'listOpenCount', { count: 0 })).toBe(
      '0 tareas abiertas',
    );
    expect(translate('es', 'listOpenCount', { count: 1 })).toBe(
      '1 tarea abierta',
    );
    expect(translate('es', 'listOpenCount', { count: 2 })).toBe(
      '2 tareas abiertas',
    );
  });

  it('leaves an unknown placeholder visible instead of printing undefined', () => {
    expect(translate('en', 'noticeAdded', {})).toBe('Added {title}');
  });
});

describe('weekday names', () => {
  it('has a letter and a name for each weekday, Sunday first', () => {
    const letters = (locale: 'es' | 'en') =>
      [0, 1, 2, 3, 4, 5, 6].map(d =>
        translate(locale, `scheduleDayShort${d}` as MessageKey),
      );
    const names = (locale: 'es' | 'en') =>
      [0, 1, 2, 3, 4, 5, 6].map(d =>
        translate(locale, `scheduleDayName${d}` as MessageKey),
      );
    expect(letters('es')).toEqual(['D', 'L', 'M', 'M', 'J', 'V', 'S']);
    expect(letters('en')).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(names('es')[0]).toBe('Domingo');
    expect(names('es')[3]).toBe('Miércoles');
    expect(names('en')[1]).toBe('Monday');
  });
});
