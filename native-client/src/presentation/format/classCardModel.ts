import type { ClassSession } from '@/domain';
import { formatTimeRange } from '@/application/schedule/scheduleTime';

/** What a class card shows; no repository types leak into the component. */
export interface ClassCardModel {
  id: string;
  subject: string;
  /** "08:00 – 09:00". */
  time: string;
  /** "A1, Ruiz", whichever of the two is set; empty when neither. */
  place: string;
  /** The class's own color, or empty to take the accent. */
  color: string;
}

export function classCardModel(c: ClassSession): ClassCardModel {
  return {
    id: c.id,
    subject: c.subject,
    time: formatTimeRange(c.startMinute, c.endMinute),
    place: [c.room, c.teacher].filter(part => part !== '').join(', '),
    color: c.color,
  };
}
