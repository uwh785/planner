package store

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/model"
)

// ErrNotFound is returned by store methods that mutate a single row scoped
// by user_id when no matching row was affected.
var ErrNotFound = errors.New("not found")

// ErrInvalidTransition is returned by task state-transition methods
// (StartTask, PauseTask, CompleteTask) when the task exists but is not in a
// status the requested transition allows.
var ErrInvalidTransition = errors.New("invalid transition")

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func genID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand is expected to always succeed; a failure here means the
		// system's entropy source is broken and IDs cannot be generated
		// safely, so there is no meaningful way to recover.
		panic(fmt.Sprintf("store: failed to read random bytes for ID generation: %v", err))
	}
	return fmt.Sprintf("%s_%08x%08x", prefix, b[:4], b[4:])
}

func clampLimit(limit int) int {
	if limit <= 0 {
		return 50
	}
	if limit > 100 {
		return 100
	}
	return limit
}

// ──────────────────────────── Auth ────────────────────────────

func (s *Store) Register(email, name, passwordHash string) (model.User, error) {
	u := model.User{
		UserID: genID("usr"),
		Email:  email,
		Name:   name,
		Role:   "user",
		Status: "active",
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO app_users (user_id, email, name, password_hash, role, status)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		u.UserID, u.Email, u.Name, passwordHash, u.Role, u.Status,
	)
	return u, err
}

func (s *Store) GetUserByEmailWithHash(email string) (model.User, string, error) {
	var u model.User
	var hash string
	err := s.pool.QueryRow(context.Background(),
		`SELECT user_id, email, name, role, status, password_hash FROM app_users WHERE email = $1`, email,
	).Scan(&u.UserID, &u.Email, &u.Name, &u.Role, &u.Status, &hash)
	return u, hash, err
}

func (s *Store) GetUserByID(userID string) (model.User, error) {
	var u model.User
	err := s.pool.QueryRow(context.Background(),
		`SELECT user_id, email, name, role, status FROM app_users WHERE user_id = $1`, userID,
	).Scan(&u.UserID, &u.Email, &u.Name, &u.Role, &u.Status)
	return u, err
}

// ──────────────────────────── Subscriptions ───────────────────

// GetSubscription returns the stored entitlement row for a user. A user with no
// row is entitled to the free plan, so the zero-value row is returned as-is
// rather than an error: every account predating this table is free.
func (s *Store) GetSubscription(userID string) (model.Subscription, error) {
	var sub model.Subscription
	err := s.pool.QueryRow(context.Background(),
		`SELECT plan, status, started_at, expires_at FROM subscription WHERE user_id = $1`, userID,
	).Scan(&sub.Plan, &sub.Status, &sub.StartedAt, &sub.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Subscription{Plan: "free", Status: "active"}, nil
	}
	if err != nil {
		return model.Subscription{}, err
	}
	return sub, nil
}

