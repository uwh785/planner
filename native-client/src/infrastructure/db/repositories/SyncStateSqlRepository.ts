import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import type { SyncStateRepository } from '@/application/ports/SyncStateRepository';

export const CURSOR_KEY = 'cursor';
const LAST_SYNC_KEY = 'last_sync_at';

export async function writeSyncState(
  db: SqlDatabase,
  key: string,
  value: number,
): Promise<void> {
  await db.execute(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, String(value)],
  );
}

export class SyncStateSqlRepository implements SyncStateRepository {
  constructor(private readonly db: SqlDatabase) {}

  private async read(key: string): Promise<number | null> {
    const [row] = await this.db.query<{ value: string | null }>(
      'SELECT value FROM sync_state WHERE key = ?',
      [key],
    );
    const value = row?.value == null ? NaN : Number(row.value);
    return Number.isFinite(value) ? value : null;
  }

  async getCursor(): Promise<number> {
    return (await this.read(CURSOR_KEY)) ?? 0;
  }

  setCursor(cursor: number): Promise<void> {
    return writeSyncState(this.db, CURSOR_KEY, cursor);
  }

  getLastSyncAt(): Promise<number | null> {
    return this.read(LAST_SYNC_KEY);
  }

  setLastSyncAt(at: number): Promise<void> {
    return writeSyncState(this.db, LAST_SYNC_KEY, at);
  }
}
