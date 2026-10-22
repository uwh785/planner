package store

import (
	"context"
	"fmt"
	"time"
)

// SyncChangeRetention is how long a sync push idempotency key is kept. A
// client retrying after a lost response does so within hours, so a month is
// generous; older keys are purged on the owner's next push.
const SyncChangeRetention = 30 * 24 * time.Hour

// TransitionTaskOnce applies a task timer transition (op is "start", "pause"
// or "complete") at most once per (user, changeID). The key insert and the
// transition share one transaction: the key is inserted first with ON CONFLICT
// DO NOTHING, so a replay (or a concurrent submit that lost the race) finds it
// and returns applied == false without touching the task. If the transition
// fails (ErrNotFound, ErrInvalidTransition, ErrInvalidTime, ...) the
// transaction rolls back and no key is recorded, so a later valid retry with
// the same changeID still applies.
func (s *Store) TransitionTaskOnce(userID, changeID, op, taskID string, at int64) (applied bool, err error) {
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`INSERT INTO sync_changes (user_id, change_id, applied_at) VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, change_id) DO NOTHING`,
		userID, changeID, time.Now().UnixMilli())
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}
	switch op {
	case "start":
		err = s.startTask(ctx, tx, userID, taskID, at)
	case "pause":
		err = s.pauseTask(ctx, tx, userID, taskID, at)
	case "complete":
		err = s.completeTask(ctx, tx, userID, taskID, at)
	default:
		err = fmt.Errorf("unknown task transition %q", op)
	}
	if err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

// PurgeSyncChanges deletes the user's idempotency keys older than
// SyncChangeRetention. The user_id prefix of the primary key keeps it cheap.
func (s *Store) PurgeSyncChanges(userID string, now time.Time) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM sync_changes WHERE user_id = $1 AND applied_at < $2`,
		userID, now.Add(-SyncChangeRetention).UnixMilli())
	return err
}
