package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/model"
)

// TestTransitionTaskOnceIntegration covers the push idempotency key: a replay
// of a change_id leaves the task untouched, a failed transition does not
// consume its key, concurrent submits of one key yield exactly one winner, keys
// are scoped per user, and PurgeSyncChanges drops only the caller's old keys.
// Skipped unless TEST_DATABASE_URL is set.
func TestTransitionTaskOnceIntegration(t *testing.T) {
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
	stamp := time.Now().UnixNano()

	newUser := func(label string) string {
		t.Helper()
		u, err := s.Register(fmt.Sprintf("once-%s-%d@example.com", label, stamp), "Once", "hash")
		if err != nil {
			t.Fatalf("register %s: %v", label, err)
		}
		t.Cleanup(func() {
			for _, table := range []string{"sync_changes", "tasks"} {
				if _, err := pool.Exec(context.Background(), `DELETE FROM `+table+` WHERE user_id = $1`, u.UserID); err != nil {
					t.Errorf("cleanup: delete %s: %v", table, err)
				}
			}
			if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, u.UserID); err != nil {
				t.Errorf("cleanup: delete app_users: %v", err)
			}
		})
		return u.UserID
	}
	newTask := func(userID, title string) string {
		t.Helper()
		tk, err := s.CreateTask(userID, model.Task{Title: title})
		if err != nil {
			t.Fatalf("CreateTask: %v", err)
		}
		return tk.TaskID
	}
	keys := func(userID string) int {
		t.Helper()
		var n int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM sync_changes WHERE user_id = $1`, userID).Scan(&n); err != nil {
			t.Fatalf("count keys: %v", err)
		}
		return n
	}

	userA, userB := newUser("a"), newUser("b")
	base := time.Now().Add(-time.Hour).UnixMilli()
	const minute = int64(60 * 1000)

	// Start, pause, complete once each; a second run changes nothing.
	task := newTask(userA, "once")
	steps := []struct {
		op, key string
		at      int64
	}{{"start", "k-start", base}, {"pause", "k-pause", base + 10*minute}, {"complete", "k-done", base + 20*minute}}
	for _, st := range steps {
		if applied, err := s.TransitionTaskOnce(userA, st.key, st.op, task, st.at); err != nil || !applied {
			t.Fatalf("first %s: applied %v err %v, want applied", st.op, applied, err)
		}
	}
	before, _ := s.GetTask(userA, task)
	for _, st := range steps {
		if applied, err := s.TransitionTaskOnce(userA, st.key, st.op, task, st.at+minute); err != nil || applied {
			t.Fatalf("replayed %s: applied %v err %v, want exists", st.op, applied, err)
		}
	}
	after, _ := s.GetTask(userA, task)
	if after.Status != "completed" || after.ElapsedMs != before.ElapsedMs || after.ElapsedMs != 10*minute ||
		after.CompletedAt == nil || *after.CompletedAt != base+20*minute || after.UpdatedAt != before.UpdatedAt {
		t.Errorf("task after replay = %+v, want unchanged from %+v", after, before)
	}

	// A failed transition consumes no key: the same id still applies later.
	task2 := newTask(userA, "retry")
	if applied, err := s.TransitionTaskOnce(userA, "k-retry", "pause", task2, base); !errors.Is(err, ErrInvalidTransition) || applied {
		t.Fatalf("pause on pending: applied %v err %v, want ErrInvalidTransition", applied, err)
	}
	if _, err := s.TransitionTaskOnce(userA, "k-retry", "start", "tsk_missing_"+fmt.Sprint(stamp), base); !errors.Is(err, ErrNotFound) {
		t.Fatalf("start on missing task: err %v, want ErrNotFound", err)
	}
	if _, err := s.TransitionTaskOnce(userA, "k-retry", "start", task2, time.Now().UnixMilli()+MaxClockSkewMs+60000); !errors.Is(err, ErrInvalidTime) {
		t.Fatalf("start far in the future: err %v, want ErrInvalidTime", err)
	}
	if n := keys(userA); n != 3 {
		t.Errorf("keys after failed transitions = %d, want 3 (none consumed)", n)
	}
	if applied, err := s.TransitionTaskOnce(userA, "k-retry", "start", task2, base); err != nil || !applied {
		t.Fatalf("retry with the same id: applied %v err %v, want applied", applied, err)
	}

	// Keys are scoped per user: B may reuse A's string on B's own task.
	taskB := newTask(userB, "other user")
	if applied, err := s.TransitionTaskOnce(userB, "k-start", "start", taskB, base); err != nil || !applied {
		t.Fatalf("other user reusing a key: applied %v err %v, want applied", applied, err)
	}
	// ... and cannot transition A's task, key or not.
	if _, err := s.TransitionTaskOnce(userB, "k-foreign", "start", task2, base); !errors.Is(err, ErrNotFound) {
		t.Errorf("transition of a foreign task: err %v, want ErrNotFound", err)
	}

	// Concurrent submits of one key: exactly one wins.
	task3 := newTask(userA, "race")
	var wg sync.WaitGroup
	var mu sync.Mutex
	won, errs := 0, 0
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			applied, err := s.TransitionTaskOnce(userA, "k-race", "start", task3, base)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				errs++
			} else if applied {
				won++
			}
		}()
	}
	wg.Wait()
	if won != 1 || errs != 0 {
		t.Errorf("8 concurrent submits: %d applied, %d errors, want 1 and 0", won, errs)
	}

	// Purge removes only the caller's keys older than the retention window.
	old := time.Now().Add(-SyncChangeRetention - time.Hour).UnixMilli()
	for _, u := range []string{userA, userB} {
		if _, err := pool.Exec(ctx, `INSERT INTO sync_changes (user_id, change_id, applied_at) VALUES ($1, 'k-old', $2)`, u, old); err != nil {
			t.Fatalf("insert old key: %v", err)
		}
	}
	nA, nB := keys(userA), keys(userB)
	if err := s.PurgeSyncChanges(userA, time.Now()); err != nil {
		t.Fatalf("PurgeSyncChanges: %v", err)
	}
	if keys(userA) != nA-1 || keys(userB) != nB {
		t.Errorf("after purge: A %d (was %d), B %d (was %d), want A-1 and B unchanged", keys(userA), nA, keys(userB), nB)
	}
}
