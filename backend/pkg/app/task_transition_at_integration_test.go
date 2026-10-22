package app

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/auth"
	"planner/pkg/model"
	"planner/pkg/store"
)

// timerFixture opens the database, registers a throwaway user and returns an
// App, its store and the user ID; every row is removed on cleanup.
func timerFixture(t *testing.T, prefix string) (*App, *store.Store, string) {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	s := store.New(pool)
	user, err := s.Register(fmt.Sprintf("%s-%d@example.com", prefix, time.Now().UnixNano()), "User", "hash")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	t.Cleanup(func() {
		for _, table := range []string{"sync_changes", "subtasks", "tasks"} {
			if _, err := pool.Exec(context.Background(), `DELETE FROM `+table+` WHERE user_id = $1`, user.UserID); err != nil {
				t.Errorf("cleanup: delete %s: %v", table, err)
			}
		}
		if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete app_users: %v", err)
		}
	})
	return New(s, nil), s, user.UserID
}

// TestTaskTransitionHandlersAtBody checks the optional {"at": ms} body of
// PUT /api/tasks/{id}/start|pause|complete. Skipped unless TEST_DATABASE_URL
// is set.
func TestTaskTransitionHandlersAtBody(t *testing.T) {
	a, s, userID := timerFixture(t, "timer-at")

	call := func(h http.HandlerFunc, taskID, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPut, "/api/tasks/"+taskID, strings.NewReader(body))
		req = req.WithContext(context.WithValue(req.Context(), auth.UserKey, &auth.Claims{UserID: userID}))
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("id", taskID)
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
		rec := httptest.NewRecorder()
		h(rec, req)
		return rec
	}
	mustCreate := func(title string) string {
		created, err := s.CreateTask(userID, model.Task{Title: title})
		if err != nil {
			t.Fatalf("CreateTask: %v", err)
		}
		return created.TaskID
	}
	get := func(id string) model.Task {
		got, err := s.GetTask(userID, id)
		if err != nil {
			t.Fatalf("GetTask: %v", err)
		}
		return got
	}

	base := time.Now().Add(-2 * time.Hour).UnixMilli()
	const minute = int64(60 * 1000)

	// With a body the supplied moments drive the timer.
	id := mustCreate("with body")
	if rec := call(a.startTask, id, fmt.Sprintf(`{"at":%d}`, base)); rec.Code != http.StatusOK {
		t.Fatalf("start: status %d, body %s", rec.Code, rec.Body.String())
	}
	if got := get(id); got.StartedAt == nil || *got.StartedAt != base {
		t.Errorf("start: started_at = %v, want %d", got.StartedAt, base)
	}
	if rec := call(a.pauseTask, id, fmt.Sprintf(`{"at":%d}`, base+30*minute)); rec.Code != http.StatusOK {
		t.Fatalf("pause: status %d, body %s", rec.Code, rec.Body.String())
	}
	if got := get(id); got.ElapsedMs != 30*minute {
		t.Errorf("pause: elapsed_ms = %d, want %d", got.ElapsedMs, 30*minute)
	}
	if rec := call(a.completeTask, id, fmt.Sprintf(`{"at":%d}`, base+40*minute)); rec.Code != http.StatusOK {
		t.Fatalf("complete: status %d, body %s", rec.Code, rec.Body.String())
	}
	if got := get(id); got.CompletedAt == nil || *got.CompletedAt != base+40*minute {
		t.Errorf("complete: completed_at = %v, want %d", got.CompletedAt, base+40*minute)
	}

	// No body, an empty object and a missing "at" all mean "now".
	for name, body := range map[string]string{"no body": "", "empty object": `{}`, "null at": `{"at":null}`} {
		id := mustCreate(name)
		before := time.Now().UnixMilli()
		if rec := call(a.startTask, id, body); rec.Code != http.StatusOK {
			t.Fatalf("%s: start status %d, body %s", name, rec.Code, rec.Body.String())
		}
		got := get(id)
		if got.StartedAt == nil || *got.StartedAt < before || *got.StartedAt > time.Now().UnixMilli() {
			t.Errorf("%s: started_at = %v, want server now", name, got.StartedAt)
		}
	}

	// Bad bodies are 400 and change nothing.
	id = mustCreate("bad body")
	for name, body := range map[string]string{
		"not json":      `nope`,
		"string at":     `{"at":"soon"}`,
		"zero at":       `{"at":0}`,
		"negative at":   `{"at":-1}`,
		"far future at": fmt.Sprintf(`{"at":%d}`, time.Now().UnixMilli()+store.MaxClockSkewMs+60*1000),
		"fractional at": `{"at":1.5}`,
	} {
		for hname, h := range map[string]http.HandlerFunc{"start": a.startTask, "pause": a.pauseTask, "complete": a.completeTask} {
			if rec := call(h, id, body); rec.Code != http.StatusBadRequest {
				t.Errorf("%s %s: status %d, want 400 (body %s)", hname, name, rec.Code, rec.Body.String())
			}
		}
	}
	if got := get(id); got.Status != "pending" || got.StartedAt != nil {
		t.Errorf("after bad bodies: status %q started_at %v, want untouched", got.Status, got.StartedAt)
	}

	// Wrong state is still 409 and an unknown task 404, with a valid body.
	if rec := call(a.pauseTask, id, fmt.Sprintf(`{"at":%d}`, base)); rec.Code != http.StatusConflict {
		t.Errorf("pause pending: status %d, want 409", rec.Code)
	}
	if rec := call(a.startTask, "tsk_nope", fmt.Sprintf(`{"at":%d}`, base)); rec.Code != http.StatusNotFound {
		t.Errorf("start unknown: status %d, want 404", rec.Code)
	}
}

