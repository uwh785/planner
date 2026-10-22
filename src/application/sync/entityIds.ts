/**
 * Outbox identity of a task/tag link. The backend identifies a link by the
 * pair, so the outbox entity id is `<task_id>:<tag_id>` (ids never contain a
 * colon), and the push body carries `{task_id, tag_id}`.
 */
export const taskTagEntityId = (taskId: string, tagId: string): string =>
  `${taskId}:${tagId}`;
