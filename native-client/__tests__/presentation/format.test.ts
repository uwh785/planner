import { translate, type Locale } from '@/application/i18n';
import { formatDuration } from '@/presentation/format/duration';
import { dateText, timeText } from '@/presentation/format/dates';
import { dueText } from '@/presentation/format/dueText';
import type { I18n } from '@/presentation/i18n/I18nProvider';

const at = (y: number, m: number, d: number, h = 0, mi = 0) =>
  new Date(y, m - 1, d, h, mi).getTime();
const NOW = at(2026, 10, 22, 10, 0);

const i18n = (locale: Locale): I18n => ({
  locale,
  t: (key, params) => translate(locale, key, params),
});
const EN = i18n('en');
const ES = i18n('es');

const task = (patch: Record<string, unknown>) => ({
  status: 'pending' as const,
  dueDate: null as number | null,
  dueAllDay: true,
  completedAt: null as number | null,
  ...patch,
});

describe('dateText', () => {
  it('writes a short date, with the year only when it is not this one (English)', () => {
    expect(dateText(at(2026, 12, 3), NOW, 'en')).toBe('Dec 3');
    expect(dateText(at(2027, 1, 9), NOW, 'en')).toBe('Jan 9, 2027');
  });

  it('writes it the Spanish way, day first (Intl with the locale)', () => {
    expect(dateText(at(2026, 12, 3), NOW, 'es')).toMatch(/^3 dic/i);
    expect(dateText(at(2027, 1, 9), NOW, 'es')).toMatch(/^9 ene.*2027$/i);
  });

  it('falls back to its own month names when Intl is unavailable', () => {
    const real = Intl.DateTimeFormat;
    Intl.DateTimeFormat = (() => {
      throw new Error('no Intl');
    }) as unknown as typeof Intl.DateTimeFormat;
    try {
      expect(dateText(at(2026, 12, 3), NOW, 'en')).toBe('Dec 3');
      expect(dateText(at(2027, 1, 9), NOW, 'en')).toBe('Jan 9, 2027');
      expect(dateText(at(2026, 12, 3), NOW, 'es')).toBe('3 dic');
      expect(dateText(at(2027, 1, 9), NOW, 'es')).toBe('9 ene 2027');
      expect(timeText(at(2026, 12, 3, 7, 5), 'en')).toBe('07:05');
    } finally {
      Intl.DateTimeFormat = real;
    }
  });
});

describe('timeText', () => {
  it('is 24-hour, like the web app, in both languages', () => {
    expect(timeText(at(2026, 10, 22, 14, 30), 'en')).toBe('14:30');
    expect(timeText(at(2026, 10, 22, 14, 30), 'es')).toBe('14:30');
  });

  it('writes midnight as 00:05, never 24:05', () => {
    expect(timeText(at(2026, 10, 22, 0, 5), 'en')).toBe('00:05');
    expect(timeText(at(2026, 10, 22, 0, 5), 'es')).toBe('00:05');
  });
});

describe('formatDuration', () => {
  const h = 3_600_000;
  const m = 60_000;
  it.each([
    [0, '0 min'],
    [30_000, '0 min'],
    [45 * m, '45 min'],
    [h, '1 h'],
    [h + 58 * m, '1 h 58 min'],
    [26 * h + 5 * m, '26 h 5 min'],
  ])('%d ms reads %s', (ms, text) => {
    expect(formatDuration(ms, EN.t)).toBe(text);
    expect(formatDuration(ms, ES.t)).toBe(text);
  });
});

describe('dueText', () => {
  it('says nothing without a due date', () => {
    expect(dueText(task({}), NOW, EN)).toBeNull();
  });

  it('uses words for today and tomorrow, with the time for timed tasks', () => {
    expect(dueText(task({ dueDate: at(2026, 10, 22) }), NOW, EN)).toEqual({
      text: 'Today',
      overdue: false,
    });
    expect(
      dueText(
        task({ dueDate: at(2026, 10, 22, 14, 30), dueAllDay: false }),
        NOW,
        EN,
      ),
    ).toEqual({ text: 'Today, 14:30', overdue: false });
    expect(dueText(task({ dueDate: at(2026, 10, 23) }), NOW, EN)?.text).toBe(
      'Tomorrow',
    );
  });

  it('speaks Spanish with the web words', () => {
    expect(dueText(task({ dueDate: at(2026, 10, 22) }), NOW, ES)?.text).toBe(
      'Hoy',
    );
    expect(dueText(task({ dueDate: at(2026, 10, 23) }), NOW, ES)?.text).toBe(
      'Mañana',
    );
    expect(
      dueText(
        task({ dueDate: at(2026, 10, 22, 14, 30), dueAllDay: false }),
        NOW,
        ES,
      )?.text,
    ).toBe('Hoy, 14:30');
  });

  it('uses a short date later, with the year only when it is not this one', () => {
    expect(dueText(task({ dueDate: at(2026, 12, 3) }), NOW, EN)?.text).toBe(
      'Dec 3',
    );
    expect(dueText(task({ dueDate: at(2027, 1, 9) }), NOW, EN)?.text).toBe(
      'Jan 9, 2027',
    );
  });

  it('spells overdue out in words, never by color alone', () => {
    expect(dueText(task({ dueDate: at(2026, 10, 20) }), NOW, EN)).toEqual({
      text: 'Overdue, Oct 20',
      overdue: true,
    });
    expect(
      dueText(
        task({ dueDate: at(2026, 10, 22, 9, 15), dueAllDay: false }),
        NOW,
        EN,
      ),
    ).toEqual({ text: 'Overdue, Oct 22, 09:15', overdue: true });
    expect(dueText(task({ dueDate: at(2026, 10, 20) }), NOW, ES)).toEqual({
      text: expect.stringMatching(/^Vencida, 20 oct/i),
      overdue: true,
    });
  });

  it('an all-day task due today is not overdue until the day ends', () => {
    expect(dueText(task({ dueDate: at(2026, 10, 22) }), NOW, EN)?.overdue).toBe(
      false,
    );
  });

  it('a completed task shows when it was completed, never overdue', () => {
    const done = task({
      status: 'completed',
      dueDate: at(2026, 10, 1),
      completedAt: at(2026, 10, 21, 8),
    });
    expect(dueText(done, NOW, EN)).toEqual({
      text: 'Completed Oct 21',
      overdue: false,
    });
    expect(dueText(done, NOW, ES)?.text).toMatch(/^Completada el 21 oct/i);
  });
});
