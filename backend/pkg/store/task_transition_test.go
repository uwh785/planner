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

// TestTaskStateTransitionsIntegration exercises StartTask/PauseTask/CompleteTask
// against a real database: valid transitions, invalid transitions (409-class
// ErrInvalidTransition), and missing/deleted/other-user tasks (ErrNotFound).
// It is skipped unless TEST_DATABASE_URL is set, creates its own throwaway
// user, and cleans up every row it creates.
func TestTaskStateTransitionsIntegration(t *testing.T) {
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

	email := fmt.Sprintf("task-transition-test-%d@example.com", time.Now().UnixNano())
	user, err := s.Register(email, "Task Transition Test User", "hash")
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

	mustCreate := func(title string) model.Task {
		created, err := s.CreateTask(user.UserID, model.Task{Title: title})
		if err != nil {
			t.Fatalf("CreateTask(%s): %v", title, err)
		}
		return created
	}

	// Unknown task ID -> ErrNotFound for all three transitions.
	if err := s.StartTask(user.UserID, "tsk_does_not_exist"); !errors.Is(err, ErrNotFound) {
		t.Errorf("StartTask(unknown): err = %v, want ErrNotFound", err)
	}
	if err := s.PauseTask(user.UserID, "tsk_does_not_exist"); !errors.Is(err, ErrNotFound) {
		t.Errorf("PauseTask(unknown): err = %v, want ErrNotFound", err)
	}
	if err := s.CompleteTask(user.UserID, "tsk_does_not_exist"); !errors.Is(err, ErrNotFound) {
		t.Errorf("CompleteTask(unknown): err = %v, want ErrNotFound", err)
	}

	// A different user cannot transition this user's task -> ErrNotFound.
	pendingTask := mustCreate("pending task")
	if err := s.StartTask("usr_someone_else", pendingTask.TaskID); !errors.Is(err, ErrNotFound) {
		t.Errorf("StartTask(other user): err = %v, want ErrNotFound", err)
	}

	// pending -> in_progress (valid).
	if err := s.StartTask(user.UserID, pendingTask.TaskID); err != nil {
		t.Fatalf("StartTask(pending): unexpected error: %v", err)
	}
	got, err := s.GetTask(user.UserID, pendingTask.TaskID)
	if err != nil {
		t.Fatalf("GetTask after start: %v", err)
	}
	if got.Status != "in_progress" {
		t.Errorf("after StartTask: status = %q, want in_progress", got.Status)
	}
	if got.StartedAt == nil {
		t.Error("after StartTask: started_at = nil, want set")
	}

	// starting an already in_progress task -> ErrInvalidTransition, no change.
	if err := s.StartTask(user.UserID, pendingTask.TaskID); !errors.Is(err, ErrInvalidTransition) {
		t.Errorf("StartTask(already in_progress): err = %v, want ErrInvalidTransition", err)
	}

	// in_progress -> pending (valid, pause).
	if err := s.PauseTask(user.UserID, pendingTask.TaskID); err != nil {
		t.Fatalf("PauseTask(in_progress): unexpected error: %v", err)
	}
	got, err = s.GetTask(user.UserID, pendingTask.TaskID)
	if err != nil {
		t.Fatalf("GetTask after pause: %v", err)
	}
	if got.Status != "pending" {
		t.Errorf("after PauseTask: status = %q, want pending", got.Status)
	}

	// pausing a pending task -> ErrInvalidTransition.
	if err := s.PauseTask(user.UserID, pendingTask.TaskID); !errors.Is(err, ErrInvalidTransition) {
		t.Errorf("PauseTask(already pending): err = %v, want ErrInvalidTransition", err)
	}

	// pending -> completed (valid).
	if err := s.CompleteTask(user.UserID, pendingTask.TaskID); err != nil {
		t.Fatalf("CompleteTask(pending): unexpected error: %v", err)
	}
	got, err = s.GetTask(user.UserID, pendingTask.TaskID)
	if err != nil {
		t.Fatalf("GetTask after complete: %v", err)
	}
	if got.Status != "completed" {
		t.Errorf("after CompleteTask: status = %q, want completed", got.Status)
	}
	if got.CompletedAt == nil {
		t.Error("after CompleteTask: completed_at = nil, want set")
	}

	// starting/pausing/completing an already-completed task -> ErrInvalidTransition, no change.
	if err := s.StartTask(user.UserID, pendingTask.TaskID); !errors.Is(err, ErrInvalidTransition) {
		t.Errorf("StartTask(completed): err = %v, want ErrInvalidTransition", err)
	}
	if err := s.PauseTask(user.UserID, pendingTask.TaskID); !errors.Is(err, ErrInvalidTransition) {
		t.Errorf("PauseTask(completed): err = %v, want ErrInvalidTransition", err)
	}
	if err := s.CompleteTask(user.UserID, pendingTask.TaskID); !errors.Is(err, ErrInvalidTransition) {
		t.Errorf("CompleteTask(completed): err = %v, want ErrInvalidTransition", err)
	}
	final, err := s.GetTask(user.UserID, pendingTask.TaskID)
	if err != nil {
		t.Fatalf("GetTask after invalid transitions: %v", err)
	}
	if final.Status != "completed" {
		t.Errorf("after invalid transitions: status = %q, want unchanged completed", final.Status)
	}

	// in_progress -> completed (valid, second task).
	inProgressTask := mustCreate("in progress task")
	if err := s.StartTask(user.UserID, inProgressTask.TaskID); err != nil {
		t.Fatalf("StartTask(second task): unexpected error: %v", err)
	}
	if err := s.CompleteTask(user.UserID, inProgressTask.TaskID); err != nil {
		t.Fatalf("CompleteTask(in_progress): unexpected error: %v", err)
	}
	got, err = s.GetTask(user.UserID, inProgressTask.TaskID)
	if err != nil {
		t.Fatalf("GetTask after complete from in_progress: %v", err)
	}
	if got.Status != "completed" {
		t.Errorf("after CompleteTask(in_progress): status = %q, want completed", got.Status)
	}

	// deleted task -> ErrNotFound.
	deletedTask := mustCreate("deleted task")
	if err := s.DeleteTask(user.UserID, deletedTask.TaskID); err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}
	if err := s.StartTask(user.UserID, deletedTask.TaskID); !errors.Is(err, ErrNotFound) {
		t.Errorf("StartTask(deleted): err = %v, want ErrNotFound", err)
	}
}