// SetSubscription upserts the entitlement row for a user. This is the single
// write path for a plan change, so a payment webhook and a manual promotion
// both go through it.
func (s *Store) SetSubscription(userID, plan, status string, expiresAt *time.Time) error {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO subscription (user_id, plan, status, started_at, expires_at, updated_at)
		 VALUES ($1, $2, $3, now(), $4, now())
		 ON CONFLICT (user_id) DO UPDATE
		   SET plan = EXCLUDED.plan,
		       status = EXCLUDED.status,
		       expires_at = EXCLUDED.expires_at,
		       updated_at = now()`,
		userID, plan, status, expiresAt,
	)
	return err
}

// ──────────────────────────── Usage counts ────────────────────

// CountActiveTasks counts the tasks a user still owns work for: anything not
// completed and not soft-deleted. Completed tasks do not count against the cap
// so a user is never blocked from starting new work by their own history.
func (s *Store) CountActiveTasks(userID string) (int, error) {
	return s.count(context.Background(),
		`SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status <> 'completed' AND deleted = 0`, userID)
}

func (s *Store) CountLists(userID string) (int, error) {
	return s.count(context.Background(),
		`SELECT COUNT(*) FROM task_lists WHERE user_id = $1 AND deleted = 0`, userID)
}

// CountTags counts the tags a user still has: anything not soft-deleted.
// That is the number the Free-plan cap compares against; the storage ceiling
// needs the total including tombstones, see CountTagsUsage.
func (s *Store) CountTags(userID string) (int, error) {
	return s.count(context.Background(),
		`SELECT COUNT(*) FROM tags WHERE user_id = $1 AND deleted = 0`, userID)
}

// CountClasses counts every class session a user owns, including
// soft-deleted ones, for the flat storage ceiling. There is no per-plan
// Limits cap on classes, so unlike tasks and lists there is no separate
// "active" count to compute in the same round trip.
func (s *Store) CountClasses(userID string) (int, error) {
	return s.count(context.Background(),
		`SELECT COUNT(*) FROM class_sessions WHERE user_id = $1`, userID)
}

// CountEvents counts every event a user owns, including soft-deleted ones,
// for the flat storage ceiling. Like classes, events have no per-plan Limits
// cap, so there is no separate "active" count.
func (s *Store) CountEvents(userID string) (int, error) {
	return s.count(context.Background(),
		`SELECT COUNT(*) FROM events WHERE user_id = $1`, userID)
}

// CountSubtasks counts every subtask under one task, including soft-deleted
// ones, for the per-task storage ceiling.
func (s *Store) CountSubtasks(userID, taskID string) (int, error) {
	return s.count(context.Background(),
		`SELECT COUNT(*) FROM subtasks WHERE user_id = $1 AND task_id = $2`, userID, taskID)
}

// TaskUsage is the pair of task counts a create needs: Active is what the
// Free-plan cap compares against (CountActiveTasks' definition), Total is
// every row the user owns, including completed and soft-deleted, which is
// what the flat storage ceiling compares against.
type TaskUsage struct {
	Active int
	Total  int
}

// CountTasksUsage reads Active and Total in one round trip via a FILTER
// clause, since a create needs both the Free-plan check and the storage
// ceiling check and a second full COUNT(*) query would cost the same table
// scan twice for no benefit.
func (s *Store) CountTasksUsage(userID string) (TaskUsage, error) {
	var u TaskUsage
	err := s.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FILTER (WHERE status <> 'completed' AND deleted = 0), COUNT(*)
		 FROM tasks WHERE user_id = $1`, userID,
	).Scan(&u.Active, &u.Total)
	return u, err
}

// ListUsage is the list-count analogue of TaskUsage: Active excludes
// soft-deleted lists (CountLists' definition), Total is every row the user
// owns.
type ListUsage struct {
	Active int
	Total  int
}

// CountListsUsage reads Active and Total in one round trip, for the same
// reason as CountTasksUsage.
func (s *Store) CountListsUsage(userID string) (ListUsage, error) {
	var u ListUsage
	err := s.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FILTER (WHERE deleted = 0), COUNT(*)
		 FROM task_lists WHERE user_id = $1`, userID,
	).Scan(&u.Active, &u.Total)
	return u, err
}

// TagUsage is the tag-count analogue of ListUsage: Active excludes
// soft-deleted tags (CountTags' definition), Total is every row the user
// owns, which is what the flat storage ceiling compares against.
type TagUsage struct {
	Active int
	Total  int
}

// CountTagsUsage reads Active and Total in one round trip, for the same
// reason as CountTasksUsage.
func (s *Store) CountTagsUsage(userID string) (TagUsage, error) {
	var u TagUsage
	err := s.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FILTER (WHERE deleted = 0), COUNT(*)
		 FROM tags WHERE user_id = $1`, userID,
	).Scan(&u.Active, &u.Total)
	return u, err
}

func (s *Store) count(ctx context.Context, q string, args ...any) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, q, args...).Scan(&n)
	return n, err
}

// ──────────────────────────── Task Lists ──────────────────────

