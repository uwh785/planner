package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/model"
)

// TestUpdateTaskEditableFieldsOnlyIntegration verifies that UpdateTask writes
// only the user-editable fields (list_id, title, description, priority,
// due_date, due_all_day, duration_ms) and never touches the server-managed
// status/started_at/elapsed_ms/completed_at or sort_order — mirroring what
// the real edit form sends, which omits all of those fields. It is skipped
// unless TEST_DATABASE_URL is set.
func TestUpdateTaskEditableFieldsOnlyIntegration(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)

	s := New(pool)

	email := fmt.Sprintf("task-update-test-%d@example.com", time.Now().UnixNano())
	user, err := s.Register(email, "Task Update Test User", "hash")
	if err != nil {
		t.Fatalf("register throwaway user: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM tasks WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete tasks: %v", err)
		}
		if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete app_users: %v", err)
		}
	})

	task, err := s.CreateTask(user.UserID, model.Task{Title: "original title"})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if err := s.StartTask(user.UserID, task.TaskID); err != nil {
		t.Fatalf("StartTask: %v", err)
	}
	// Give the row a non-zero sort_order directly, since nothing in the
	// normal API surface sets it, to prove UpdateTask does not zero it.
	if _, err := pool.Exec(context.Background(),
		`UPDATE tasks SET sort_order = 5 WHERE user_id = $1 AND task_id = $2`,
		user.UserID, task.TaskID,
	); err != nil {
		t.Fatalf("seed sort_order: %v", err)
	}

	before, err := s.GetTask(user.UserID, task.TaskID)
	if err != nil {
		t.Fatalf("GetTask before update: %v", err)
	}
	if before.Status != "in_progress" || before.StartedAt == nil {
		t.Fatalf("precondition: task not started: status=%q started_at=%v", before.Status, before.StartedAt)
	}

	// Simulate the real edit form request: only editable fields set, exactly
	// as TaskForm.svelte sends them. Status/StartedAt/ElapsedMs/CompletedAt/
	// SortOrder are left at their Go zero values, just like a body that omits
	// those JSON keys.
	newDueDate := int64(999999)
	newDuration := int64(600000)
	edit := model.Task{
		TaskID:      task.TaskID,
		Title:       "edited title",
		Description: "edited description",
		Priority:    2,
		DueDate:     &newDueDate,
		DueAllDay:   true,
		DurationMs:  &newDuration,
	}
	if err := s.UpdateTask(user.UserID, edit); err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	after, err := s.GetTask(user.UserID, task.TaskID)
	if err != nil {
		t.Fatalf("GetTask after update: %v", err)
	}

	if after.Status != "in_progress" {
		t.Errorf("status = %q, want unchanged in_progress", after.Status)
	}
	if after.StartedAt == nil || *after.StartedAt != *before.StartedAt {
		t.Errorf("started_at = %v, want unchanged %v", after.StartedAt, before.StartedAt)
	}
	if after.ElapsedMs != before.ElapsedMs {
		t.Errorf("elapsed_ms = %d, want unchanged %d", after.ElapsedMs, before.ElapsedMs)
	}
	if after.CompletedAt != nil {
		t.Errorf("completed_at = %v, want still nil", after.CompletedAt)
	}
	if after.SortOrder != 5 {
		t.Errorf("sort_order = %d, want unchanged 5", after.SortOrder)
	}

	if after.Title != "edited title" {
		t.Errorf("title = %q, want %q", after.Title, "edited title")
	}
	if after.Description != "edited description" {
		t.Errorf("description = %q, want %q", after.Description, "edited description")
	}
	if after.Priority != 2 {
		t.Errorf("priority = %d, want 2", after.Priority)
	}
	if after.DueDate == nil || *after.DueDate != newDueDate {
		t.Errorf("due_date = %v, want %d", after.DueDate, newDueDate)
	}
	if !after.DueAllDay {
		t.Error("due_all_day = false, want true")
	}
	if after.DurationMs == nil || *after.DurationMs != newDuration {
		t.Errorf("duration_ms = %v, want %d", after.DurationMs, newDuration)
	}
}

// TestUpdateTaskUnknownIDReturnsNotFoundIntegration verifies UpdateTask
// returns ErrNotFound (rather than a silent no-op success) for an unknown
// task ID. It is skipped unless TEST_DATABASE_URL is set.
func TestUpdateTaskUnknownIDReturnsNotFoundIntegration(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)

	s := New(pool)

	email := fmt.Sprintf("task-update-notfound-test-%d@example.com", time.Now().UnixNano())
	user, err := s.Register(email, "Task Update NotFound Test User", "hash")
	if err != nil {
		t.Fatalf("register throwaway user: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete app_users: %v", err)
		}
	})

	err = s.UpdateTask(user.UserID, model.Task{TaskID: "tsk_does_not_exist", Title: "whatever"})
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("UpdateTask(unknown): err = %v, want ErrNotFound", err)
	}
}
