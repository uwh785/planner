package store

import (
	"context"
	"testing"
)

// TestCountTasksUsageCountsEverything pins the definition the flat storage
// ceiling relies on: Total counts every row the user owns, including
// completed and soft-deleted tasks, while Active keeps CountActiveTasks'
// narrower definition so the Free-plan cap is unaffected.
func TestCountTasksUsageCountsEverything(t *testing.T) {
	s, pool, user := newTestStore(t)
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM tasks WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete tasks: %v", err)
		}
	})

	ctx := context.Background()
	insert := func(status string, deleted int) {
		t.Helper()
		_, err := pool.Exec(ctx,
			`INSERT INTO tasks (user_id, task_id, title, status, deleted)
			 VALUES ($1, $2, 't', $3, $4)`,
			user.UserID, genID("tsk"), status, deleted,
		)
		if err != nil {
			t.Fatalf("insert %s task (deleted=%d): %v", status, deleted, err)
		}
	}

	insert("pending", 0)
	insert("in_progress", 0)
	insert("completed", 0)
	insert("pending", 1)
	insert("completed", 1)

	usage, err := s.CountTasksUsage(user.UserID)
	if err != nil {
		t.Fatalf("CountTasksUsage: %v", err)
	}
	if usage.Active != 2 {
		t.Errorf("Active = %d, want 2 (pending + in_progress, non-deleted)", usage.Active)
	}
	if usage.Total != 5 {
		t.Errorf("Total = %d, want 5 (every row, completed and deleted included)", usage.Total)
	}
}

// TestCountListsUsageCountsEverything is the list analogue of
// TestCountTasksUsageCountsEverything.
func TestCountListsUsageCountsEverything(t *testing.T) {
	s, pool, user := newTestStore(t)
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM task_lists WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete lists: %v", err)
		}
	})

	ctx := context.Background()
	if _, err := pool.Exec(ctx,
		`INSERT INTO task_lists (user_id, list_id, name, deleted) VALUES ($1, $2, 'l', 0), ($1, $3, 'l', 0), ($1, $4, 'l', 1)`,
		user.UserID, genID("lst"), genID("lst"), genID("lst"),
	); err != nil {
		t.Fatalf("insert lists: %v", err)
	}

	usage, err := s.CountListsUsage(user.UserID)
	if err != nil {
		t.Fatalf("CountListsUsage: %v", err)
	}
	if usage.Active != 2 {
		t.Errorf("Active = %d, want 2 (soft-deleted excluded)", usage.Active)
	}
	if usage.Total != 3 {
		t.Errorf("Total = %d, want 3 (every row)", usage.Total)
	}
}

// TestCountClassesCountsSoftDeleted guards the point of the class ceiling:
// deleting a class must not free up room, since deleted is soft.
func TestCountClassesCountsSoftDeleted(t *testing.T) {
	s, pool, user := newTestStore(t)
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM class_sessions WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete class_sessions: %v", err)
		}
	})

	ctx := context.Background()
	insert := func(deleted int) {
		t.Helper()
		_, err := pool.Exec(ctx,
			`INSERT INTO class_sessions (user_id, class_id, subject, day_of_week, start_minute, end_minute, deleted)
			 VALUES ($1, $2, 'MATH', 1, 480, 540, $3)`,
			user.UserID, genID("cls"), deleted,
		)
		if err != nil {
			t.Fatalf("insert class (deleted=%d): %v", deleted, err)
		}
	}
	insert(0)
	insert(0)
	insert(1)

	n, err := s.CountClasses(user.UserID)
	if err != nil {
		t.Fatalf("CountClasses: %v", err)
	}
	if n != 3 {
		t.Errorf("CountClasses = %d, want 3 (soft-deleted included)", n)
	}
}

// TestCountSubtasksScopedToTaskAndCountsSoftDeleted guards both dimensions of
// the subtask ceiling: it is per task, not per user, and it counts
// soft-deleted rows so completing/deleting subtasks cannot reopen room.
func TestCountSubtasksScopedToTaskAndCountsSoftDeleted(t *testing.T) {
	s, pool, user := newTestStore(t)
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM subtasks WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete subtasks: %v", err)
		}
		if _, err := pool.Exec(context.Background(), `DELETE FROM tasks WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete tasks: %v", err)
		}
	})

	ctx := context.Background()
	taskA := genID("tsk")
	taskB := genID("tsk")
	for _, id := range []string{taskA, taskB} {
		if _, err := pool.Exec(ctx,
			`INSERT INTO tasks (user_id, task_id, title, status, deleted) VALUES ($1, $2, 't', 'pending', 0)`,
			user.UserID, id,
		); err != nil {
			t.Fatalf("insert task %s: %v", id, err)
		}
	}

	insertSubtask := func(taskID string, deleted int) {
		t.Helper()
		_, err := pool.Exec(ctx,
			`INSERT INTO subtasks (user_id, task_id, subtask_id, title, deleted) VALUES ($1, $2, $3, 's', $4)`,
			user.UserID, taskID, genID("sub"), deleted,
		)
		if err != nil {
			t.Fatalf("insert subtask under %s (deleted=%d): %v", taskID, deleted, err)
		}
	}
	insertSubtask(taskA, 0)
	insertSubtask(taskA, 0)
	insertSubtask(taskA, 1)
	insertSubtask(taskB, 0)

	if n, err := s.CountSubtasks(user.UserID, taskA); err != nil || n != 3 {
		t.Errorf("CountSubtasks(taskA) = %d (err %v), want 3 (soft-deleted included)", n, err)
	}
	if n, err := s.CountSubtasks(user.UserID, taskB); err != nil || n != 1 {
		t.Errorf("CountSubtasks(taskB) = %d (err %v), want 1", n, err)
	}
}
