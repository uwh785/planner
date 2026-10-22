package app

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sort"

	"planner/pkg/auth"
	"planner/pkg/model"
	"planner/pkg/plan"
	"planner/pkg/store"
)

// maxPushChanges bounds one push batch. The body is also capped by
// maxRequestBodyBytes, so a batch of large rows may hit 413 first.
const maxPushChanges = 200

// Per-item outcomes reported by sync push.
const (
	pushApplied  = "applied"   // created, updated or deleted (deletes are idempotent)
	pushExists   = "exists"    // a task_tag link that was already live
	pushNotFound = "not_found" // the row, or a parent it needs, is not the caller's
	pushConflict = "conflict"  // the ID is soft-deleted or another user's
	pushLimit    = "limit"     // plan cap (402) or storage ceiling (409)
	pushInvalid  = "invalid"   // failed validation
	pushError    = "error"     // server failure
)

type pushChange struct {
	Entity string          `json:"entity"`
	Op     string          `json:"op"`
	ID     string          `json:"id"`
	Data   json.RawMessage `json:"data"`
}

type pushResult struct {
	Index      int    `json:"index"`
	Entity     string `json:"entity"`
	ID         string `json:"id"`
	Status     string `json:"status"`
	HTTPStatus int    `json:"http_status"`
	Error      string `json:"error,omitempty"`
}

// pushOutcome is what one change came to: the status the single-item endpoint
// would have answered with, and a message when it was not a success.
type pushOutcome struct {
	status string
	http   int
	msg    string
}

func pushOK(code int) pushOutcome { return pushOutcome{status: pushApplied, http: code} }

func pushFail(status string, code int, msg string) pushOutcome {
	return pushOutcome{status: status, http: code, msg: msg}
}

func pushServerError(what string, err error) pushOutcome {
	log.Printf("syncPush: %s: %v", what, err)
	return pushFail(pushError, http.StatusInternalServerError, "failed to "+what)
}

// pushRank is an entity's place in the dependency order: parents before the
// rows that reference them.
var pushRank = map[store.Entity]int{
	store.EntityList:    0,
	store.EntityTag:     1,
	store.EntityTask:    2,
	store.EntitySubtask: 3,
	store.EntityClass:   4,
	store.EntityEvent:   5,
	store.EntityTaskTag: 6,
}

// syncPush answers POST /api/sync/push: it applies a batch of offline changes
// and reports one result per change, in request order. A well-formed batch is
// always HTTP 200, even if every item failed; only a malformed batch (bad JSON,
// empty, over maxPushChanges, unknown entity or op) is refused as a whole.
//
// Items are independent and the batch is NOT atomic: each change commits on its
// own and a failure never rolls back or blocks the others. Upserts are applied
// first in dependency order (list, tag, task, subtask, class, event, task_tag),
// then deletes in the reverse order, whatever order the client sent them in, so
// a task may precede its list in the request. The client reconciles by
// re-pulling and by re-sending failed items.
//
// Task timer transitions (start/pause/complete) are not part of upsert: the
// update path leaves status and timer fields alone and only a create takes the
// client's status. Replaying offline timer segments is task T5.
func (a *App) syncPush(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Changes []pushChange `json:"changes"`
	}
	if !decodeJSONOrRespond(w, r, &req) {
		return
	}
	if len(req.Changes) == 0 {
		errResp(w, http.StatusBadRequest, "changes must not be empty")
		return
	}
	if len(req.Changes) > maxPushChanges {
		errResp(w, http.StatusBadRequest, fmt.Sprintf("at most %d changes per request", maxPushChanges))
		return
	}
	for i, c := range req.Changes {
		if _, ok := pushRank[store.Entity(c.Entity)]; !ok {
			errResp(w, http.StatusBadRequest, fmt.Sprintf("changes[%d]: unknown entity %q", i, c.Entity))
			return
		}
		if c.Op != "upsert" && c.Op != "delete" {
			errResp(w, http.StatusBadRequest, fmt.Sprintf("changes[%d]: op must be upsert or delete", i))
			return
		}
	}

	// Apply order: upserts by rank, then deletes by reverse rank; ties keep
	// request order.
	order := make([]int, len(req.Changes))
	for i := range order {
		order[i] = i
	}
	key := func(c pushChange) int {
		rank := pushRank[store.Entity(c.Entity)]
		if c.Op == "delete" {
			return 100 + len(pushRank) - rank
		}
		return rank
	}
	sort.SliceStable(order, func(x, y int) bool { return key(req.Changes[order[x]]) < key(req.Changes[order[y]]) })

	userID := auth.GetUser(r).UserID
	results := make([]pushResult, len(req.Changes))
	for _, i := range order {
		c := req.Changes[i]
		var id string
		var out pushOutcome
		if c.Op == "delete" {
			id, out = a.pushDelete(userID, c)
		} else {
			id, out = a.pushUpsert(r, userID, c)
		}
		results[i] = pushResult{Index: i, Entity: c.Entity, ID: id, Status: out.status, HTTPStatus: out.http, Error: out.msg}
	}
	dataResp(w, http.StatusOK, map[string]any{"results": results})
}

