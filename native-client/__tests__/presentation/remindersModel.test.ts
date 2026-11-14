import type { Event } from '@/domain';
import { remindersModel } from '@/presentation/format/remindersModel';
import { words } from '../helpers/i18n';

const at = (y: number, m: number, d: number, h = 0) =>
  new Date(y, m, d, h).getTime();
const NOW = at(2026, 10, 11, 15);

let n = 0;
const event = (title: string, startAt: number, remind = true): Event => {
  n += 1;
  return {
    id: `evt_${n}`,
    title,
    description: '',
    location: '',
    startAt,
    endAt: null,
    allDay: false,
    remind,
    color: '#FF453A',
    updatedAt: 1,
    deleted: false,
  };
};

describe('remindersModel', () => {
  it('lists flagged events from tomorrow on with their date and countdown', () => {
    const events = [
      event('Recharge', at(2027, 0, 10, 9)),
      event('Plain', at(2026, 10, 20), false),
      event('Gone', at(2026, 10, 10)),
      event('Renew', at(2026, 10, 12)),
      event('Pay', at(2026, 10, 11, 8)),
      event('Call', at(2026, 10, 13)),
    ];
    const rows = remindersModel(events, NOW, words('en').t);
    expect(
      rows.map(r => [r.title, r.date, r.countdown, r.color, r.daysLeft]),
    ).toEqual([
      ['Renew', '12 nov', 'Tomorrow', '#FF453A', 1],
      ['Call', '13 nov', '2 days left', '#FF453A', 2],
      ['Recharge', '10 jan', '60 days left', '#FF453A', 60],
    ]);
    expect(rows[2]!.id).toBe(events[0]!.id);
    expect(rows[2]!.spoken).toBe('Recharge, 10 jan, 60 days left');
  });

  it('speaks Spanish', () => {
    const rows = remindersModel(
      [event('Recarga', at(2026, 11, 10)), event('Renovar', at(2026, 10, 12))],
      NOW,
      words('es').t,
    );
    expect(rows.map(r => r.spoken)).toEqual([
      'Renovar, 12 nov, Mañana',
      'Recarga, 10 dic, Faltan 29 días',
    ]);
  });

  it('is empty when nothing is flagged', () => {
    expect(
      remindersModel(
        [event('Plain', at(2026, 10, 20), false)],
        NOW,
        words('en').t,
      ),
    ).toEqual([]);
  });
});
