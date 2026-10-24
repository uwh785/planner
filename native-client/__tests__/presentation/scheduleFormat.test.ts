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

  it('words the current, the next and the rest', () => {
    const model = todayClassesModel(
      [
        cls({ id: 'a', startMinute: 570, endMinute: 630 }),
        cls({ id: 'b', subject: 'QUÍMICA', startMinute: 660, endMinute: 720 }),
        cls({ id: 'c', subject: 'ARTE', startMinute: 780, endMinute: 840 }),
        cls({ id: 'x', dayOfWeek: 1 }),
      ],
      THURSDAY_10,
      en,
    );
    expect(model?.current).toMatchObject({
      id: 'a',
      countdown: 'Ends in 30 min',
      progress: 0.5,
    });
    expect(model?.next).toMatchObject({
      id: 'b',
      countdown: 'Starts in 1 h',
    });
    expect(model?.upcoming).toEqual([
      expect.objectContaining({ id: 'c', time: '13:00 – 14:00' }),
    ]);
  });

  it('speaks Spanish', () => {
    const model = todayClassesModel(
      [cls({ startMinute: 570, endMinute: 630 })],
      THURSDAY_10,
      words('es'),
    );
    expect(model?.current?.countdown).toBe('Termina en 30 min');
  });
});
