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

// TestTaskTransitionsWithExplicitAtIntegration checks that start/pause/complete
// honour a caller-supplied moment (a replayed offline action): elapsed_ms
// accrues from the supplied times, not the server clock, a future moment
// beyond the skew allowance is refused, and updated_at (the sync cursor) is
// always the server time. Skipped unless TEST_DATABASE_URL is set.
func TestTaskTransitionsWithExplicitAtIntegration(t *testing.T) {
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

	email := fmt.Sprintf("task-at-test-%d@example.com", time.Now().UnixNano())
	user, err := s.Register(email, "Task At Test User", "hash")
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

	mustCreate := func(title string) string {
		created, err := s.CreateTask(user.UserID, model.Task{Title: title})
		if err != nil {
			t.Fatalf("CreateTask(%s): %v", title, err)
		}
		return created.TaskID
	}
	get := func(id string) model.Task {
		got, err := s.GetTask(user.UserID, id)
		if err != nil {
			t.Fatalf("GetTask: %v", err)
		}
		return got
	}

	base := time.Now().Add(-2 * time.Hour).UnixMilli()
	const minute = int64(60 * 1000)

	// start at 09:00, pause at 09:30 -> 30 minutes credited, updated_at is server time.
	id := mustCreate("start pause")
	before := time.Now().UnixMilli()
	if err := s.StartTask(user.UserID, id, base); err != nil {
		t.Fatalf("StartTask(at): %v", err)
	}
	got := get(id)
	if got.Status != "in_progress" || got.StartedAt == nil || *got.StartedAt != base {
		t.Errorf("after start: status %q started_at %v, want in_progress at %d", got.Status, got.StartedAt, base)
	}
	if got.UpdatedAt < before {
		t.Errorf("after start: updated_at = %d, want server time >= %d", got.UpdatedAt, before)
	}
	if err := s.PauseTask(user.UserID, id, base+30*minute); err != nil {
		t.Fatalf("PauseTask(at): %v", err)
	}
	got = get(id)
	if got.Status != "pending" || got.StartedAt != nil || got.ElapsedMs != 30*minute {
		t.Errorf("after pause: status %q started_at %v elapsed %d, want pending nil %d", got.Status, got.StartedAt, got.ElapsedMs, 30*minute)
	}
	if got.UpdatedAt < before {
		t.Errorf("after pause: updated_at = %d, want server time >= %d", got.UpdatedAt, before)
	}

	// start, then complete from in_progress: segment added, completed_at = at.
	id = mustCreate("start complete")
	if err := s.StartTask(user.UserID, id, base); err != nil {
		t.Fatalf("StartTask: %v", err)
	}
	if err := s.CompleteTask(user.UserID, id, base+45*minute); err != nil {
		t.Fatalf("CompleteTask(at): %v", err)
	}
	got = get(id)
	if got.Status != "completed" || got.ElapsedMs != 45*minute || got.StartedAt != nil {
		t.Errorf("after complete: status %q elapsed %d started_at %v, want completed %d nil", got.Status, got.ElapsedMs, got.StartedAt, 45*minute)
	}
	if got.CompletedAt == nil || *got.CompletedAt != base+45*minute {
		t.Errorf("after complete: completed_at = %v, want %d", got.CompletedAt, base+45*minute)
	}
	if got.UpdatedAt < before {
		t.Errorf("after complete: updated_at = %d, want server time >= %d", got.UpdatedAt, before)
	}

	// complete from pending: elapsed untouched, completed_at = at.
	id = mustCreate("complete pending")
	if err := s.CompleteTask(user.UserID, id, base); err != nil {
		t.Fatalf("CompleteTask(pending, at): %v", err)
	}
	got = get(id)
	if got.ElapsedMs != 0 || got.CompletedAt == nil || *got.CompletedAt != base {
		t.Errorf("complete from pending: elapsed %d completed_at %v, want 0 and %d", got.ElapsedMs, got.CompletedAt, base)
	}

	// pause with at before started_at clamps the segment to zero.
	id = mustCreate("pause before start")
	if err := s.StartTask(user.UserID, id, base); err != nil {
		t.Fatalf("StartTask: %v", err)
	}
	if err := s.PauseTask(user.UserID, id, base-10*minute); err != nil {
		t.Fatalf("PauseTask(before start): %v", err)
	}
	if got = get(id); got.ElapsedMs != 0 || got.Status != "pending" {
		t.Errorf("pause before start: elapsed %d status %q, want 0 pending", got.ElapsedMs, got.Status)
	}

	// complete with at before started_at also clamps to zero.
	id = mustCreate("complete before start")
	if err := s.StartTask(user.UserID, id, base); err != nil {
		t.Fatalf("StartTask: %v", err)
	}
	if err := s.CompleteTask(user.UserID, id, base-10*minute); err != nil {
		t.Fatalf("CompleteTask(before start): %v", err)
	}
	if got = get(id); got.ElapsedMs != 0 || got.Status != "completed" {
		t.Errorf("complete before start: elapsed %d status %q, want 0 completed", got.ElapsedMs, got.Status)
	}

	// A moment far in the future is refused and changes nothing; so is a
	// negative one. A moment within the skew allowance is accepted.
	id = mustCreate("future")
	tooFar := time.Now().UnixMilli() + MaxClockSkewMs + 60*1000
	if err := s.StartTask(user.UserID, id, tooFar); !errors.Is(err, ErrInvalidTime) {
		t.Errorf("StartTask(far future): err = %v, want ErrInvalidTime", err)
	}
	if err := s.StartTask(user.UserID, id, -5); !errors.Is(err, ErrInvalidTime) {
		t.Errorf("StartTask(negative): err = %v, want ErrInvalidTime", err)
	}
	if got = get(id); got.Status != "pending" || got.StartedAt != nil {
		t.Errorf("after refused start: status %q started_at %v, want untouched pending", got.Status, got.StartedAt)
	}
	if err := s.StartTask(user.UserID, id, time.Now().UnixMilli()+MaxClockSkewMs/2); err != nil {
		t.Errorf("StartTask(within skew): %v", err)
	}
	if err := s.PauseTask(user.UserID, id, tooFar); !errors.Is(err, ErrInvalidTime) {
		t.Errorf("PauseTask(far future): err = %v, want ErrInvalidTime", err)
	}
	if err := s.CompleteTask(user.UserID, id, tooFar); !errors.Is(err, ErrInvalidTime) {
		t.Errorf("CompleteTask(far future): err = %v, want ErrInvalidTime", err)
	}

	// Invalid transitions and missing tasks keep their errors with an explicit at.
	id = mustCreate("invalid")
	if err := s.PauseTask(user.UserID, id, base); !errors.Is(err, ErrInvalidTransition) {
		t.Errorf("PauseTask(pending, at): err = %v, want ErrInvalidTransition", err)
	}
	if err := s.StartTask(user.UserID, id, base); err != nil {
		t.Fatalf("StartTask: %v", err)
	}
	if err := s.StartTask(user.UserID, id, base); !errors.Is(err, ErrInvalidTransition) {
		t.Errorf("StartTask(in_progress, at): err = %v, want ErrInvalidTransition", err)
	}
	if err := s.CompleteTask(user.UserID, id, base+minute); err != nil {
		t.Fatalf("CompleteTask: %v", err)
	}
	if err := s.CompleteTask(user.UserID, id, base+minute); !errors.Is(err, ErrInvalidTransition) {
		t.Errorf("CompleteTask(completed, at): err = %v, want ErrInvalidTransition", err)
	}
	if err := s.StartTask(user.UserID, "tsk_does_not_exist", base); !errors.Is(err, ErrNotFound) {
		t.Errorf("StartTask(unknown, at): err = %v, want ErrNotFound", err)
	}
}
