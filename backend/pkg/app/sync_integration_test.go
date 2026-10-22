package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/auth"
	"planner/pkg/model"
	"planner/pkg/store"
)

// syncGet runs the sync handler as the given user and returns the status and
// the raw body.
func syncGet(a *App, userID, query string) (int, string) {
	req := httptest.NewRequest(http.MethodGet, "/api/sync"+query, nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.UserKey, &auth.Claims{UserID: userID}))
	rec := httptest.NewRecorder()
	a.syncPull(rec, req)
	return rec.Code, rec.Body.String()
}

// TestSyncPullRejectsBadSince needs no database: a bad cursor is refused
// before the store is touched.
func TestSyncPullRejectsBadSince(t *testing.T) {
	a := New(nil, nil)
	for _, q := range []string{"?since=-1", "?since=abc", "?since=1.5", "?since=99999999999999999999"} {
		code, body := syncGet(a, "usr_x", q)
		if code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", q, code)
		}
		if !strings.Contains(body, `"error"`) {
			t.Errorf("%s: body %q, want an error envelope", q, body)
		}
	}
}

// TestSyncPullIntegration drives GET /api/sync the way the offline client
// does: the envelope carries a cursor and seven arrays that are never null,
// rows carry a deleted flag, tombstones are delivered, and another user's rows
// never appear. It is skipped unless TEST_DATABASE_URL is set and cleans up
// after itself.
func TestSyncPullIntegration(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	// Registered before the row-cleanup below so it runs last (t.Cleanup is
	// LIFO): the pool must still be open when that cleanup deletes its rows.
	t.Cleanup(pool.Close)

	s := store.New(pool)
	a := New(s, nil)

	stamp := time.Now().UnixNano()
	owner, err := s.Register(fmt.Sprintf("sync-app-owner-%d@example.com", stamp), "Owner", "hash")
	if err != nil {
		t.Fatalf("register owner: %v", err)
	}
	other, err := s.Register(fmt.Sprintf("sync-app-other-%d@example.com", stamp), "Other", "hash")
	if err != nil {
		t.Fatalf("register other: %v", err)
	}
	t.Cleanup(func() {
		for _, u := range []string{owner.UserID, other.UserID} {
			for _, table := range []string{"task_tags", "tags", "subtasks", "tasks", "task_lists", "class_sessions", "events"} {
				if _, err := pool.Exec(context.Background(), `DELETE FROM `+table+` WHERE user_id = $1`, u); err != nil {
					t.Errorf("cleanup: delete %s: %v", table, err)
				}
			}
			if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, u); err != nil {
				t.Errorf("cleanup: delete app_users: %v", err)
			}
		}
	})

	// A user with nothing gets seven empty arrays, never null.
	code, body := syncGet(a, owner.UserID, "")
	if code != http.StatusOK {
		t.Fatalf("empty pull: status %d, body %s", code, body)
	}
	for _, key := range []string{"lists", "tasks", "subtasks", "tags", "task_tags", "classes", "events"} {
		if !strings.Contains(body, `"`+key+`":[]`) {
			t.Errorf("empty pull: %s is not [] in %s", key, body)
		}
	}

	_, err = s.CreateTask(owner.UserID, model.Task{Title: "mine"})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	gone, err := s.CreateTask(owner.UserID, model.Task{Title: "gone"})
	if err != nil {
		t.Fatalf("CreateTask(gone): %v", err)
	}
	if err := s.DeleteTask(owner.UserID, gone.TaskID); err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}
	if _, err := s.CreateTask(other.UserID, model.Task{Title: "theirs"}); err != nil {
		t.Fatalf("CreateTask(other): %v", err)
	}

	before := time.Now().UnixMilli()
	code, body = syncGet(a, owner.UserID, "?since=0")
	if code != http.StatusOK {
		t.Fatalf("pull: status %d, body %s", code, body)
	}
	var out struct {
		Data struct {
			Cursor int64 `json:"cursor"`
			Tasks  []struct {
				TaskID  string  `json:"task_id"`
				UserID  string  `json:"user_id"`
				ListID  *string `json:"list_id"`
				Deleted *bool   `json:"deleted"`
			} `json:"tasks"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &out); err != nil {
		t.Fatalf("decode %q: %v", body, err)
	}
	if out.Data.Cursor < before-1000 || out.Data.Cursor > time.Now().UnixMilli() {
		t.Errorf("cursor = %d, want a recent server time in ms", out.Data.Cursor)
	}
	if !strings.Contains(body, `"list_id":null`) {
		t.Errorf("body %s: want list_id serialized as null for a task without a list", body)
	}
	if len(out.Data.Tasks) != 2 {
		t.Fatalf("tasks = %+v, want the owner's 2 tasks", out.Data.Tasks)
	}
	for _, r := range out.Data.Tasks {
		if r.UserID != owner.UserID {
			t.Errorf("task %s belongs to %s, leaked another user's row", r.TaskID, r.UserID)
		}
		if r.Deleted == nil {
			t.Fatalf("task %s: deleted missing from %s", r.TaskID, body)
		}
		if want := r.TaskID == gone.TaskID; *r.Deleted != want {
			t.Errorf("task %s: deleted = %v, want %v", r.TaskID, *r.Deleted, want)
		}
	}

	// A cursor past every row returns an empty delta but still a cursor.
	code, body = syncGet(a, owner.UserID, fmt.Sprintf("?since=%d", out.Data.Cursor+3600_000))
	if code != http.StatusOK || !strings.Contains(body, `"tasks":[]`) || !strings.Contains(body, `"cursor":`) {
		t.Errorf("future cursor: status %d, body %s, want 200 with empty arrays", code, body)
	}
}
