package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/model"
)

// TestTaskElapsedAccumulationIntegration exercises the accumulated elapsed_ms
// bookkeeping across start/pause/start/complete: pausing (or completing from
// in_progress) must add the just-run segment (now - started_at) to elapsed_ms
// and clear started_at, and starting again must resume from that accumulated
// base rather than restarting the countdown. It is skipped unless
// TEST_DATABASE_URL is set, creates its own throwaway user, and cleans up
// every row it creates.
func TestTaskElapsedAccumulationIntegration(t *testing.T) {
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

	email := fmt.Sprintf("task-elapsed-test-%d@example.com", time.Now().UnixNano())
	user, err := s.Register(email, "Task Elapsed Test User", "hash")
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

	durationMs := int64(10 * 60 * 1000) // 10 minutes
	created, err := s.CreateTask(user.UserID, model.Task{Title: "10 minute task", DurationMs: &durationMs})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	// backdateStartedAt rewrites started_at as if the task had actually been
	// running for `ago` already, so the test does not need to sleep for real.
	backdateStartedAt := func(taskID string, ago time.Duration) {
		backdated := time.Now().Add(-ago).UnixMilli()
		if _, err := pool.Exec(context.Background(),
			`UPDATE tasks SET started_at = $3 WHERE user_id = $1 AND task_id = $2`,
			user.UserID, taskID, backdated,
		); err != nil {
			t.Fatalf("backdate started_at: %v", err)
		}
	}

	const tolerance = int64(2000) // ms, generous for test execution jitter

	// pending -> in_progress -> (3 min later) -> pause: elapsed_ms ~= 3 min.
	if err := s.StartTask(user.UserID, created.TaskID); err != nil {
		t.Fatalf("StartTask: %v", err)
	}
	backdateStartedAt(created.TaskID, 3*time.Minute)
	if err := s.PauseTask(user.UserID, created.TaskID); err != nil {
		t.Fatalf("PauseTask: %v", err)
	}

	afterPause, err := s.GetTask(user.UserID, created.TaskID)
	if err != nil {
		t.Fatalf("GetTask after pause: %v", err)
	}
	if afterPause.StartedAt != nil {
		t.Errorf("after PauseTask: started_at = %v, want nil (paused state must be unambiguous)", *afterPause.StartedAt)
	}
	wantElapsed := int64(3 * 60 * 1000)
	if diff := afterPause.ElapsedMs - wantElapsed; diff < -tolerance || diff > tolerance {
		t.Errorf("after PauseTask: elapsed_ms = %d, want ~%d (+/- %dms)", afterPause.ElapsedMs, wantElapsed, tolerance)
	}
	remainingAfterPause := durationMs - afterPause.ElapsedMs
	wantRemaining := int64(7 * 60 * 1000)
	if diff := remainingAfterPause - wantRemaining; diff < -tolerance || diff > tolerance {
		t.Errorf("after PauseTask: duration-elapsed = %d, want ~%d (+/- %dms) i.e. 7 minutes remaining, not a reset 10", remainingAfterPause, wantRemaining, tolerance)
	}

	// resume: start again must keep the accumulated elapsed_ms as the base.
	if err := s.StartTask(user.UserID, created.TaskID); err != nil {
		t.Fatalf("StartTask (resume): %v", err)
	}
	afterResume, err := s.GetTask(user.UserID, created.TaskID)
	if err != nil {
		t.Fatalf("GetTask after resume: %v", err)
	}
	if afterResume.ElapsedMs != afterPause.ElapsedMs {
		t.Errorf("after resuming StartTask: elapsed_ms = %d, want unchanged %d", afterResume.ElapsedMs, afterPause.ElapsedMs)
	}
	if afterResume.StartedAt == nil {
		t.Fatal("after resuming StartTask: started_at = nil, want set")
	}

	// (2 more min later) -> complete from in_progress: elapsed_ms ~= 5 min total.
	backdateStartedAt(created.TaskID, 2*time.Minute)
	if err := s.CompleteTask(user.UserID, created.TaskID); err != nil {
		t.Fatalf("CompleteTask: %v", err)
	}
	afterComplete, err := s.GetTask(user.UserID, created.TaskID)
	if err != nil {
		t.Fatalf("GetTask after complete: %v", err)
	}
	if afterComplete.StartedAt != nil {
		t.Errorf("after CompleteTask: started_at = %v, want nil", *afterComplete.StartedAt)
	}
	wantTotalElapsed := int64(5 * 60 * 1000)
	if diff := afterComplete.ElapsedMs - wantTotalElapsed; diff < -tolerance || diff > tolerance {
		t.Errorf("after CompleteTask: elapsed_ms = %d, want ~%d (+/- %dms)", afterComplete.ElapsedMs, wantTotalElapsed, tolerance)
	}

	// completing directly from pending (never started) must not add elapsed time.
	untouched, err := s.CreateTask(user.UserID, model.Task{Title: "never started task", DurationMs: &durationMs})
	if err != nil {
		t.Fatalf("CreateTask(untouched): %v", err)
	}
	if err := s.CompleteTask(user.UserID, untouched.TaskID); err != nil {
		t.Fatalf("CompleteTask(pending): %v", err)
	}
	untouchedAfter, err := s.GetTask(user.UserID, untouched.TaskID)
	if err != nil {
		t.Fatalf("GetTask(untouched) after complete: %v", err)
	}
	if untouchedAfter.ElapsedMs != 0 {
		t.Errorf("CompleteTask(pending): elapsed_ms = %d, want 0", untouchedAfter.ElapsedMs)
	}
}