func (s *Store) ListTaskLists(userID string) ([]model.TaskList, error) {
	rows, err := s.pool.Query(context.Background(),
		`SELECT l.user_id, l.list_id, l.name, l.color, l.icon, l.sort_order, l.updated_at,
		        COUNT(t.task_id) AS task_count
		 FROM task_lists l
		 LEFT JOIN tasks t ON t.user_id = l.user_id AND t.list_id = l.list_id AND t.deleted = 0
		 WHERE l.user_id = $1 AND l.deleted = 0
		 GROUP BY l.user_id, l.list_id, l.name, l.color, l.icon, l.sort_order, l.updated_at
		 ORDER BY l.sort_order, l.name`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.TaskList
	for rows.Next() {
		var l model.TaskList
		var count int
		if err := rows.Scan(&l.UserID, &l.ListID, &l.Name, &l.Color, &l.Icon, &l.SortOrder, &l.UpdatedAt, &count); err != nil {
			return nil, err
		}
		l.TaskCount = &count
		items = append(items, l)
	}
	return items, rows.Err()
}

func (s *Store) CreateTaskList(userID string, l model.TaskList) (model.TaskList, error) {
	l.UserID = userID
	if l.ListID == "" {
		l.ListID = genID("lst")
	}
	if l.Color == "" {
		l.Color = "#0A84FF"
	}
	if l.Icon == "" {
		l.Icon = "list"
	}
	l.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO task_lists (user_id, list_id, name, color, icon, sort_order, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
		l.UserID, l.ListID, l.Name, l.Color, l.Icon, l.SortOrder, l.UpdatedAt,
	)
	return l, err
}

func (s *Store) UpdateTaskList(userID string, l model.TaskList) error {
	l.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`UPDATE task_lists SET name = $3, color = $4, icon = $5, sort_order = $6, updated_at = $7
		 WHERE user_id = $1 AND list_id = $2 AND deleted = 0`,
		userID, l.ListID, l.Name, l.Color, l.Icon, l.SortOrder, l.UpdatedAt,
	)
	return err
}

