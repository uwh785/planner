import type { ClassSession } from '@/domain';
import { classCardModel } from '@/presentation/format/classCardModel';
import { todayClassesModel } from '@/presentation/format/todayClassesModel';
import { words } from '../helpers/i18n';

const cls = (patch: Partial<ClassSession>): ClassSession => ({
  id: 'cls_1',
  subject: 'FÍSICA',
  dayOfWeek: 4,
  startMinute: 540,
  endMinute: 630,
  room: '',
  teacher: '',
  color: '',
  updatedAt: 1,
  deleted: false,
  ...patch,
});

// Thursday 22 Oct 2026, 10:00 local.
const THURSDAY_10 = new Date(2026, 9, 22, 10, 0).getTime();

describe('classCardModel', () => {
  it('writes the range and joins whichever of room and teacher is set', () => {
    expect(classCardModel(cls({ room: 'A1', teacher: 'Ruiz' }))).toMatchObject({
      time: '09:00 – 10:30',
      place: 'A1, Ruiz',
    });
    expect(classCardModel(cls({ teacher: 'Ruiz' })).place).toBe('Ruiz');
    expect(classCardModel(cls({})).place).toBe('');
  });
});

describe('todayClassesModel', () => {
  const en = words('en');

  it('is null when today has no class', () => {
    expect(todayClassesModel([], THURSDAY_10, en)).toBeNull();
    expect(
      todayClassesModel([cls({ dayOfWeek: 2 })], THURSDAY_10, en),
    ).toBeNull();
  });

  it('lists every class of the day in order, the ended ones included', () => {
    const model = todayClassesModel(
      [
        cls({ id: 'c', subject: 'ARTE', startMinute: 780, endMinute: 840 }),
        cls({ id: 'a', startMinute: 570, endMinute: 630 }),
        cls({
          id: 'e',
          subject: 'INGLÉS',
          startMinute: 480,
          endMinute: 540,
          room: 'A1',
          teacher: 'Ruiz',
        }),
        cls({ id: 'b', subject: 'QUÍMICA', startMinute: 660, endMinute: 720 }),
        cls({ id: 'x', dayOfWeek: 1 }),
      ],
      THURSDAY_10,
      en,
    );
    expect(
      model?.items.map(i => [i.id, i.state, i.countdown, i.detail]),
    ).toEqual([
      ['e', 'done', '', '08:00 – 09:00 · A1, Ruiz'],
      ['a', 'current', 'Ends in 30 min', '09:30 – 10:30'],
      ['b', 'next', 'Starts in 1 h', '11:00 – 12:00'],
      ['c', 'later', '', '13:00 – 14:00'],
    ]);
    expect(model?.items[1]?.progress).toBe(0.5);
    expect(model?.items.map(i => i.spoken)).toEqual([
      'INGLÉS, Finished, 08:00 – 09:00, A1, Ruiz',
      'FÍSICA, Ends in 30 min, 09:30 – 10:30',
      'QUÍMICA, Starts in 1 h, 11:00 – 12:00',
      'ARTE, 13:00 – 14:00',
    ]);
  });

  it('keeps a class that overlaps the one in progress', () => {
    const model = todayClassesModel(
      [
        cls({ id: 'a', startMinute: 570, endMinute: 630 }),
        cls({ id: 'b', startMinute: 590, endMinute: 650 }),
      ],
      THURSDAY_10,
      en,
    );
    expect(model?.items.map(i => [i.id, i.state])).toEqual([
      ['a', 'current'],
      ['b', 'later'],
    ]);
  });

  it('speaks Spanish', () => {
    const model = todayClassesModel(
      [cls({ startMinute: 570, endMinute: 630 })],
      THURSDAY_10,
      words('es'),
    );
    expect(model?.items[0]?.countdown).toBe('Termina en 30 min');
  });
});
