import type { SyncSnapshot } from '@/application/sync/SyncStatus';
import type { Translate } from './i18n/I18nProvider';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function syncedAgo(at: number, now: number, t: Translate): string {
  const age = now - at;
  if (age < MINUTE) {
    return t('syncJustNow');
  }
  if (age < HOUR) {
    return t('syncMinutesAgo', { count: Math.floor(age / MINUTE) });
  }
  if (age < DAY) {
    return t('syncHoursAgo', { count: Math.floor(age / HOUR) });
  }
  return t('syncDaysAgo', { count: Math.floor(age / DAY) });
}

/**
 * The one short sentence about sync. Plain words, no alarm: the state is
 * never carried by color alone. Order of importance: a lost session, then
 * changes that need the user, then what is happening now.
 */
export function syncStatusText(
  snapshot: SyncSnapshot,
  now: number,
  t: Translate,
): string {
  const attention = snapshot.blockedCount + snapshot.rejectedCount;
  if (snapshot.phase === 'paused') {
    return t('syncPaused');
  }
  if (attention > 0) {
    return t('syncAttention', { count: attention });
  }
  switch (snapshot.phase) {
    case 'syncing':
      return t('syncSyncing');
    case 'offline':
      return snapshot.pendingCount > 0
        ? t('syncOfflineWaiting', { count: snapshot.pendingCount })
        : t('syncOffline');
    case 'error':
      return t('syncError');
    default:
      if (snapshot.pendingCount > 0) {
        return t('syncWaiting', { count: snapshot.pendingCount });
      }
      return snapshot.lastSyncAt === null
        ? t('syncNever')
        : syncedAgo(snapshot.lastSyncAt, now, t);
  }
}