func (s *Store) DeleteTaskList(userID, listID string) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE task_lists SET deleted = 1, updated_at = $3 WHERE user_id = $1 AND list_id = $2`,
		userID, listID, time.Now().UnixMilli(),
	)
	return err
}

// ──────────────────────────── Tasks ──────────────────────────

type TaskFilters struct {
	Status string
	ListID string
	Search string
	// From and To filter on due_date as a half-open range [From, To): a task
	// matches when due_date is not null, due_date >= From (if set), and
	// due_date < To (if set).
	From *int64
	To   *int64
}

// nowMsExpr is the SQL expression for the current time in epoch milliseconds,
// matching how due_date is stored.
const nowMsExpr = "EXTRACT(EPOCH FROM NOW()) * 1000"

// DayMs is the number of milliseconds in a day. It is exported so callers
// such as the dashboard handler's rolling "upcoming" window use the same
// value as the overdue-day rollover check below.
const DayMs int64 = 24 * 60 * 60 * 1000

// overdueCondition decides whether a task counts as overdue right now. It
// requires the tasks table to be aliased as t. A timed task (due_all_day =
// false) is overdue as soon as its due_date passes; an all-day task is only
// overdue once its whole calendar day has elapsed (due_date + one day <=
// now). Shared by the `overdue` ListTasks filter and the dashboard's overdue
// count so both apply exactly the same rule.
var overdueCondition = "t.due_date IS NOT NULL AND t.status != 'completed' AND (" +
	"(NOT t.due_all_day AND t.due_date < " + nowMsExpr + ") OR " +
	"(t.due_all_day AND t.due_date + " + strconv.FormatInt(DayMs, 10) + " <= " + nowMsExpr + "))"

func (s *Store) ListTasks(userID string, filters TaskFilters, limit, offset int) ([]model.Task, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}

	where := []string{"t.user_id = $1", "t.deleted = 0"}
	args := []any{userID}
	argIdx := 2

	if filters.Status != "" {
		if filters.Status == "overdue" {
			where = append(where, overdueCondition)
		} else {
			where = append(where, fmt.Sprintf("t.status = $%d", argIdx))
			args = append(args, filters.Status)
			argIdx++
		}
	}

	if filters.ListID != "" {
		where = append(where, fmt.Sprintf("t.list_id = $%d", argIdx))
		args = append(args, filters.ListID)
		argIdx++
	}

	if filters.From != nil {
		where = append(where, fmt.Sprintf("t.due_date IS NOT NULL AND t.due_date >= $%d", argIdx))
		args = append(args, *filters.From)
		argIdx++
	}

	if filters.To != nil {
		where = append(where, fmt.Sprintf("t.due_date IS NOT NULL AND t.due_date < $%d", argIdx))
		args = append(args, *filters.To)
		argIdx++
	}

	if filters.Search != "" {
		terms := strings.Fields(filters.Search)
		for _, term := range terms {
			where = append(where, fmt.Sprintf("(t.title ILIKE $%d OR t.description ILIKE $%d)", argIdx, argIdx))
			args = append(args, "%"+term+"%")
			argIdx++
		}
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	s.pool.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM tasks t WHERE %s", whereClause), args...).Scan(&total)

	limitIdx := argIdx
	offsetIdx := argIdx + 1
	selectQuery := fmt.Sprintf(`
		SELECT t.user_id, t.list_id, t.task_id, t.title, t.description,
		       t.priority, t.status, t.due_date, t.due_all_day, t.duration_ms, t.started_at,
		       t.elapsed_ms, t.completed_at, t.sort_order, t.updated_at,
		       l.name, l.color
		FROM tasks t
		LEFT JOIN task_lists l ON l.user_id = t.user_id AND l.list_id = t.list_id
		WHERE %s
		ORDER BY
		  CASE WHEN t.status = 'in_progress' THEN 0 ELSE 1 END,
		  CASE t.priority WHEN 3 THEN 0 WHEN 2 THEN 1 WHEN 1 THEN 2 ELSE 3 END,
		  COALESCE(t.due_date, 9999999999999),
		  t.sort_order
		LIMIT $%d OFFSET $%d`, whereClause, limitIdx, offsetIdx)

	queryArgs := append(args, limit, offset)
	rows, err := s.pool.Query(ctx, selectQuery, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var tasks []model.Task
	for rows.Next() {
		var t model.Task
		if err := rows.Scan(
			&t.UserID, &t.ListID, &t.TaskID, &t.Title, &t.Description,
			&t.Priority, &t.Status, &t.DueDate, &t.DueAllDay, &t.DurationMs, &t.StartedAt,
			&t.ElapsedMs, &t.CompletedAt, &t.SortOrder, &t.UpdatedAt,
			&t.ListName, &t.ListColor,
		); err != nil {
			return nil, 0, err
		}
		tasks = append(tasks, t)
	}
	return tasks, total, rows.Err()
}

func (s *Store) GetTask(userID, taskID string) (model.Task, error) {
	var t model.Task
	err := s.pool.QueryRow(context.Background(),
		`SELECT t.user_id, t.list_id, t.task_id, t.title, t.description,
		        t.priority, t.status, t.due_date, t.due_all_day, t.duration_ms, t.started_at,
		        t.elapsed_ms, t.completed_at, t.sort_order, t.updated_at,
		        l.name, l.color
		 FROM tasks t
		 LEFT JOIN task_lists l ON l.user_id = t.user_id AND l.list_id = t.list_id
		 WHERE t.user_id = $1 AND t.task_id = $2 AND t.deleted = 0`,
		userID, taskID,
	).Scan(&t.UserID, &t.ListID, &t.TaskID, &t.Title, &t.Description,
		&t.Priority, &t.Status, &t.DueDate, &t.DueAllDay, &t.DurationMs, &t.StartedAt,
		&t.ElapsedMs, &t.CompletedAt, &t.SortOrder, &t.UpdatedAt,
		&t.ListName, &t.ListColor)
	return t, err
}

func (s *Store) GetTaskFull(userID, taskID string) (model.TaskFull, error) {
	t, err := s.GetTask(userID, taskID)
	if err != nil {
		return model.TaskFull{}, err
	}

	result := model.TaskFull{Task: t}

	subtasks, _, err := s.ListSubtasks(userID, taskID, 1000, 0)
	if err == nil {
		result.Subtasks = subtasks
	}

	tags, err := s.ListTaskTags(userID, taskID)
	if err == nil {
		result.Tags = tags
	}

	return result, nil
}

func (s *Store) CreateTask(userID string, t model.Task) (model.Task, error) {
	t.UserID = userID
	if t.TaskID == "" {
		t.TaskID = genID("tsk")
	}
	if t.Status == "" {
		t.Status = "pending"
	}
	t.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO tasks (user_id, list_id, task_id, title, description, priority, status,
		        due_date, due_all_day, duration_ms, started_at, sort_order, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0)`,
		t.UserID, t.ListID, t.TaskID, t.Title, t.Description, t.Priority, t.Status,
		t.DueDate, t.DueAllDay, t.DurationMs, t.StartedAt, t.SortOrder, t.UpdatedAt,
	)
	return t, err
}

