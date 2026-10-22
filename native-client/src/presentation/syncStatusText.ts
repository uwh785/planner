import type { SyncSnapshot } from '@/application/sync/SyncStatus';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const changes = (n: number): string => (n === 1 ? '1 change' : `${n} changes`);

function syncedAgo(at: number, now: number): string {
  const age = now - at;
  if (age < MINUTE) {
    return 'Synced just now';
  }
  if (age < HOUR) {
    return `Synced ${Math.floor(age / MINUTE)} min ago`;
  }
  if (age < DAY) {
    return `Synced ${Math.floor(age / HOUR)} h ago`;
  }
  return `Synced ${Math.floor(age / DAY)} d ago`;
}

/**
 * The one short sentence about sync. Plain words, no alarm: the state is
 * never carried by color alone. Order of importance: a lost session, then
 * changes that need the user, then what is happening now.
 */
export function syncStatusText(snapshot: SyncSnapshot, now: number): string {
  const attention = snapshot.blockedCount + snapshot.rejectedCount;
  if (snapshot.phase === 'paused') {
    return 'Sync paused. Sign in again.';
  }
  if (attention > 0) {
    return attention === 1
      ? '1 change needs attention'
      : `${attention} changes need attention`;
  }
  switch (snapshot.phase) {
    case 'syncing':
      return 'Syncing…';
    case 'offline':
      return snapshot.pendingCount > 0
        ? `Offline. ${changes(snapshot.pendingCount)} waiting.`
        : 'Offline.';
    case 'error':
      return "Couldn't sync. Will try again.";
    default:
      if (snapshot.pendingCount > 0) {
        return `${changes(snapshot.pendingCount)} waiting`;
      }
      return snapshot.lastSyncAt === null
        ? 'Not synced yet'
        : syncedAgo(snapshot.lastSyncAt, now);
  }
}
