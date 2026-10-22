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
	"planner/pkg/store"
)

// TestIdempotentCreateHandlersIntegration drives the create handlers the way
// an offline client replays them: a client-supplied ID is kept, a replay
// returns 200 with the stored row, a collision with another user's ID or a
// soft-deleted row is a 409 that leaks nothing, and the replay check runs
// before the plan cap so an already-applied create never turns into a 402.
// It is skipped unless TEST_DATABASE_URL is set and cleans up after itself.
func TestIdempotentCreateHandlersIntegration(t *testing.T) {
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
	owner, err := s.Register(fmt.Sprintf("idem-app-owner-%d@example.com", stamp), "Owner", "hash")
	if err != nil {
		t.Fatalf("register owner: %v", err)
	}
	other, err := s.Register(fmt.Sprintf("idem-app-other-%d@example.com", stamp), "Other", "hash")
	if err != nil {
		t.Fatalf("register other: %v", err)
	}
	t.Cleanup(func() {
		for _, u := range []string{owner.UserID, other.UserID} {
			for _, table := range []string{"subtasks", "tags", "tasks", "task_lists", "class_sessions", "events", "subscription"} {
				if _, err := pool.Exec(context.Background(), `DELETE FROM `+table+` WHERE user_id = $1`, u); err != nil {
					t.Errorf("cleanup: delete %s: %v", table, err)
				}
			}
			if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, u); err != nil {
				t.Errorf("cleanup: delete app_users: %v", err)
			}
		}
	})

	// post runs a create handler as the given user and decodes the envelope.
	post := func(h http.HandlerFunc, userID, body string) (int, map[string]any) {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		req = req.WithContext(context.WithValue(req.Context(), auth.UserKey, &auth.Claims{UserID: userID}))
		rec := httptest.NewRecorder()
		h(rec, req)
		var out map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("decode response %q: %v", rec.Body.String(), err)
		}
		return rec.Code, out
	}

	// Events keep the client-supplied ID.
	evtID := fmt.Sprintf("evt_idem_app_%d", stamp)
	body := fmt.Sprintf(`{"event_id":%q,"title":"Exam","start_at":1000}`, evtID)
	code, out := post(a.createEvent, owner.UserID, body)
	if code != http.StatusCreated {
		t.Fatalf("first event create: status %d, want 201", code)
	}
	if got := out["data"].(map[string]any)["event_id"]; got != evtID {
		t.Fatalf("event_id = %v, want the client ID %q", got, evtID)
	}
	code, out = post(a.createEvent, owner.UserID, fmt.Sprintf(`{"event_id":%q,"title":"Changed","start_at":2000}`, evtID))
	if code != http.StatusOK {
		t.Fatalf("event replay: status %d, want 200", code)
	}
	if got := out["data"].(map[string]any)["title"]; got != "Exam" {
		t.Errorf("event replay title = %v, want the stored %q", got, "Exam")
	}
	code, out = post(a.createEvent, other.UserID, body)
	if code != http.StatusConflict {
		t.Fatalf("cross-user event: status %d, want 409", code)
	}
	if strings.Contains(fmt.Sprint(out), "Exam") {
		t.Errorf("cross-user conflict leaked data: %v", out)
	}
	if err := s.DeleteEvent(owner.UserID, evtID); err != nil {
		t.Fatalf("DeleteEvent: %v", err)
	}
	if code, _ = post(a.createEvent, owner.UserID, body); code != http.StatusConflict {
		t.Errorf("replay of soft-deleted event: status %d, want 409", code)
	}

	// Replays are answered before the plan cap: fill the Free cap (3 lists),
	// then replay the first one and attempt a fresh one.
	var listIDs []string
	for i := 0; i < 3; i++ {
		id := fmt.Sprintf("lst_idem_app_%d_%d", stamp, i)
		listIDs = append(listIDs, id)
		code, _ = post(a.createList, owner.UserID, fmt.Sprintf(`{"list_id":%q,"name":"L%d"}`, id, i))
		if code != http.StatusCreated {
			t.Fatalf("list %d create: status %d, want 201", i, code)
		}
	}
	if code, _ = post(a.createList, owner.UserID, fmt.Sprintf(`{"list_id":%q,"name":"L0"}`, listIDs[0])); code != http.StatusOK {
		t.Errorf("list replay at cap: status %d, want 200", code)
	}
	if code, _ = post(a.createList, owner.UserID, `{"name":"fresh"}`); code != http.StatusPaymentRequired {
		t.Errorf("fresh list at cap: status %d, want 402", code)
	}
}