// UpdateTask overwrites only the user-editable fields of a task: list_id,
// title, description, priority, due_date, due_all_day, and duration_ms.
// Server-managed fields (status, started_at, elapsed_ms, completed_at) and
// sort_order (never sent by the edit form) are left untouched, since a
// caller-supplied model.Task carries no reliable value for them. It returns
// ErrNotFound if the task does not exist (unknown ID, deleted, or belongs to
// another user).
func (s *Store) UpdateTask(userID string, t model.Task) error {
	t.UpdatedAt = time.Now().UnixMilli()
	tag, err := s.pool.Exec(context.Background(),
		`UPDATE tasks SET list_id = $3, title = $4, description = $5, priority = $6,
		        due_date = $7, due_all_day = $8, duration_ms = $9, updated_at = $10
		 WHERE user_id = $1 AND task_id = $2 AND deleted = 0`,
		userID, t.TaskID, t.ListID, t.Title, t.Description, t.Priority,
		t.DueDate, t.DueAllDay, t.DurationMs, t.UpdatedAt,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteTask(userID, taskID string) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE tasks SET deleted = 1, updated_at = $3 WHERE user_id = $1 AND task_id = $2`,
		userID, taskID, time.Now().UnixMilli(),
	)
	return err
}

// taskTransitionError distinguishes a missing (unknown, deleted, or
// other-user) task from an invalid state transition after a conditional
// state-changing UPDATE affected zero rows. Only a genuine "no rows" lookup
// becomes ErrNotFound; any other GetTask failure (e.g. a lost connection) is
// returned as-is so the caller reports it as a server error, not a 404.
func (s *Store) taskTransitionError(userID, taskID string) error {
	_, err := s.GetTask(userID, taskID)
	if err == nil {
		return ErrInvalidTransition
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

// StartTask transitions a task from pending to in_progress, recording the
// current time as started_at. It returns ErrNotFound if the task does not
// exist (unknown ID, deleted, or belongs to another user), or
// ErrInvalidTransition if it exists but is not pending.
func (s *Store) StartTask(userID, taskID string) error {
	now := time.Now().UnixMilli()
	tag, err := s.pool.Exec(context.Background(),
		`UPDATE tasks SET status = 'in_progress', started_at = $3, updated_at = $4
		 WHERE user_id = $1 AND task_id = $2 AND deleted = 0 AND status = 'pending'`,
		userID, taskID, now, now,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return s.taskTransitionError(userID, taskID)
	}
	return nil
}

// PauseTask transitions a task from in_progress back to pending. The
// just-run segment (now - started_at) is added to the accumulated
// elapsed_ms and started_at is cleared, so the paused state is unambiguous
// and a later StartTask resumes the countdown instead of restarting it. It
// returns ErrNotFound if the task does not exist, or ErrInvalidTransition if
// it exists but is not in_progress.
func (s *Store) PauseTask(userID, taskID string) error {
	now := time.Now().UnixMilli()
	tag, err := s.pool.Exec(context.Background(),
		`UPDATE tasks SET status = 'pending', updated_at = $3,
		        elapsed_ms = elapsed_ms + ($3 - COALESCE(started_at, $3)),
		        started_at = NULL
		 WHERE user_id = $1 AND task_id = $2 AND deleted = 0 AND status = 'in_progress'`,
		userID, taskID, now,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return s.taskTransitionError(userID, taskID)
	}
	return nil
}

// CompleteTask transitions a task from pending or in_progress to completed.
// If it was in_progress, the just-run segment (now - started_at) is added
// to elapsed_ms and started_at is cleared, exactly as PauseTask does; a
// completion from pending leaves the already-accumulated elapsed_ms
// untouched. It returns ErrNotFound if the task does not exist, or
// ErrInvalidTransition if it exists but is already completed.
func (s *Store) CompleteTask(userID, taskID string) error {
	now := time.Now().UnixMilli()
	tag, err := s.pool.Exec(context.Background(),
		`UPDATE tasks SET status = 'completed', completed_at = $3, updated_at = $4,
		        elapsed_ms = elapsed_ms + CASE WHEN status = 'in_progress' THEN $3 - COALESCE(started_at, $3) ELSE 0 END,
		        started_at = NULL
		 WHERE user_id = $1 AND task_id = $2 AND deleted = 0 AND status IN ('pending', 'in_progress')`,
		userID, taskID, now, now,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return s.taskTransitionError(userID, taskID)
	}
	return nil
}

// ──────────────────────────── Subtasks ───────────────────────

func (s *Store) ListSubtasks(userID, taskID string, limit, offset int) ([]model.Subtask, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM subtasks WHERE user_id = $1 AND task_id = $2 AND deleted = 0`,
		userID, taskID,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT user_id, task_id, subtask_id, title, completed, sort_order, updated_at
		 FROM subtasks WHERE user_id = $1 AND task_id = $2 AND deleted = 0
		 ORDER BY sort_order, subtask_id
		 LIMIT $3 OFFSET $4`,
		userID, taskID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.Subtask
	for rows.Next() {
		var st model.Subtask
		if err := rows.Scan(&st.UserID, &st.TaskID, &st.SubtaskID, &st.Title, &st.Completed, &st.SortOrder, &st.UpdatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, st)
	}
	return items, total, rows.Err()
}

func (s *Store) CreateSubtask(userID, taskID string, st model.Subtask) (model.Subtask, error) {
	st.UserID = userID
	st.TaskID = taskID
	if st.SubtaskID == "" {
		st.SubtaskID = genID("sub")
	}
	st.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO subtasks (user_id, task_id, subtask_id, title, completed, sort_order, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
		st.UserID, st.TaskID, st.SubtaskID, st.Title, st.Completed, st.SortOrder, st.UpdatedAt,
	)
	return st, err
}

func (s *Store) UpdateSubtask(userID, taskID string, st model.Subtask) error {
	st.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`UPDATE subtasks SET title = $4, completed = $5, sort_order = $6, updated_at = $7
		 WHERE user_id = $1 AND task_id = $2 AND subtask_id = $3 AND deleted = 0`,
		userID, taskID, st.SubtaskID, st.Title, st.Completed, st.SortOrder, st.UpdatedAt,
	)
	return err
}

func (s *Store) DeleteSubtask(userID, taskID, subtaskID string) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE subtasks SET deleted = 1, updated_at = $4 WHERE user_id = $1 AND task_id = $2 AND subtask_id = $3`,
		userID, taskID, subtaskID, time.Now().UnixMilli(),
	)
	return err
}