// pushRecorder captures what a create guard (enforceLimit, guardEvent, ...)
// would have written, so sync push reuses their limit logic unchanged.
type pushRecorder struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func (p *pushRecorder) Header() http.Header {
	if p.header == nil {
		p.header = http.Header{}
	}
	return p.header
}
func (p *pushRecorder) WriteHeader(code int)        { p.status = code }
func (p *pushRecorder) Write(b []byte) (int, error) { return p.body.Write(b) }

// refusal turns a refused guard into an outcome: 402 and 409 are cap failures,
// anything else is a server error.
func (p *pushRecorder) refusal() pushOutcome {
	var e struct {
		Error string `json:"error"`
	}
	_ = json.Unmarshal(p.body.Bytes(), &e)
	if p.status == http.StatusPaymentRequired || p.status == http.StatusConflict {
		return pushFail(pushLimit, p.status, e.Error)
	}
	return pushFail(pushError, http.StatusInternalServerError, e.Error)
}

// decodeData reads an item's data object into v. A missing or null data leaves
// v zero, so the entity's validation reports what is required.
func decodeData(data json.RawMessage, v any) error {
	if len(data) == 0 || string(data) == "null" {
		return nil
	}
	return json.Unmarshal(data, v)
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// lookupOutcome maps a Replay* error for a row an item depends on (a parent
// task, a list, a tag) to a failed outcome, or reports ok when the row is the
// caller's live one.
func lookupOutcome(err error, what string) (pushOutcome, bool) {
	switch {
	case err == nil:
		return pushOutcome{}, true
	case errors.Is(err, store.ErrNotFound):
		return pushFail(pushNotFound, http.StatusNotFound, what+" not found"), false
	case errors.Is(err, store.ErrConflict):
		return pushFail(pushConflict, http.StatusConflict, what+" id already in use"), false
	}
	return pushServerError("look up "+what, err), false
}

// upsertRow is the flow every entity shares. find is the Replay* lookup: a live
// own row is updated (last write wins, the store stamps updated_at); a missing
// one is created under guard, the same plan-cap and storage-ceiling check the
// normal create runs; a soft-deleted or foreign ID is a conflict that reveals
// nothing about the row.
func upsertRow(find func() error, update func() error, guard func(w http.ResponseWriter) bool, create func() error) pushOutcome {
	err := find()
	switch {
	case err == nil:
		switch uerr := update(); {
		case uerr == nil:
			return pushOK(http.StatusOK)
		case errors.Is(uerr, store.ErrNotFound):
			return pushFail(pushNotFound, http.StatusNotFound, "not found")
		default:
			return pushServerError("update", uerr)
		}
	case errors.Is(err, store.ErrConflict):
		return pushFail(pushConflict, http.StatusConflict, "id already in use")
	case !errors.Is(err, store.ErrNotFound):
		return pushServerError("look up", err)
	}

	rec := &pushRecorder{}
	if !guard(rec) {
		return rec.refusal()
	}
	switch cerr := create(); {
	case cerr == nil:
		return pushOK(http.StatusCreated)
	case errors.Is(cerr, store.ErrConflict):
		// Lost a race for the ID to another writer.
		return pushFail(pushConflict, http.StatusConflict, "id already in use")
	default:
		return pushServerError("create", cerr)
	}
}

// pushUpsert applies one upsert and returns the entity ID it resolved to.
func (a *App) pushUpsert(r *http.Request, userID string, c pushChange) (string, pushOutcome) {
	invalid := func(id, msg string) (string, pushOutcome) {
		return id, pushFail(pushInvalid, http.StatusBadRequest, msg)
	}
	switch store.Entity(c.Entity) {
	case store.EntityList:
		var l model.TaskList
		if err := decodeData(c.Data, &l); err != nil {
			return invalid(c.ID, "invalid data")
		}
		l.ListID = firstNonEmpty(c.ID, l.ListID)
		if l.ListID == "" {
			return invalid("", "id is required")
		}
		if err := model.ValidateTaskList(&l); err != nil {
			return invalid(l.ListID, err.Error())
		}
		return l.ListID, upsertRow(
			func() error { _, err := a.store.ReplayTaskList(userID, l.ListID); return err },
			func() error { return a.store.UpdateTaskList(userID, l) },
			func(w http.ResponseWriter) bool { return a.enforceLimit(w, r, plan.ResourceList) },
			func() error { _, err := a.store.CreateTaskList(userID, l); return err })

	case store.EntityTag:
		var t model.Tag
		if err := decodeData(c.Data, &t); err != nil {
			return invalid(c.ID, "invalid data")
		}
		t.TagID = firstNonEmpty(c.ID, t.TagID)
		if t.TagID == "" {
			return invalid("", "id is required")
		}
		if err := model.ValidateTag(&t); err != nil {
			return invalid(t.TagID, err.Error())
		}
		return t.TagID, upsertRow(
			func() error { _, err := a.store.ReplayTag(userID, t.TagID); return err },
			func() error { return a.store.UpdateTag(userID, t) },
			func(w http.ResponseWriter) bool { return a.enforceLimit(w, r, plan.ResourceTag) },
			func() error { _, err := a.store.CreateTag(userID, t); return err })

	case store.EntityTask:
		// model.Task.ListID is a sql.NullString, which cannot decode a plain JSON
		// string, so read list_id into a pointer that shadows the embedded field.
		var in struct {
			model.Task
			ListID *string `json:"list_id"`
		}
		if err := decodeData(c.Data, &in); err != nil {
			return invalid(c.ID, "invalid data")
		}
		t := in.Task
		if in.ListID != nil && *in.ListID != "" {
			t.ListID = sql.NullString{String: *in.ListID, Valid: true}
		}
		t.TaskID = firstNonEmpty(c.ID, t.TaskID)
		if t.TaskID == "" {
			return invalid("", "id is required")
		}
		if err := model.ValidateTask(&t); err != nil {
			return invalid(t.TaskID, err.Error())
		}
		if t.ListID.Valid {
			_, err := a.store.ReplayTaskList(userID, t.ListID.String)
			if out, ok := lookupOutcome(err, "list"); !ok {
				return t.TaskID, out
			}
		}
		// UpdateTask leaves status and the timer fields alone; only a create
		// takes the client's status.
		return t.TaskID, upsertRow(
			func() error { _, err := a.store.ReplayTask(userID, t.TaskID); return err },
			func() error { return a.store.UpdateTask(userID, t) },
			func(w http.ResponseWriter) bool { return a.enforceLimit(w, r, plan.ResourceTask) },
			func() error { _, err := a.store.CreateTask(userID, t); return err })

	case store.EntitySubtask:
		var st model.Subtask
		if err := decodeData(c.Data, &st); err != nil {
			return invalid(c.ID, "invalid data")
		}
		st.SubtaskID = firstNonEmpty(c.ID, st.SubtaskID)
		if st.SubtaskID == "" {
			return invalid("", "id is required")
		}
		if st.TaskID == "" {
			return invalid(st.SubtaskID, "task_id is required")
		}
		if err := model.ValidateSubtask(&st); err != nil {
			return invalid(st.SubtaskID, err.Error())
		}
		_, err := a.store.ReplayTask(userID, st.TaskID)
		if out, ok := lookupOutcome(err, "task"); !ok {
			return st.SubtaskID, out
		}
		return st.SubtaskID, upsertRow(
			func() error { _, err := a.store.ReplaySubtask(userID, st.TaskID, st.SubtaskID); return err },
			func() error { return a.store.UpdateSubtask(userID, st.TaskID, st) },
			func(w http.ResponseWriter) bool { return a.guardSubtask(w, userID, st.TaskID) },
			func() error { _, err := a.store.CreateSubtask(userID, st.TaskID, st); return err })

	case store.EntityClass:
		var cl model.ClassSession
		if err := decodeData(c.Data, &cl); err != nil {
			return invalid(c.ID, "invalid data")
		}
		cl.ClassID = firstNonEmpty(c.ID, cl.ClassID)
		if cl.ClassID == "" {
			return invalid("", "id is required")
		}
		if err := model.ValidateClassSession(&cl); err != nil {
			return invalid(cl.ClassID, err.Error())
		}
		return cl.ClassID, upsertRow(
			func() error { _, err := a.store.ReplayClass(userID, cl.ClassID); return err },
			func() error { return a.store.UpdateClass(userID, cl) },
			func(w http.ResponseWriter) bool { return a.guardClass(w, userID) },
			func() error { _, err := a.store.CreateClass(userID, cl); return err })

	case store.EntityEvent:
		var e model.Event
		if err := decodeData(c.Data, &e); err != nil {
			return invalid(c.ID, "invalid data")
		}
		e.EventID = firstNonEmpty(c.ID, e.EventID)
		if e.EventID == "" {
			return invalid("", "id is required")
		}
		if err := model.ValidateEvent(&e); err != nil {
			return invalid(e.EventID, err.Error())
		}
		return e.EventID, upsertRow(
			func() error { _, err := a.store.ReplayEvent(userID, e.EventID); return err },
			func() error { return a.store.UpdateEvent(userID, e) },
			func(w http.ResponseWriter) bool { return a.guardEvent(w, userID) },
			func() error { _, err := a.store.CreateEvent(userID, e); return err })

	case store.EntityTaskTag:
		var tt model.TaskTag
		if err := decodeData(c.Data, &tt); err != nil {
			return invalid(c.ID, "invalid data")
		}
		if tt.TaskID == "" || tt.TagID == "" {
			return invalid(c.ID, "task_id and tag_id are required")
		}
		// Both ends must be the caller's live rows; the single-item endpoint
		// does not check, but a link to someone else's row must never be made.
		_, err := a.store.ReplayTask(userID, tt.TaskID)
		if out, ok := lookupOutcome(err, "task"); !ok {
			return c.ID, out
		}
		_, err = a.store.ReplayTag(userID, tt.TagID)
		if out, ok := lookupOutcome(err, "tag"); !ok {
			return c.ID, out
		}
		live, err := a.store.TaskTagLive(userID, tt.TaskID, tt.TagID)
		if err != nil {
			return c.ID, pushServerError("look up link", err)
		}
		if live {
			return c.ID, pushOutcome{status: pushExists, http: http.StatusOK}
		}
		if err := a.store.AddTaskTag(userID, tt.TaskID, tt.TagID); err != nil {
			return c.ID, pushServerError("add link", err)
		}
		return c.ID, pushOK(http.StatusCreated)
	}
	return c.ID, pushFail(pushError, http.StatusInternalServerError, "unsupported entity")
}

// pushDelete applies one delete and returns the entity ID it resolved to. A
// delete is idempotent: an ID that is already deleted, or that this user never
// had, is applied. Another user's ID is refused as not_found and never touched.
func (a *App) pushDelete(userID string, c pushChange) (string, pushOutcome) {
	invalid := func(msg string) (string, pushOutcome) {
		return c.ID, pushFail(pushInvalid, http.StatusBadRequest, msg)
	}
	entity := store.Entity(c.Entity)

	// The parent ends of a subtask and a task_tag come from data.
	var d struct {
		TaskID string `json:"task_id"`
		TagID  string `json:"tag_id"`
	}
	if err := decodeData(c.Data, &d); err != nil {
		return invalid("invalid data")
	}

	if entity == store.EntityTaskTag {
		if d.TaskID == "" || d.TagID == "" {
			return invalid("task_id and tag_id are required")
		}
		// RemoveTaskTag is scoped to the caller's own links, so it cannot touch
		// anyone else's.
		if err := a.store.RemoveTaskTag(userID, d.TaskID, d.TagID); err != nil {
			return c.ID, pushServerError("remove link", err)
		}
		return c.ID, pushOK(http.StatusOK)
	}
	if c.ID == "" {
		return invalid("id is required")
	}
	if entity == store.EntitySubtask && d.TaskID == "" {
		return invalid("task_id is required")
	}

	state, err := a.store.EntityState(entity, userID, c.ID)
	if err != nil {
		return c.ID, pushServerError("look up", err)
	}
	switch state {
	case store.RowForeign:
		return c.ID, pushFail(pushNotFound, http.StatusNotFound, "not found")
	case store.RowAbsent, store.RowDeleted:
		return c.ID, pushOK(http.StatusOK)
	}

	switch entity {
	case store.EntityList:
		err = a.store.DeleteTaskList(userID, c.ID)
	case store.EntityTask:
		err = a.store.DeleteTask(userID, c.ID)
	case store.EntitySubtask:
		err = a.store.DeleteSubtask(userID, d.TaskID, c.ID)
	case store.EntityTag:
		err = a.store.DeleteTag(userID, c.ID)
	case store.EntityClass:
		err = a.store.DeleteClass(userID, c.ID)
	case store.EntityEvent:
		err = a.store.DeleteEvent(userID, c.ID)
	}
	// The row was live a moment ago; if it vanished since, the delete still holds.
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		return c.ID, pushServerError("delete", err)
	}
	return c.ID, pushOK(http.StatusOK)
}
