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

type pushTestResult struct {
	Index      int    `json:"index"`
	Entity     string `json:"entity"`
	ID         string `json:"id"`
	Status     string `json:"status"`
	HTTPStatus int    `json:"http_status"`
	Error      string `json:"error"`
}

// syncPushAs runs the push handler as the given user and returns the HTTP
// status, the decoded results (nil unless the batch was accepted) and the raw
// body.
func syncPushAs(t *testing.T, a *App, userID, body string) (int, []pushTestResult, string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/sync/push", strings.NewReader(body))
	req = req.WithContext(context.WithValue(req.Context(), auth.UserKey, &auth.Claims{UserID: userID}))
	rec := httptest.NewRecorder()
	a.syncPush(rec, req)
	var out struct {
		Data struct {
			Results []pushTestResult `json:"results"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return rec.Code, out.Data.Results, rec.Body.String()
}

// TestSyncPushRejectsBadBatches needs no database: a malformed batch is
// refused before the store is touched.
func TestSyncPushRejectsBadBatches(t *testing.T) {
	a := New(nil, nil)
	many := strings.TrimSuffix(strings.Repeat(`{"entity":"list","op":"delete","id":"x"},`, 201), ",")
	cases := map[string]string{
		"not json":       `nope`,
		"no changes key": `{}`,
		"empty list":     `{"changes":[]}`,
		"unknown entity": `{"changes":[{"entity":"widget","op":"upsert","id":"x","data":{}}]}`,
		"unknown op":     `{"changes":[{"entity":"list","op":"merge","id":"x","data":{}}]}`,
		"missing op":     `{"changes":[{"entity":"list","id":"x"}]}`,
		"too many":       `{"changes":[` + many + `]}`,
	}
	for name, body := range cases {
		code, results, raw := syncPushAs(t, a, "usr_x", body)
		if code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400 (body %s)", name, code, raw)
		}
		if results != nil || !strings.Contains(raw, `"error"`) {
			t.Errorf("%s: body %s, want an error envelope and no results", name, raw)
		}
	}
}

// TestSyncPushIntegration drives POST /api/sync/push the way the offline
// client does: every entity kind upserts (create, then update on replay),
// deletes are idempotent, another user's rows are never touched or leaked,
// a cap failure only fails its own item, and the apply order is independent
// of the request order while results stay in request order. It is skipped
// unless TEST_DATABASE_URL is set and cleans up after itself.
func TestSyncPushIntegration(t *testing.T) {
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
	owner, err := s.Register(fmt.Sprintf("push-owner-%d@example.com", stamp), "Owner", "hash")
	if err != nil {
		t.Fatalf("register owner: %v", err)
	}
	other, err := s.Register(fmt.Sprintf("push-other-%d@example.com", stamp), "Other", "hash")
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

	id := func(prefix string) string { return fmt.Sprintf("%s_push_%d", prefix, stamp) }
	lst, tag, tsk, sub, cls, evt := id("lst"), id("tag"), id("tsk"), id("sub"), id("cls"), id("evt")

	// push runs a batch as the owner and checks the envelope: 200, one result
	// per change, in request order.
	push := func(userID, changes string, n int) []pushTestResult {
		t.Helper()
		code, results, raw := syncPushAs(t, a, userID, `{"changes":[`+changes+`]}`)
		if code != http.StatusOK {
			t.Fatalf("push: status %d, body %s", code, raw)
		}
		if len(results) != n {
			t.Fatalf("push: %d results, want %d: %s", len(results), n, raw)
		}
		for i, r := range results {
			if r.Index != i {
				t.Errorf("results[%d].index = %d, want %d", i, r.Index, i)
			}
		}
		return results
	}
	expect := func(r pushTestResult, entity, status string, httpStatus int) {
		t.Helper()
		if r.Entity != entity || r.Status != status || r.HTTPStatus != httpStatus {
			t.Errorf("result %d = %+v, want %s %s %d", r.Index, r, entity, status, httpStatus)
		}
	}

	// Request order is deliberately reversed against the dependency order: the
	// task precedes its list, the task_tag precedes its task and tag.
	create := func(suffix string) string {
		return strings.Join([]string{
			fmt.Sprintf(`{"entity":"task_tag","op":"upsert","data":{"task_id":%q,"tag_id":%q}}`, tsk, tag),
			fmt.Sprintf(`{"entity":"event","op":"upsert","id":%q,"data":{"title":"Exam%s","start_at":1000}}`, evt, suffix),
			fmt.Sprintf(`{"entity":"class","op":"upsert","id":%q,"data":{"subject":"Math%s","day_of_week":1,"start_minute":480,"end_minute":540}}`, cls, suffix),
			fmt.Sprintf(`{"entity":"subtask","op":"upsert","id":%q,"data":{"task_id":%q,"title":"Sub%s"}}`, sub, tsk, suffix),
			fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"data":{"title":"Task%s","list_id":%q}}`, tsk, suffix, lst),
			fmt.Sprintf(`{"entity":"tag","op":"upsert","id":%q,"data":{"name":"Tag%s"}}`, tag, suffix),
			fmt.Sprintf(`{"entity":"list","op":"upsert","id":%q,"data":{"name":"List%s"}}`, lst, suffix),
		}, ",")
	}
	entities := []string{"task_tag", "event", "class", "subtask", "task", "tag", "list"}

	// First run: everything is created.
	results := push(owner.UserID, create("1"), 7)
	for i, r := range results {
		expect(r, entities[i], "applied", http.StatusCreated)
	}
	if results[4].ID != tsk || results[6].ID != lst {
		t.Errorf("ids = %q / %q, want the client IDs echoed", results[4].ID, results[6].ID)
	}
	task, err := s.GetTask(owner.UserID, tsk)
	if err != nil {
		t.Fatalf("GetTask after push: %v", err)
	}
	if task.Title != "Task1" || !task.ListID.Valid || task.ListID.String != lst {
		t.Errorf("task = %+v, want title Task1 in list %s", task, lst)
	}

	// Replaying the same batch (client retry, new content) updates instead of
	// failing; the existing link is reported as already there.
	results = push(owner.UserID, create("2"), 7)
	for i, r := range results {
		if entities[i] == "task_tag" {
			expect(r, "task_tag", "exists", http.StatusOK)
		} else {
			expect(r, entities[i], "applied", http.StatusOK)
		}
	}
	if task, err = s.GetTask(owner.UserID, tsk); err != nil || task.Title != "Task2" {
		t.Errorf("task after replay = %+v, err %v, want title Task2", task, err)
	}
	if ev, err := s.GetEvent(owner.UserID, evt); err != nil || ev.Title != "Exam2" {
		t.Errorf("event after replay = %+v, err %v, want title Exam2", ev, err)
	}
	if tags, err := s.ListTags(owner.UserID); err != nil || len(tags) != 1 || tags[0].Name != "Tag2" {
		t.Errorf("tags after replay = %+v, err %v, want one renamed tag", tags, err)
	}

	// Another user can neither take over nor delete the owner's rows, and the
	// answer reveals nothing about them.
	results = push(other.UserID, strings.Join([]string{
		fmt.Sprintf(`{"entity":"list","op":"upsert","id":%q,"data":{"name":"stolen"}}`, lst),
		fmt.Sprintf(`{"entity":"task","op":"delete","id":%q}`, tsk),
		fmt.Sprintf(`{"entity":"subtask","op":"upsert","id":%q,"data":{"task_id":%q,"title":"stolen"}}`, id("sub2"), tsk),
	}, ","), 3)
	expect(results[0], "list", "conflict", http.StatusConflict)
	expect(results[1], "task", "not_found", http.StatusNotFound)
	expect(results[2], "subtask", "conflict", http.StatusConflict) // foreign parent task
	for _, r := range results {
		if strings.Contains(r.Error, "List2") || strings.Contains(r.Error, "Task2") {
			t.Errorf("result %d leaked data: %q", r.Index, r.Error)
		}
	}
	if task, err = s.GetTask(owner.UserID, tsk); err != nil || task.Title != "Task2" {
		t.Errorf("owner's task after foreign delete = %+v, err %v, want untouched", task, err)
	}

	// Deletes run in reverse dependency order whatever the request order, and
	// deleting again is idempotent.
	del := strings.Join([]string{
		fmt.Sprintf(`{"entity":"list","op":"delete","id":%q}`, lst),
		fmt.Sprintf(`{"entity":"tag","op":"delete","id":%q}`, tag),
		fmt.Sprintf(`{"entity":"task","op":"delete","id":%q}`, tsk),
		fmt.Sprintf(`{"entity":"subtask","op":"delete","id":%q,"data":{"task_id":%q}}`, sub, tsk),
		fmt.Sprintf(`{"entity":"class","op":"delete","id":%q}`, cls),
		fmt.Sprintf(`{"entity":"event","op":"delete","id":%q}`, evt),
		fmt.Sprintf(`{"entity":"task_tag","op":"delete","data":{"task_id":%q,"tag_id":%q}}`, tsk, tag),
		fmt.Sprintf(`{"entity":"event","op":"delete","id":%q}`, id("evt_never")),
	}, ",")
	for run := 0; run < 2; run++ {
		results = push(owner.UserID, del, 8)
		for _, r := range results {
			if r.Status != "applied" || r.HTTPStatus != http.StatusOK {
				t.Errorf("delete run %d: result %+v, want applied 200", run, r)
			}
		}
	}
	changes, err := s.SyncChanges(owner.UserID, 0)
	if err != nil {
		t.Fatalf("SyncChanges: %v", err)
	}
	if len(changes.Lists) != 1 || !changes.Lists[0].Deleted || len(changes.Tasks) != 1 || !changes.Tasks[0].Deleted ||
		len(changes.Subtasks) != 1 || !changes.Subtasks[0].Deleted || len(changes.Tags) != 1 || !changes.Tags[0].Deleted ||
		len(changes.TaskTags) != 1 || !changes.TaskTags[0].Deleted || len(changes.Classes) != 1 || !changes.Classes[0].Deleted ||
		len(changes.Events) != 1 || !changes.Events[0].Deleted {
		t.Errorf("after delete every row should be one tombstone, got %+v", changes)
	}

	// A soft-deleted row cannot be revived by an upsert.
	results = push(owner.UserID, fmt.Sprintf(`{"entity":"event","op":"upsert","id":%q,"data":{"title":"back","start_at":1}}`, evt), 1)
	expect(results[0], "event", "conflict", http.StatusConflict)

	// Free plan: 3 active lists. The fourth fails with 402 while the other
	// items of the same batch still apply, and replaying the first list at the
	// cap is an update, not a refusal.
	l := []string{id("lstA"), id("lstB"), id("lstC"), id("lstD")}
	var batch []string
	for i, lid := range l {
		batch = append(batch, fmt.Sprintf(`{"entity":"list","op":"upsert","id":%q,"data":{"name":"L%d"}}`, lid, i))
	}
	batch = append(batch, fmt.Sprintf(`{"entity":"event","op":"upsert","id":%q,"data":{"title":"alongside","start_at":5}}`, id("evt_ok")))
	results = push(owner.UserID, strings.Join(batch, ","), 5)
	for _, i := range []int{0, 1, 2} {
		expect(results[i], "list", "applied", http.StatusCreated)
	}
	expect(results[3], "list", "limit", http.StatusPaymentRequired)
	if results[3].Error == "" {
		t.Errorf("limit result has no error message: %+v", results[3])
	}
	expect(results[4], "event", "applied", http.StatusCreated)
	results = push(owner.UserID, fmt.Sprintf(`{"entity":"list","op":"upsert","id":%q,"data":{"name":"renamed"}}`, l[0]), 1)
	expect(results[0], "list", "applied", http.StatusOK)

	// Invalid items fail alone with 400.
	results = push(owner.UserID, strings.Join([]string{
		fmt.Sprintf(`{"entity":"list","op":"upsert","id":%q,"data":{"name":"  "}}`, id("lst_bad")),
		`{"entity":"task","op":"upsert","data":{"title":"no id"}}`,
		fmt.Sprintf(`{"entity":"subtask","op":"upsert","id":%q,"data":{"title":"no parent"}}`, id("sub_bad")),
		fmt.Sprintf(`{"entity":"tag","op":"upsert","id":%q,"data":"not an object"}`, id("tag_bad")),
		fmt.Sprintf(`{"entity":"event","op":"upsert","id":%q,"data":{"title":"fine","start_at":1}}`, id("evt_fine")),
	}, ","), 5)
	for i := 0; i < 4; i++ {
		if results[i].Status != "invalid" || results[i].HTTPStatus != http.StatusBadRequest || results[i].Error == "" {
			t.Errorf("results[%d] = %+v, want invalid 400 with a message", i, results[i])
		}
	}
	expect(results[4], "event", "applied", http.StatusCreated)
}