// ──────────────────────────── Tags ───────────────────────────

func (s *Store) ListTags(userID string) ([]model.Tag, error) {
	rows, err := s.pool.Query(context.Background(),
		`SELECT user_id, tag_id, name, color FROM tags WHERE user_id = $1 AND deleted = 0 ORDER BY name`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.Tag
	for rows.Next() {
		var t model.Tag
		if err := rows.Scan(&t.UserID, &t.TagID, &t.Name, &t.Color); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

func (s *Store) CreateTag(userID string, t model.Tag) (model.Tag, error) {
	t.UserID = userID
	if t.TagID == "" {
		t.TagID = genID("tag")
	}
	if t.Color == "" {
		t.Color = "#8E8E93"
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO tags (user_id, tag_id, name, color, updated_at, deleted) VALUES ($1, $2, $3, $4, $5, 0)`,
		t.UserID, t.TagID, t.Name, t.Color, time.Now().UnixMilli(),
	)
	return t, err
}

// DeleteTag soft-deletes the tag and tombstones every task link to it, so a
// delta pull sees both the tag and its links disappear.
func (s *Store) DeleteTag(userID, tagID string) error {
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	now := time.Now().UnixMilli()
	if _, err := tx.Exec(ctx,
		`UPDATE tags SET deleted = 1, updated_at = $3 WHERE user_id = $1 AND tag_id = $2`,
		userID, tagID, now,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE task_tags SET deleted = 1, updated_at = $3 WHERE user_id = $1 AND tag_id = $2 AND deleted = 0`,
		userID, tagID, now,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) ListTaskTags(userID, taskID string) ([]model.Tag, error) {
	rows, err := s.pool.Query(context.Background(),
		`SELECT t.user_id, t.tag_id, t.name, t.color
		 FROM task_tags tt
		 JOIN tags t ON t.tag_id = tt.tag_id
		 WHERE tt.user_id = $1 AND tt.task_id = $2 AND tt.deleted = 0 AND t.deleted = 0`,
		userID, taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.Tag
	for rows.Next() {
		var t model.Tag
		if err := rows.Scan(&t.UserID, &t.TagID, &t.Name, &t.Color); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

// AddTaskTag links a tag to a task. An existing link, including a tombstoned
// one, is resurrected (deleted = 0) with a fresh updated_at.
func (s *Store) AddTaskTag(userID, taskID, tagID string) error {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO task_tags (user_id, task_id, tag_id, updated_at, deleted) VALUES ($1, $2, $3, $4, 0)
		 ON CONFLICT (user_id, task_id, tag_id) DO UPDATE SET deleted = 0, updated_at = EXCLUDED.updated_at`,
		userID, taskID, tagID, time.Now().UnixMilli(),
	)
	return err
}

func (s *Store) RemoveTaskTag(userID, taskID, tagID string) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE task_tags SET deleted = 1, updated_at = $4 WHERE user_id = $1 AND task_id = $2 AND tag_id = $3`,
		userID, taskID, tagID, time.Now().UnixMilli(),
	)
	return err
}

// ──────────────────────────── Dashboard ──────────────────────

func (s *Store) GetDashboardSummary(userID string) (model.DashboardSummary, error) {
	ctx := context.Background()
	var ds model.DashboardSummary

	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status = 'pending' AND deleted = 0`, userID,
	).Scan(&ds.Pending)

	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status = 'in_progress' AND deleted = 0`, userID,
	).Scan(&ds.InProgress)

	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND status = 'completed' AND deleted = 0`, userID,
	).Scan(&ds.Completed)

	s.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM tasks t WHERE t.user_id = $1 AND t.deleted = 0 AND %s`, overdueCondition), userID,
	).Scan(&ds.Overdue)

	return ds, nil
}

// ──────────────────────────── Classes ────────────────────────

func (s *Store) ListClasses(userID string, day *int) ([]model.ClassSession, error) {
	query := `SELECT user_id, class_id, subject, day_of_week, start_minute, end_minute,
	                 room, teacher, color, updated_at
	          FROM class_sessions WHERE user_id = $1 AND deleted = 0`
	args := []any{userID}
	if day != nil {
		query += ` AND day_of_week = $2`
		args = append(args, *day)
	}
	query += ` ORDER BY day_of_week, start_minute`

	rows, err := s.pool.Query(context.Background(), query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.ClassSession
	for rows.Next() {
		var c model.ClassSession
		if err := rows.Scan(&c.UserID, &c.ClassID, &c.Subject, &c.DayOfWeek, &c.StartMinute,
			&c.EndMinute, &c.Room, &c.Teacher, &c.Color, &c.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

func (s *Store) GetClass(userID, classID string) (model.ClassSession, error) {
	var c model.ClassSession
	err := s.pool.QueryRow(context.Background(),
		`SELECT user_id, class_id, subject, day_of_week, start_minute, end_minute,
		        room, teacher, color, updated_at
		 FROM class_sessions WHERE user_id = $1 AND class_id = $2 AND deleted = 0`,
		userID, classID,
	).Scan(&c.UserID, &c.ClassID, &c.Subject, &c.DayOfWeek, &c.StartMinute,
		&c.EndMinute, &c.Room, &c.Teacher, &c.Color, &c.UpdatedAt)
	return c, err
}

func (s *Store) CreateClass(userID string, c model.ClassSession) (model.ClassSession, error) {
	c.UserID = userID
	if c.ClassID == "" {
		c.ClassID = genID("cls")
	}
	if c.Color == "" {
		c.Color = "#0A84FF"
	}
	c.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO class_sessions (user_id, class_id, subject, day_of_week, start_minute,
		        end_minute, room, teacher, color, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)`,
		c.UserID, c.ClassID, c.Subject, c.DayOfWeek, c.StartMinute, c.EndMinute,
		c.Room, c.Teacher, c.Color, c.UpdatedAt,
	)
	return c, err
}

func (s *Store) UpdateClass(userID string, c model.ClassSession) error {
	c.UpdatedAt = time.Now().UnixMilli()
	tag, err := s.pool.Exec(context.Background(),
		`UPDATE class_sessions SET subject = $3, day_of_week = $4, start_minute = $5,
		        end_minute = $6, room = $7, teacher = $8, color = $9, updated_at = $10
		 WHERE user_id = $1 AND class_id = $2 AND deleted = 0`,
		userID, c.ClassID, c.Subject, c.DayOfWeek, c.StartMinute, c.EndMinute,
		c.Room, c.Teacher, c.Color, c.UpdatedAt,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteClass(userID, classID string) error {
	tag, err := s.pool.Exec(context.Background(),
		`UPDATE class_sessions SET deleted = 1, updated_at = $3 WHERE user_id = $1 AND class_id = $2 AND deleted = 0`,
		userID, classID, time.Now().UnixMilli(),
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ──────────────────────────── Events ─────────────────────────

const eventColumns = `user_id, event_id, title, description, location, start_at, end_at,
	all_day, color, updated_at`

func scanEvent(row pgx.Row) (model.Event, error) {
	var e model.Event
	err := row.Scan(&e.UserID, &e.EventID, &e.Title, &e.Description, &e.Location,
		&e.StartAt, &e.EndAt, &e.AllDay, &e.Color, &e.UpdatedAt)
	return e, err
}

// ListEvents returns the user's events ordered by start time. When from or to
// is given it returns only the events that overlap [from, to): an event
// starts before to and ends (or, with no end, starts) at or after from.
func (s *Store) ListEvents(userID string, from, to *int64) ([]model.Event, error) {
	query := `SELECT ` + eventColumns + ` FROM events WHERE user_id = $1 AND deleted = 0`
	args := []any{userID}
	if to != nil {
		args = append(args, *to)
		query += fmt.Sprintf(` AND start_at < $%d`, len(args))
	}
	if from != nil {
		args = append(args, *from)
		query += fmt.Sprintf(` AND COALESCE(end_at, start_at) >= $%d`, len(args))
	}
	query += ` ORDER BY start_at, event_id`

	rows, err := s.pool.Query(context.Background(), query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.Event
	for rows.Next() {
		e, err := scanEvent(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	return items, rows.Err()
}

func (s *Store) GetEvent(userID, eventID string) (model.Event, error) {
	return scanEvent(s.pool.QueryRow(context.Background(),
		`SELECT `+eventColumns+` FROM events WHERE user_id = $1 AND event_id = $2 AND deleted = 0`,
		userID, eventID,
	))
}

func (s *Store) CreateEvent(userID string, e model.Event) (model.Event, error) {
	e.UserID = userID
	if e.EventID == "" {
		e.EventID = genID("evt")
	}
	if e.Color == "" {
		e.Color = "#0A84FF"
	}
	e.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO events (user_id, event_id, title, description, location, start_at, end_at,
		        all_day, color, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)`,
		e.UserID, e.EventID, e.Title, e.Description, e.Location, e.StartAt, e.EndAt,
		e.AllDay, e.Color, e.UpdatedAt,
	)
	return e, err
}

func (s *Store) UpdateEvent(userID string, e model.Event) error {
	e.UpdatedAt = time.Now().UnixMilli()
	tag, err := s.pool.Exec(context.Background(),
		`UPDATE events SET title = $3, description = $4, location = $5, start_at = $6,
		        end_at = $7, all_day = $8, color = $9, updated_at = $10
		 WHERE user_id = $1 AND event_id = $2 AND deleted = 0`,
		userID, e.EventID, e.Title, e.Description, e.Location, e.StartAt, e.EndAt,
		e.AllDay, e.Color, e.UpdatedAt,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteEvent(userID, eventID string) error {
	tag, err := s.pool.Exec(context.Background(),
		`UPDATE events SET deleted = 1, updated_at = $3 WHERE user_id = $1 AND event_id = $2 AND deleted = 0`,
		userID, eventID, time.Now().UnixMilli(),
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
