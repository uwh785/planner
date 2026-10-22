/** Values that can be bound to a statement parameter. Booleans are 0/1. */
export type SqlValue = string | number | null;

export interface SqlRunResult {
  rowsAffected: number;
}

/**
 * Port for the local SQL store. Promise-based so adapters may be synchronous
 * (Node tests) or asynchronous (op-sqlite).
 *
 * Statements and transactions on one database run one at a time, in call
 * order. Inside a `transaction` callback use the handle you are given, never
 * the outer database object: awaiting the outer object from inside its own
 * transaction would wait for that transaction to end.
 */
export interface SqlDatabase {
  execute(sql: string, params?: readonly SqlValue[]): Promise<SqlRunResult>;
  query<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  /**
   * Runs `fn` in a transaction: commits when it resolves, rolls back and
   * rethrows when it throws. Called on the handle passed to `fn`, it nests
   * (savepoint) and works against the same transaction. The handle must not
   * be used after `fn` settles.
   */
  transaction<T>(fn: (tx: SqlDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
