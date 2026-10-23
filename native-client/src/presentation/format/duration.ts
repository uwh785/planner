import type { Translate } from '../i18n/I18nProvider';

/** "1 h 58 min", "45 min", "2 h": whole minutes, rounded down. */
export function formatDuration(ms: number, t: Translate): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return t('durationMinutes', { minutes });
  }
  return minutes === 0
    ? t('durationHours', { hours })
    : t('durationHoursMinutes', { hours, minutes });
}
