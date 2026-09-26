package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/model"
	"planner/pkg/plan"
)

// newTestStore connects to TEST_DATABASE_URL and registers a throwaway user
// that is removed on cleanup. Every row the test creates is deleted too.
func newTestStore(t *testing.T) (*Store, *pgxpool.Pool, model.User) {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	// Registered first so it runs last: the pool must still be open when the
	// row cleanup below deletes its rows (t.Cleanup is LIFO).
	t.Cleanup(pool.Close)

	s := New(pool)
	email := fmt.Sprintf("sub-test-%d@example.com", time.Now().UnixNano())
	user, err := s.Register(email, "Sub Test User", "hash")
	if err != nil {
		t.Fatalf("register throwaway user: %v", err)
	}
	t.Cleanup(func() {
		// subscription rows go away via ON DELETE CASCADE on app_users.
		if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete app_users: %v", err)
		}
	})
	return s, pool, user
}

// TestSubscriptionDefaultsToFree covers the upgrade path for accounts that
// predate the subscription table: no row must still read as free, not an error.
func TestSubscriptionDefaultsToFree(t *testing.T) {
	s, _, user := newTestStore(t)

	sub, err := s.GetSubscription(user.UserID)
	if err != nil {
		t.Fatalf("GetSubscription: %v", err)
	}
	if sub.Plan != "free" {
		t.Errorf("plan = %q, want free", sub.Plan)
	}
	if sub.Status != "active" {
		t.Errorf("status = %q, want active", sub.Status)
	}
	if sub.ExpiresAt != nil {
		t.Errorf("expires_at = %v, want nil", *sub.ExpiresAt)
	}
	if got := plan.Effective(plan.Subscription{Plan: plan.Plan(sub.Plan), Status: sub.Status, ExpiresAt: sub.ExpiresAt}, time.Now()); got != plan.Free {
		t.Errorf("Effective = %q, want free", got)
	}
}

func TestSetSubscriptionRoundTrip(t *testing.T) {
	s, _, user := newTestStore(t)

	expires := time.Now().Add(365 * 24 * time.Hour).Truncate(time.Second)
	if err := s.SetSubscription(user.UserID, "pro", "active", &expires); err != nil {
		t.Fatalf("SetSubscription: %v", err)
	}

	sub, err := s.GetSubscription(user.UserID)
	if err != nil {
		t.Fatalf("GetSubscription: %v", err)
	}
	if sub.Plan != "pro" || sub.Status != "active" {
		t.Errorf("got plan=%q status=%q, want pro/active", sub.Plan, sub.Status)
	}
	if sub.ExpiresAt == nil {
		t.Fatal("expires_at = nil, want a year out")
	}
	if got := plan.Effective(plan.Subscription{Plan: plan.Plan(sub.Plan), Status: sub.Status, ExpiresAt: sub.ExpiresAt}, time.Now()); got != plan.Pro {
		t.Errorf("Effective = %q, want pro", got)
	}

	// Re-activating must upsert, not duplicate: user_id is the primary key.
	if err := s.SetSubscription(user.UserID, "free", "cancelled", nil); err != nil {
		t.Fatalf("SetSubscription downgrade: %v", err)
	}
	sub, err = s.GetSubscription(user.UserID)
	if err != nil {
		t.Fatalf("GetSubscription after downgrade: %v", err)
	}
	if sub.Plan != "free" || sub.Status != "cancelled" {
		t.Errorf("got plan=%q status=%q, want free/cancelled", sub.Plan, sub.Status)
	}
}

// TestSetSubscriptionRejectsInvalidPlan asserts the CHECK constraints hold at
// the database level, not only in Go.
func TestSetSubscriptionRejectsInvalidPlan(t *testing.T) {
	s, _, user := newTestStore(t)

	for _, tc := range []struct{ plan, status string }{
		{"enterprise", "active"},
		{"pro", "trialing"},
	} {
		if err := s.SetSubscription(user.UserID, tc.plan, tc.status, nil); err == nil {
			t.Errorf("SetSubscription(plan=%q, status=%q) succeeded, want constraint violation", tc.plan, tc.status)
		}
	}
}

