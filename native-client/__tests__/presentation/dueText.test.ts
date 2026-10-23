import { dueText } from '@/presentation/format/dueText';

const at = (y: number, m: number, d: number, h = 0, mi = 0) =>
  new Date(y, m - 1, d, h, mi).getTime();
const NOW = at(2026, 10, 22, 10, 0);
const task = (patch: Record<string, unknown>) => ({
  status: 'pending' as const,
  dueDate: null as number | null,
  dueAllDay: true,
  completedAt: null as number | null,
  ...patch,
});

describe('dueText', () => {
  it('says nothing without a due date', () => {
    expect(dueText(task({}), NOW)).toBeNull();
  });

  it('uses words for today and tomorrow, with the time for timed tasks', () => {
    expect(dueText(task({ dueDate: at(2026, 10, 22) }), NOW)).toEqual({
      text: 'Today',
      overdue: false,
    });
    expect(
      dueText(
        task({ dueDate: at(2026, 10, 22, 14, 30), dueAllDay: false }),
        NOW,
      ),
    ).toEqual({ text: 'Today, 14:30', overdue: false });
    expect(dueText(task({ dueDate: at(2026, 10, 23) }), NOW)?.text).toBe(
      'Tomorrow',
    );
  });

  it('uses a short date later, with the year only when it is not this one', () => {
    expect(dueText(task({ dueDate: at(2026, 12, 3) }), NOW)?.text).toBe(
      'Dec 3',
    );
    expect(dueText(task({ dueDate: at(2027, 1, 9) }), NOW)?.text).toBe(
      'Jan 9, 2027',
    );
  });

  it('spells overdue out in words, never by color alone', () => {
    expect(dueText(task({ dueDate: at(2026, 10, 20) }), NOW)).toEqual({
      text: 'Overdue, Oct 20',
      overdue: true,
    });
    expect(
      dueText(
        task({ dueDate: at(2026, 10, 22, 9, 15), dueAllDay: false }),
        NOW,
      ),
    ).toEqual({ text: 'Overdue, Oct 22, 09:15', overdue: true });
  });

  it('an all-day task due today is not overdue until the day ends', () => {
    expect(dueText(task({ dueDate: at(2026, 10, 22) }), NOW)?.overdue).toBe(
      false,
    );
  });

  it('a completed task shows when it was completed, never overdue', () => {
    expect(
      dueText(
        task({
          status: 'completed',
          dueDate: at(2026, 10, 1),
          completedAt: at(2026, 10, 21, 8),
        }),
        NOW,
      ),
    ).toEqual({ text: 'Completed Oct 21', overdue: false });
  });
});
