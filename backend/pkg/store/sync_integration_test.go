package store

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/model"
)

// TestSyncChangesIntegration checks the pull side of delta sync: every entity
// kind comes back, tombstones included, filtered by user and by the inclusive
// updated_at cursor, with non-nil slices even when nothing changed. It is
// skipped unless TEST_DATABASE_URL is set, creates its own throwaway users, and
// cleans up every row it creates.
func TestSyncChangesIntegration(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	// Registered before the row-cleanup below so it runs last (t.Cleanup is
	// LIFO): the pool must still be open when that cleanup deletes its rows.
	t.Cleanup(pool.Close)

	s := New(pool)

	stamp := time.Now().UnixNano()
	owner, err := s.Register(fmt.Sprintf("sync-owner-%d@example.com", stamp), "Sync Owner", "hash")
	if err != nil {
		t.Fatalf("register owner: %v", err)
	}
	other, err := s.Register(fmt.Sprintf("sync-other-%d@example.com", stamp), "Sync Other", "hash")
	if err != nil {
		t.Fatalf("register other: %v", err)
	}
	empty, err := s.Register(fmt.Sprintf("sync-empty-%d@example.com", stamp), "Sync Empty", "hash")
	if err != nil {
		t.Fatalf("register empty: %v", err)
	}
	t.Cleanup(func() {
		for _, u := range []string{owner.UserID, other.UserID, empty.UserID} {
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

	// One row of every kind for the owner, wired together.
	list, err := s.CreateTaskList(owner.UserID, model.TaskList{Name: "list"})
	if err != nil {
		t.Fatalf("CreateTaskList: %v", err)
	}
	task, err := s.CreateTask(owner.UserID, model.Task{Title: "task", ListID: sql.NullString{String: list.ListID, Valid: true}})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	loose, err := s.CreateTask(owner.UserID, model.Task{Title: "loose"})
	if err != nil {
		t.Fatalf("CreateTask(loose): %v", err)
	}
	sub, err := s.CreateSubtask(owner.UserID, task.TaskID, model.Subtask{Title: "sub"})
	if err != nil {
		t.Fatalf("CreateSubtask: %v", err)
	}
	tag, err := s.CreateTag(owner.UserID, model.Tag{Name: "tag"})
	if err != nil {
		t.Fatalf("CreateTag: %v", err)
	}
	if err := s.AddTaskTag(owner.UserID, task.TaskID, tag.TagID); err != nil {
		t.Fatalf("AddTaskTag: %v", err)
	}
	class, err := s.CreateClass(owner.UserID, model.ClassSession{Subject: "Math", DayOfWeek: 1, StartMinute: 480, EndMinute: 540})
	if err != nil {
		t.Fatalf("CreateClass: %v", err)
	}
	event, err := s.CreateEvent(owner.UserID, model.Event{Title: "event", StartAt: 1000})
	if err != nil {
		t.Fatalf("CreateEvent: %v", err)
	}

	// Rows owned by someone else must never show up.
	otherList, err := s.CreateTaskList(other.UserID, model.TaskList{Name: "other list"})
	if err != nil {
		t.Fatalf("CreateTaskList(other): %v", err)
	}
	otherTask, err := s.CreateTask(other.UserID, model.Task{Title: "other task"})
	if err != nil {
		t.Fatalf("CreateTask(other): %v", err)
	}
	otherTag, err := s.CreateTag(other.UserID, model.Tag{Name: "other tag"})
	if err != nil {
		t.Fatalf("CreateTag(other): %v", err)
	}
	if err := s.AddTaskTag(other.UserID, otherTask.TaskID, otherTag.TagID); err != nil {
		t.Fatalf("AddTaskTag(other): %v", err)
	}

	// Full snapshot.
	before := time.Now().UnixMilli()
	got, err := s.SyncChanges(owner.UserID, 0)
	if err != nil {
		t.Fatalf("SyncChanges(0): %v", err)
	}
	after := time.Now().UnixMilli()
	if got.Cursor < before || got.Cursor > after {
		t.Errorf("cursor = %d, want within [%d, %d]", got.Cursor, before, after)
	}
	if len(got.Lists) != 1 || got.Lists[0].Row.ListID != list.ListID || got.Lists[0].Row.UserID != owner.UserID || got.Lists[0].Deleted {
		t.Errorf("lists = %+v, want only the owner's live list", got.Lists)
	}
	if len(got.Tasks) != 2 {
		t.Fatalf("tasks = %+v, want the owner's 2 tasks", got.Tasks)
	}
	byTask := map[string]SyncRow[model.Task]{}
	for _, r := range got.Tasks {
		byTask[r.Row.TaskID] = r
		if r.Row.UserID != owner.UserID || r.Deleted {
			t.Errorf("task %s: user %s deleted %v, want the owner's live row", r.Row.TaskID, r.Row.UserID, r.Deleted)
		}
	}
	if l := byTask[task.TaskID].Row.ListID; !l.Valid || l.String != list.ListID {
		t.Errorf("task list_id = %+v, want %s", l, list.ListID)
	}
	if l := byTask[loose.TaskID].Row.ListID; l.Valid {
		t.Errorf("loose task list_id = %+v, want NULL", l)
	}
	if len(got.Subtasks) != 1 || got.Subtasks[0].Row.SubtaskID != sub.SubtaskID || got.Subtasks[0].Row.TaskID != task.TaskID {
		t.Errorf("subtasks = %+v, want the owner's subtask", got.Subtasks)
	}
	if len(got.Tags) != 1 || got.Tags[0].Row.TagID != tag.TagID || got.Tags[0].Row.Name != "tag" || got.Tags[0].Row.UpdatedAt == 0 {
		t.Errorf("tags = %+v, want the owner's tag with updated_at", got.Tags)
	}
	if len(got.TaskTags) != 1 || got.TaskTags[0].Row.TaskID != task.TaskID || got.TaskTags[0].Row.TagID != tag.TagID || got.TaskTags[0].Row.UpdatedAt == 0 || got.TaskTags[0].Deleted {
		t.Errorf("task_tags = %+v, want the owner's live link", got.TaskTags)
	}
	if len(got.Classes) != 1 || got.Classes[0].Row.ClassID != class.ClassID {
		t.Errorf("classes = %+v, want the owner's class", got.Classes)
	}
	if len(got.Events) != 1 || got.Events[0].Row.EventID != event.EventID {
		t.Errorf("events = %+v, want the owner's event", got.Events)
	}
	for _, id := range []string{otherList.ListID, otherTask.TaskID, otherTag.TagID} {
		for _, r := range got.Lists {
			if r.Row.ListID == id {
				t.Errorf("leaked other user's list %s", id)
			}
		}
		for _, r := range got.Tasks {
			if r.Row.TaskID == id {
				t.Errorf("leaked other user's task %s", id)
			}
		}
		for _, r := range got.Tags {
			if r.Row.TagID == id {
				t.Errorf("leaked other user's tag %s", id)
			}
		}
	}

	// since is an inclusive lower bound on updated_at: rewind everything,
	// then touch the event and pin the class to an exact value.
	if _, err := pool.Exec(ctx, `UPDATE tasks SET updated_at = 1 WHERE user_id = $1`, owner.UserID); err != nil {
		t.Fatalf("rewind tasks: %v", err)
	}
	for _, table := range []string{"task_lists", "subtasks", "tags", "task_tags", "class_sessions", "events"} {
		if _, err := pool.Exec(ctx, `UPDATE `+table+` SET updated_at = 1 WHERE user_id = $1`, owner.UserID); err != nil {
			t.Fatalf("rewind %s: %v", table, err)
		}
	}
	if _, err := pool.Exec(ctx, `UPDATE class_sessions SET updated_at = 5000 WHERE user_id = $1`, owner.UserID); err != nil {
		t.Fatalf("pin class: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE events SET updated_at = 9000 WHERE user_id = $1`, owner.UserID); err != nil {
		t.Fatalf("pin event: %v", err)
	}
	got, err = s.SyncChanges(owner.UserID, 5000)
	if err != nil {
		t.Fatalf("SyncChanges(5000): %v", err)
	}
	if len(got.Classes) != 1 || len(got.Events) != 1 || len(got.Lists)+len(got.Tasks)+len(got.Subtasks)+len(got.Tags)+len(got.TaskTags) != 0 {
		t.Errorf("since=5000: %+v, want only the class (== cursor) and event", got)
	}
	got, err = s.SyncChanges(owner.UserID, 5001)
	if err != nil {
		t.Fatalf("SyncChanges(5001): %v", err)
	}
	if len(got.Classes) != 0 || len(got.Events) != 1 {
		t.Errorf("since=5001: classes %d events %d, want 0 and 1", len(got.Classes), len(got.Events))
	}

	// Tombstones: soft-deleted rows come back flagged, not hidden.
	if err := s.DeleteSubtask(owner.UserID, task.TaskID, sub.SubtaskID); err != nil {
		t.Fatalf("DeleteSubtask: %v", err)
	}
	if err := s.RemoveTaskTag(owner.UserID, task.TaskID, tag.TagID); err != nil {
		t.Fatalf("RemoveTaskTag: %v", err)
	}
	if err := s.DeleteTag(owner.UserID, tag.TagID); err != nil {
		t.Fatalf("DeleteTag: %v", err)
	}
	if err := s.DeleteTask(owner.UserID, task.TaskID); err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}
	if err := s.DeleteTaskList(owner.UserID, list.ListID); err != nil {
		t.Fatalf("DeleteTaskList: %v", err)
	}
	if err := s.DeleteClass(owner.UserID, class.ClassID); err != nil {
		t.Fatalf("DeleteClass: %v", err)
	}
	if err := s.DeleteEvent(owner.UserID, event.EventID); err != nil {
		t.Fatalf("DeleteEvent: %v", err)
	}
	got, err = s.SyncChanges(owner.UserID, 10000)
	if err != nil {
		t.Fatalf("SyncChanges(10000): %v", err)
	}
	if len(got.Lists) != 1 || !got.Lists[0].Deleted {
		t.Errorf("lists = %+v, want the deleted list as a tombstone", got.Lists)
	}
	if len(got.Tasks) != 1 || got.Tasks[0].Row.TaskID != task.TaskID || !got.Tasks[0].Deleted {
		t.Errorf("tasks = %+v, want only the deleted task (the loose task is untouched)", got.Tasks)
	}
	if len(got.Subtasks) != 1 || !got.Subtasks[0].Deleted {
		t.Errorf("subtasks = %+v, want a tombstone", got.Subtasks)
	}
	if len(got.Tags) != 1 || !got.Tags[0].Deleted {
		t.Errorf("tags = %+v, want a tombstone", got.Tags)
	}
	if len(got.TaskTags) != 1 || !got.TaskTags[0].Deleted {
		t.Errorf("task_tags = %+v, want a tombstone", got.TaskTags)
	}
	if len(got.Classes) != 1 || !got.Classes[0].Deleted {
		t.Errorf("classes = %+v, want a tombstone", got.Classes)
	}
	if len(got.Events) != 1 || !got.Events[0].Deleted {
		t.Errorf("events = %+v, want a tombstone", got.Events)
	}

	// A user with no rows gets empty, non-nil slices.
	got, err = s.SyncChanges(empty.UserID, 0)
	if err != nil {
		t.Fatalf("SyncChanges(empty): %v", err)
	}
	if got.Lists == nil || got.Tasks == nil || got.Subtasks == nil || got.Tags == nil ||
		got.TaskTags == nil || got.Classes == nil || got.Events == nil {
		t.Errorf("empty user: %+v, want non-nil slices", got)
	}
}
