import { isOverdue } from '@/domain';

const DAY = 86_400_000;
const NOW = 10 * DAY + 5 * 3_600_000; // 05:00 on day 10

describe('isOverdue (the web rule)', () => {
  it('is false without a due date', () => {
    expect(isOverdue({ status: 'pending', dueDate: null, dueAllDay: false }, NOW)).toBe(false);
  });

  it('a timed task is overdue once its moment has passed', () => {
    expect(isOverdue({ status: 'pending', dueDate: NOW - 1, dueAllDay: false }, NOW)).toBe(true);
    expect(isOverdue({ status: 'pending', dueDate: NOW, dueAllDay: false }, NOW)).toBe(false);
    expect(isOverdue({ status: 'in_progress', dueDate: NOW + 1, dueAllDay: false }, NOW)).toBe(false);
  });

  it('an all-day task is overdue only after its whole day', () => {
    expect(isOverdue({ status: 'pending', dueDate: 10 * DAY, dueAllDay: true }, NOW)).toBe(false);
    expect(isOverdue({ status: 'pending', dueDate: 9 * DAY, dueAllDay: true }, 10 * DAY - 1)).toBe(false);
    expect(isOverdue({ status: 'pending', dueDate: 9 * DAY, dueAllDay: true }, 10 * DAY)).toBe(true);
    expect(isOverdue({ status: 'pending', dueDate: 8 * DAY, dueAllDay: true }, NOW)).toBe(true);
  });

  it('a completed task is never overdue', () => {
    expect(isOverdue({ status: 'completed', dueDate: 1, dueAllDay: false }, NOW)).toBe(false);
  });
});
