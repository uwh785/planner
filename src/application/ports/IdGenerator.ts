/** Entity id prefixes, as the backend generates them (store.genID). */
export const ID_PREFIXES = {
  list: 'lst',
  task: 'tsk',
  subtask: 'sub',
  tag: 'tag',
  classSession: 'cls',
  event: 'evt',
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

export interface IdGenerator {
  /** `<prefix>_<16 lowercase hex>`, unique with overwhelming probability. */
  newId(prefix: IdPrefix): string;
  /**
   * Opaque idempotency key for one outbox entry: 1 to 64 visible ASCII
   * characters, the rule the backend enforces on `change_id`.
   */
  newChangeId(): string;
}