// TestSyncPushTimerReplay replays an offline start/pause/complete sequence
// created in the same batch, then checks the conflict, not_found and invalid
// outcomes. Skipped unless TEST_DATABASE_URL is set.
func TestSyncPushTimerReplay(t *testing.T) {
	a, s, userID := timerFixture(t, "timer-push")
	stamp := time.Now().UnixNano()
	tsk := fmt.Sprintf("tsk_replay_%d", stamp)

	base := time.Now().Add(-3 * time.Hour).UnixMilli()
	const minute = int64(60 * 1000)
	push := func(changes string, n int) []pushTestResult {
		t.Helper()
		code, results, raw := syncPushAs(t, a, userID, `{"changes":[`+changes+`]}`)
		if code != http.StatusOK || len(results) != n {
			t.Fatalf("push: status %d, %d results, want 200 and %d: %s", code, len(results), n, raw)
		}
		return results
	}
	change := func(op, id string, at int64) string {
		return fmt.Sprintf(`{"entity":"task","op":%q,"id":%q,"data":{"at":%d}}`, op, id, at)
	}

	// Sent out of order and ahead of the create: the create applies first, the
	// transitions keep the client's order among themselves.
	res := push(strings.Join([]string{
		change("start", tsk, base),
		change("pause", tsk, base+30*minute),
		change("start", tsk, base+60*minute),
		change("complete", tsk, base+75*minute),
		fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"data":{"title":"offline"}}`, tsk),
	}, ","), 5)
	for i, r := range res {
		if r.Status != pushApplied {
			t.Errorf("result %d: %+v, want applied", i, r)
		}
	}
	got, err := s.GetTask(userID, tsk)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if got.Status != "completed" || got.ElapsedMs != 45*minute || got.StartedAt != nil {
		t.Errorf("replayed task: status %q elapsed %d started_at %v, want completed %d nil", got.Status, got.ElapsedMs, got.StartedAt, 45*minute)
	}
	if got.CompletedAt == nil || *got.CompletedAt != base+75*minute {
		t.Errorf("replayed task: completed_at = %v, want %d", got.CompletedAt, base+75*minute)
	}

	// Wrong state -> conflict 409; unknown task -> not_found 404; bad at -> invalid 400.
	tooFar := time.Now().UnixMilli() + store.MaxClockSkewMs + 60*1000
	other := fmt.Sprintf("tsk_replay_b_%d", stamp)
	res = push(strings.Join([]string{
		change("start", tsk, base),
		change("start", "tsk_missing_"+fmt.Sprint(stamp), base),
		fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"data":{"title":"b"}}`, other),
		change("pause", other, base),
		change("start", other, tooFar),
		change("start", other, 0),
		fmt.Sprintf(`{"entity":"task","op":"start","id":%q,"data":{"at":"x"}}`, other),
		fmt.Sprintf(`{"entity":"task","op":"start","id":%q}`, other),
	}, ","), 8)
	want := []struct {
		status string
		http   int
	}{
		{pushConflict, 409}, {pushNotFound, 404}, {pushApplied, 201},
		{pushConflict, 409}, {pushInvalid, 400}, {pushInvalid, 400}, {pushInvalid, 400}, {pushInvalid, 400},
	}
	for i, w := range want {
		if res[i].Status != w.status || res[i].HTTPStatus != w.http {
			t.Errorf("result %d: %+v, want %s %d", i, res[i], w.status, w.http)
		}
	}
	if got, err := s.GetTask(userID, other); err != nil || got.Status != "pending" {
		t.Errorf("task after refused transitions = %+v, err %v, want pending", got, err)
	}

	// Timer ops are for tasks only; a delete of the task still runs after them.
	code, _, raw := syncPushAs(t, a, userID, `{"changes":[{"entity":"list","op":"start","id":"x","data":{"at":1}}]}`)
	if code != http.StatusBadRequest {
		t.Errorf("start on a list: status %d, want 400 (%s)", code, raw)
	}
	res = push(strings.Join([]string{
		fmt.Sprintf(`{"entity":"task","op":"delete","id":%q}`, other),
		change("start", other, base),
	}, ","), 2)
	if res[0].Status != pushApplied || res[1].Status != pushApplied {
		t.Errorf("transition before delete: %+v, want both applied", res)
	}
	if _, err := s.GetTask(userID, other); err == nil {
		t.Error("task still live after the delete")
	}
}
