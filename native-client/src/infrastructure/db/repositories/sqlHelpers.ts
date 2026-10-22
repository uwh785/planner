import type { SqlDatabase, SqlValue } from '@/application/ports/SqlDatabase';

const entriesOf = (row: object): [string, SqlValue][] =>
  Object.entries(row) as [string, SqlValue][];

export async function insertRow(
  db: SqlDatabase,
  table: string,
  row: object,
): Promise<void> {
  const entries = entriesOf(row);
  const columns = entries.map(([c]) => c).join(', ');
  const marks = entries.map(() => '?').join(', ');
  await db.execute(
    `INSERT INTO ${table} (${columns}) VALUES (${marks})`,
    entries.map(([, v]) => v),
  );
}

/** Inserts the row, or overwrites every non-key column when the key exists. */
export async function upsertRow(
  db: SqlDatabase,
  table: string,
  row: object,
  keyColumns: readonly string[],
): Promise<void> {
  const entries = entriesOf(row);
  const columns = entries.map(([c]) => c).join(', ');
  const marks = entries.map(() => '?').join(', ');
  const assignments = entries
    .filter(([c]) => !keyColumns.includes(c))
    .map(([c]) => `${c} = excluded.${c}`)
    .join(', ');
  await db.execute(
    `INSERT INTO ${table} (${columns}) VALUES (${marks})
     ON CONFLICT (${keyColumns.join(', ')}) DO UPDATE SET ${assignments}`,
    entries.map(([, v]) => v),
  );
}

/** Overwrites every column except the key. */
export async function updateRow(
  db: SqlDatabase,
  table: string,
  keyColumn: string,
  row: object,
): Promise<void> {
  const entries = entriesOf(row);
  const keyValue = entries.find(([c]) => c === keyColumn)?.[1];
  const rest = entries.filter(([c]) => c !== keyColumn);
  await db.execute(
    `UPDATE ${table} SET ${rest
      .map(([c]) => `${c} = ?`)
      .join(', ')} WHERE ${keyColumn} = ?`,
    [...rest.map(([, v]) => v), keyValue ?? null],
  );
}

/** Applies a patch, ignoring keys whose value is undefined. */
export function merge<T extends object>(current: T, patch: object): T {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );
  return { ...current, ...defined };
}
