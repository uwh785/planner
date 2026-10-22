package app

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// retryPool opens a second pool for direct reads and cleanup of extra users.
func retryPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pool, err := pgxpool.New(context.Background(), os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// dropUser removes a throwaway user and everything the retry tests created.
func dropUser(t *testing.T, pool *pgxpool.Pool, userID string) {
	t.Helper()
	for _, table := range []string{"sync_changes", "subtasks", "tasks", "app_users"} {
		if _, err := pool.Exec(context.Background(), `DELETE FROM `+table+` WHERE user_id = $1`, userID); err != nil {
			t.Errorf("cleanup: delete %s: %v", table, err)
		}
	}
}

// TestSyncPushSubtaskRedelete checks that deleting an already-deleted own
// subtask is applied, while a live subtask under the wrong parent, a missing
// subtask and another user's subtask are not_found and stay untouched.
// Skipped unless TEST_DATABASE_URL is set.
func TestSyncPushSubtaskRedelete(t *testing.T) {
	a, s, userID := timerFixture(t, "redelete")
	other, err := s.Register(fmt.Sprintf("redelete-other-%d@example.com", time.Now().UnixNano()), "Other", "hash")
	if err != nil {
		t.Fatalf("register other: %v", err)
	}
	pool := retryPool(t)
	t.Cleanup(func() { dropUser(t, pool, other.UserID) })
	stamp := time.Now().UnixNano()
	push := func(uid, change string) pushTestResult {
		t.Helper()
		code, results, raw := syncPushAs(t, a, uid, `{"changes":[`+change+`]}`)
		if code != http.StatusOK || len(results) != 1 {
			t.Fatalf("push: status %d, body %s", code, raw)
		}
		return results[0]
	}
	want := func(r pushTestResult, status string, code int) {
		t.Helper()
		if r.Status != status || r.HTTPStatus != code {
			t.Errorf("result = %+v, want %s %d", r, status, code)
		}
	}
	tsk, tsk2, sub := fmt.Sprintf("tsk_rd_%d", stamp), fmt.Sprintf("tsk_rd2_%d", stamp), fmt.Sprintf("sub_rd_%d", stamp)
	otherTsk, otherSub := fmt.Sprintf("tsk_rdo_%d", stamp), fmt.Sprintf("sub_rdo_%d", stamp)
	push(userID, fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"data":{"title":"p"}}`, tsk))
	push(userID, fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"data":{"title":"p2"}}`, tsk2))
	push(userID, fmt.Sprintf(`{"entity":"subtask","op":"upsert","id":%q,"data":{"task_id":%q,"title":"s"}}`, sub, tsk))
	push(other.UserID, fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"data":{"title":"t"}}`, otherTsk))
	push(other.UserID, fmt.Sprintf(`{"entity":"subtask","op":"upsert","id":%q,"data":{"task_id":%q,"title":"s"}}`, otherSub, otherTsk))
	del := func(id, task string) string {
		return fmt.Sprintf(`{"entity":"subtask","op":"delete","id":%q,"data":{"task_id":%q}}`, id, task)
	}
	state := func(id string) (int, int64) {
		t.Helper()
		var d int
		var u int64
		if err := pool.QueryRow(context.Background(), `SELECT deleted, updated_at FROM subtasks WHERE subtask_id = $1`, id).Scan(&d, &u); err != nil {
			t.Fatalf("read subtask: %v", err)
		}
		return d, u
	}

	want(push(userID, del(sub, tsk2)), pushNotFound, 404) // live, wrong parent
	if d, _ := state(sub); d != 0 {
		t.Error("wrong-parent delete tombstoned the subtask")
	}
	want(push(userID, del("sub_none_"+fmt.Sprint(stamp), tsk)), pushApplied, 200) // never existed
	want(push(userID, del(otherSub, tsk)), pushNotFound, 404)                     // foreign
	want(push(userID, del(otherSub, otherTsk)), pushNotFound, 404)
	if d, _ := state(otherSub); d != 0 {
		t.Error("foreign delete tombstoned the other user's subtask")
	}
	want(push(userID, del(sub, tsk)), pushApplied, 200)
	_, u1 := state(sub)
	want(push(userID, del(sub, tsk)), pushApplied, 200) // retry after a lost response
	want(push(userID, del(sub, tsk2)), pushApplied, 200)
	if d, u2 := state(sub); d != 1 || u2 != u1 {
		t.Errorf("after re-deletes: deleted %d updated_at %d (was %d), want 1 and unchanged", d, u2, u1)
	}
}

// TestSyncPushChangeID checks the idempotency key on timer ops: a replayed
// batch answers exists and changes nothing, a refused transition does not
// consume its key, an invalid key refuses the batch, keys are echoed, and
// concurrent submits of one key apply once. Skipped unless TEST_DATABASE_URL
// is set.
func TestSyncPushChangeID(t *testing.T) {
	a, s, userID := timerFixture(t, "changeid")
	pool := retryPool(t)
	stamp := time.Now().UnixNano()
	tsk := fmt.Sprintf("tsk_cid_%d", stamp)
	base := time.Now().Add(-2 * time.Hour).UnixMilli()
	const minute = int64(60 * 1000)

	push := func(uid, changes string, n int) []pushTestResult {
		t.Helper()
		code, results, raw := syncPushAs(t, a, uid, `{"changes":[`+changes+`]}`)
		if code != http.StatusOK || len(results) != n {
			t.Fatalf("push: status %d, %d results, want 200 and %d: %s", code, len(results), n, raw)
		}
		return results
	}
	change := func(op, id, cid string, at int64) string {
		return fmt.Sprintf(`{"entity":"task","op":%q,"id":%q,"change_id":%q,"data":{"at":%d}}`, op, id, cid, at)
	}
	push(userID, fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"data":{"title":"cid"}}`, tsk), 1)

	batch := strings.Join([]string{
		change("start", tsk, "c-1", base),
		change("pause", tsk, "c-2", base+10*minute),
		change("start", tsk, "c-3", base+20*minute),
		change("complete", tsk, "c-4", base+30*minute),
	}, ",")
	res := push(userID, batch, 4)
	for i, r := range res {
		if r.Status != pushApplied || r.ChangeID != fmt.Sprintf("c-%d", i+1) {
			t.Errorf("first run result %d: %+v, want applied echoing c-%d", i, r, i+1)
		}
	}
	first, _ := s.GetTask(userID, tsk)
	res = push(userID, batch, 4)
	for i, r := range res {
		if r.Status != pushExists || r.HTTPStatus != 200 || r.ChangeID != fmt.Sprintf("c-%d", i+1) {
			t.Errorf("replay result %d: %+v, want exists 200 echoing c-%d", i, r, i+1)
		}
	}
	again, _ := s.GetTask(userID, tsk)
	if again.ElapsedMs != first.ElapsedMs || again.ElapsedMs != 20*minute || again.Status != "completed" ||
		again.CompletedAt == nil || first.CompletedAt == nil || *again.CompletedAt != *first.CompletedAt || again.UpdatedAt != first.UpdatedAt {
		t.Errorf("task after replay = %+v, want unchanged from %+v", again, first)
	}

	// A conflict consumes nothing: pause on a pending task is refused, and the
	// same id applies once the task is in progress.
	tsk2 := fmt.Sprintf("tsk_cid2_%d", stamp)
	push(userID, fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"data":{"title":"cid2"}}`, tsk2), 1)
	res = push(userID, change("pause", tsk2, "c-retry", base), 1)
	if res[0].Status != pushConflict || res[0].HTTPStatus != 409 {
		t.Errorf("pause on pending: %+v, want conflict 409", res[0])
	}
	push(userID, change("start", tsk2, "c-other", base), 1)
	res = push(userID, change("pause", tsk2, "c-retry", base+minute), 1)
	if res[0].Status != pushApplied {
		t.Errorf("retry of a refused change_id: %+v, want applied", res[0])
	}

	// Keys are per user.
	otherTsk := fmt.Sprintf("tsk_cid_o_%d", stamp)
	other, err := s.Register(fmt.Sprintf("changeid-other-%d@example.com", stamp), "Other", "hash")
	if err != nil {
		t.Fatalf("register other: %v", err)
	}
	t.Cleanup(func() { dropUser(t, pool, other.UserID) })
	push(other.UserID, fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"data":{"title":"o"}}`, otherTsk), 1)
	res = push(other.UserID, change("start", otherTsk, "c-1", base), 1)
	if res[0].Status != pushApplied {
		t.Errorf("other user reusing c-1: %+v, want applied", res[0])
	}

	// An invalid change_id refuses the whole batch, for any op.
	for _, bad := range []string{`""`, `"` + strings.Repeat("x", 65) + `"`, `"has space"`, `"tab\t"`, `5`} {
		for _, op := range []string{`"op":"start","data":{"at":1}`, `"op":"delete"`} {
			code, _, raw := syncPushAs(t, a, userID, fmt.Sprintf(`{"changes":[{"entity":"task",%s,"id":"x","change_id":%s}]}`, op, bad))
			if code != http.StatusBadRequest {
				t.Errorf("change_id %s with %s: status %d, want 400 (%s)", bad, op, code, raw)
			}
		}
	}

	// Non-timer ops accept the key, echo it and record nothing.
	res = push(userID, fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"change_id":"c-up","data":{"title":"t3"}}`, tsk2), 1)
	if res[0].Status != pushApplied || res[0].ChangeID != "c-up" {
		t.Errorf("upsert with change_id: %+v, want applied echoing c-up", res[0])
	}
	var n int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM sync_changes WHERE user_id = $1 AND change_id = 'c-up'`, userID).Scan(&n); err != nil || n != 0 {
		t.Errorf("recorded keys for a non-timer op = %d, err %v, want 0", n, err)
	}

	// Concurrent submits of one key: exactly one applied.
	tsk3 := fmt.Sprintf("tsk_cid3_%d", stamp)
	push(userID, fmt.Sprintf(`{"entity":"task","op":"upsert","id":%q,"data":{"title":"race"}}`, tsk3), 1)
	var wg sync.WaitGroup
	var mu sync.Mutex
	counts := map[string]int{}
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, results, _ := syncPushAs(t, a, userID, `{"changes":[`+change("start", tsk3, "c-race", base)+`]}`)
			mu.Lock()
			defer mu.Unlock()
			if len(results) == 1 {
				counts[results[0].Status]++
			}
		}()
	}
	wg.Wait()
	if counts[pushApplied] != 1 || counts[pushExists] != 7 {
		t.Errorf("8 concurrent submits: %v, want 1 applied and 7 exists", counts)
	}
}
