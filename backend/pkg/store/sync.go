package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"planner/pkg/model"
)

// SyncRow is one entity in a sync pull: the same fields the normal API exposes
// for it, plus a deleted flag so the client can apply tombstones. It wraps the
// model type instead of embedding it because model.Task's MarshalJSON would
// otherwise be promoted and drop the flag (see the comment on
// model.TaskFull.MarshalJSON).
type SyncRow[T any] struct {
	Row     T
	Deleted bool
}

func (r SyncRow[T]) MarshalJSON() ([]byte, error) {
	rowJSON, err := json.Marshal(r.Row)
	if err != nil {
		return nil, err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(rowJSON, &fields); err != nil {
		return nil, err
	}
	if fields["deleted"], err = json.Marshal(r.Deleted); err != nil {
		return nil, err
	}
	return json.Marshal(fields)
}

// SyncTag and SyncTaskTag add the updated_at the normal API never exposes for
// tags and task_tags, which the client needs to order replayed changes.
type SyncTag struct {
	model.Tag
	UpdatedAt int64 `json:"updated_at"`
}

type SyncTaskTag struct {
	model.TaskTag
	UpdatedAt int64 `json:"updated_at"`
}

// SyncChanges is everything one user changed since a cursor. Cursor is the
// server time to send as `since` next time. Every slice is non-nil.
type SyncChanges struct {
	Cursor   int64                         `json:"cursor"`
	Lists    []SyncRow[model.TaskList]     `json:"lists"`
	Tasks    []SyncRow[model.Task]         `json:"tasks"`
	Subtasks []SyncRow[model.Subtask]      `json:"subtasks"`
	Tags     []SyncRow[SyncTag]            `json:"tags"`
	TaskTags []SyncRow[SyncTaskTag]        `json:"task_tags"`
	Classes  []SyncRow[model.ClassSession] `json:"classes"`
	Events   []SyncRow[model.Event]        `json:"events"`
}

// syncRows runs one per-table delta query inside tx. query must select the
// columns scan reads, then the deleted flag, filtered by $1 = user_id and
// $2 = since. It always returns a non-nil slice.
func syncRows[T any](ctx context.Context, tx pgx.Tx, query string, userID string, since int64, scan func(pgx.Rows, *T, *int) error) ([]SyncRow[T], error) {
	rows, err := tx.Query(ctx, query, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []SyncRow[T]{}
	for rows.Next() {
		var item SyncRow[T]
		var deleted int
		if err := scan(rows, &item.Row, &deleted); err != nil {
			return nil, err
		}
		item.Deleted = deleted != 0
		items = append(items, item)
	}
	return items, rows.Err()
}

// SyncChanges returns every row the user owns with updated_at >= since,
// soft-deleted ones included. The bound is inclusive so a row written in the
// same millisecond as the previous cursor is never missed; the client upserts
// idempotently. The cursor is read before the queries run, so a write that
// lands during the read is delivered again next time rather than lost. All
// tables are read in one read-only REPEATABLE READ transaction so related rows
// agree with each other.
func (s *Store) SyncChanges(userID string, since int64) (SyncChanges, error) {
	ctx := context.Background()
	out := SyncChanges{Cursor: time.Now().UnixMilli()}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return SyncChanges{}, err
	}
	// Nothing was written, so rolling back is the same as committing and
	// cannot lose data.
	defer tx.Rollback(ctx)

	if out.Lists, err = syncRows(ctx, tx,
		`SELECT user_id, list_id, name, color, icon, sort_order, updated_at, COALESCE(deleted, 0)
		 FROM task_lists WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, list_id`,
		userID, since,
		func(r pgx.Rows, l *model.TaskList, deleted *int) error {
			return r.Scan(&l.UserID, &l.ListID, &l.Name, &l.Color, &l.Icon, &l.SortOrder, &l.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}
	if out.Tasks, err = syncRows(ctx, tx,
		`SELECT user_id, list_id, task_id, title, description, priority, status, due_date, due_all_day,
		        duration_ms, started_at, elapsed_ms, completed_at, sort_order, updated_at, COALESCE(deleted, 0)
		 FROM tasks WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, task_id`,
		userID, since,
		func(r pgx.Rows, t *model.Task, deleted *int) error {
			return r.Scan(&t.UserID, &t.ListID, &t.TaskID, &t.Title, &t.Description, &t.Priority, &t.Status,
				&t.DueDate, &t.DueAllDay, &t.DurationMs, &t.StartedAt, &t.ElapsedMs, &t.CompletedAt,
				&t.SortOrder, &t.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}
	if out.Subtasks, err = syncRows(ctx, tx,
		`SELECT user_id, task_id, subtask_id, title, completed, sort_order, updated_at, COALESCE(deleted, 0)
		 FROM subtasks WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, subtask_id`,
		userID, since,
		func(r pgx.Rows, st *model.Subtask, deleted *int) error {
			return r.Scan(&st.UserID, &st.TaskID, &st.SubtaskID, &st.Title, &st.Completed, &st.SortOrder, &st.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}
	if out.Tags, err = syncRows(ctx, tx,
		`SELECT user_id, tag_id, name, color, COALESCE(updated_at, 0), COALESCE(deleted, 0)
		 FROM tags WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, tag_id`,
		userID, since,
		func(r pgx.Rows, t *SyncTag, deleted *int) error {
			return r.Scan(&t.UserID, &t.TagID, &t.Name, &t.Color, &t.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}
	if out.TaskTags, err = syncRows(ctx, tx,
		`SELECT user_id, task_id, tag_id, COALESCE(updated_at, 0), COALESCE(deleted, 0)
		 FROM task_tags WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, task_id, tag_id`,
		userID, since,
		func(r pgx.Rows, tt *SyncTaskTag, deleted *int) error {
			return r.Scan(&tt.UserID, &tt.TaskID, &tt.TagID, &tt.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}
	if out.Classes, err = syncRows(ctx, tx,
		`SELECT user_id, class_id, subject, day_of_week, start_minute, end_minute, room, teacher, color,
		        updated_at, COALESCE(deleted, 0)
		 FROM class_sessions WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, class_id`,
		userID, since,
		func(r pgx.Rows, c *model.ClassSession, deleted *int) error {
			return r.Scan(&c.UserID, &c.ClassID, &c.Subject, &c.DayOfWeek, &c.StartMinute, &c.EndMinute,
				&c.Room, &c.Teacher, &c.Color, &c.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}
	if out.Events, err = syncRows(ctx, tx,
		`SELECT `+eventColumns+`, COALESCE(deleted, 0)
		 FROM events WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, event_id`,
		userID, since,
		func(r pgx.Rows, e *model.Event, deleted *int) error {
			return r.Scan(&e.UserID, &e.EventID, &e.Title, &e.Description, &e.Location, &e.StartAt, &e.EndAt,
				&e.AllDay, &e.Color, &e.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}
	return out, nil
}