// TestCountActiveTasks pins the definition the Free cap relies on: pending and
// in-progress count, completed and soft-deleted do not.
func TestCountActiveTasks(t *testing.T) {
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

	if n, err := s.CountActiveTasks(user.UserID); err != nil || n != 0 {
		t.Fatalf("empty user: got %d (err %v), want 0", n, err)
	}

	insert("pending", 0)
	insert("pending", 0)
	insert("in_progress", 0)
	insert("completed", 0)
	insert("pending", 1)

	if n, err := s.CountActiveTasks(user.UserID); err != nil {
		t.Fatalf("CountActiveTasks: %v", err)
	} else if n != 3 {
		t.Errorf("active tasks = %d, want 3 (2 pending + 1 in_progress)", n)
	}
}

func TestCountListsAndTags(t *testing.T) {
	s, pool, user := newTestStore(t)
	t.Cleanup(func() {
		for _, q := range []string{`DELETE FROM tags WHERE user_id = $1`, `DELETE FROM task_lists WHERE user_id = $1`} {
			if _, err := pool.Exec(context.Background(), q, user.UserID); err != nil {
				t.Errorf("cleanup: %v", err)
			}
		}
	})

	ctx := context.Background()
	if _, err := pool.Exec(ctx,
		`INSERT INTO task_lists (user_id, list_id, name, deleted) VALUES ($1, $2, 'l', 0), ($1, $3, 'l', 0), ($1, $4, 'l', 1)`,
		user.UserID, genID("lst"), genID("lst"), genID("lst"),
	); err != nil {
		t.Fatalf("insert lists: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO tags (user_id, tag_id, name) VALUES ($1, $2, 'x'), ($1, $3, 'y')`,
		user.UserID, genID("tag"), genID("tag"),
	); err != nil {
		t.Fatalf("insert tags: %v", err)
	}

	if n, err := s.CountLists(user.UserID); err != nil {
		t.Fatalf("CountLists: %v", err)
	} else if n != 2 {
		t.Errorf("lists = %d, want 2 (soft-deleted excluded)", n)
	}
	if n, err := s.CountTags(user.UserID); err != nil {
		t.Fatalf("CountTags: %v", err)
	} else if n != 2 {
		t.Errorf("tags = %d, want 2", n)
	}
}

// TestCountsAreScopedToUser guards the tenant boundary: one user's usage must
// never push another user over their cap.
func TestCountsAreScopedToUser(t *testing.T) {
	s, pool, first := newTestStore(t)

	ctx := context.Background()
	secondEmail := fmt.Sprintf("sub-test-b-%d@example.com", time.Now().UnixNano())
	second, err := s.Register(secondEmail, "Other User", "hash")
	if err != nil {
		t.Fatalf("register second user: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(ctx, `DELETE FROM tasks WHERE user_id = $1`, first.UserID); err != nil {
			t.Errorf("cleanup: delete first user tasks: %v", err)
		}
		if _, err := pool.Exec(ctx, `DELETE FROM app_users WHERE user_id = $1`, second.UserID); err != nil {
			t.Errorf("cleanup: delete second user: %v", err)
		}
	})

	for i := 0; i < 5; i++ {
		if _, err := pool.Exec(ctx,
			`INSERT INTO tasks (user_id, task_id, title, status, deleted) VALUES ($1, $2, 't', 'pending', 0)`,
			first.UserID, genID("tsk"),
		); err != nil {
			t.Fatalf("insert task: %v", err)
		}
	}

	if n, err := s.CountActiveTasks(first.UserID); err != nil || n != 5 {
		t.Errorf("first user active = %d (err %v), want 5", n, err)
	}
	if n, err := s.CountActiveTasks(second.UserID); err != nil || n != 0 {
		t.Errorf("second user active = %d (err %v), want 0", n, err)
	}
}
