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

// TestTombstonesIntegration checks the delta-sync contract of the soft
// deletes: every delete bumps updated_at, tags and task_tags are tombstoned
// rather than removed, reads hide the tombstones, and the plan-cap count
// excludes them while the storage-ceiling total keeps them. It is skipped
// unless TEST_DATABASE_URL is set, creates its own throwaway user, and
// cleans up every row it creates.
func TestTombstonesIntegration(t *testing.T) {
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

	email := fmt.Sprintf("tombstone-test-%d@example.com", time.Now().UnixNano())
	user, err := s.Register(email, "Tombstone Test User", "hash")
	if err != nil {
		t.Fatalf("register throwaway user: %v", err)
	}
	t.Cleanup(func() {
		for _, table := range []string{"task_tags", "tags", "subtasks", "tasks", "task_lists", "class_sessions", "events"} {
			if _, err := pool.Exec(context.Background(), `DELETE FROM `+table+` WHERE user_id = $1`, user.UserID); err != nil {
				t.Errorf("cleanup: delete %s: %v", table, err)
			}
		}
		if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete app_users: %v", err)
		}
	})

	// row reads (updated_at, deleted) for one row, failing the test if it is
	// gone (a hard delete) -- tombstones must stay in the table.
	row := func(table, idCol, id string) (updatedAt int64, deleted int) {
		t.Helper()
		err := pool.QueryRow(context.Background(),
			`SELECT updated_at, deleted FROM `+table+` WHERE user_id = $1 AND `+idCol+` = $2`,
			user.UserID, id,
		).Scan(&updatedAt, &deleted)
		if err != nil {
			t.Fatalf("read %s %s: %v", table, id, err)
		}
		return updatedAt, deleted
	}
	// stale rewinds a row's updated_at so a later bump is unambiguous even
	// within the same millisecond.
	stale := func(table, idCol, id string) {
		t.Helper()
		if _, err := pool.Exec(context.Background(),
			`UPDATE `+table+` SET updated_at = 1 WHERE user_id = $1 AND `+idCol+` = $2`,
			user.UserID, id,
		); err != nil {
			t.Fatalf("rewind %s %s: %v", table, id, err)
		}
	}
	assertTombstone := func(name, table, idCol, id string) {
		t.Helper()
		updatedAt, deleted := row(table, idCol, id)
		if deleted != 1 {
			t.Errorf("%s: deleted = %d, want 1", name, deleted)
		}
		if updatedAt <= 1000 {
			t.Errorf("%s: updated_at = %d, want it bumped to now", name, updatedAt)
		}
	}

	// Existing soft deletes bump updated_at.
	task, err := s.CreateTask(user.UserID, model.Task{Title: "task"})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	sub, err := s.CreateSubtask(user.UserID, task.TaskID, model.Subtask{Title: "sub"})
	if err != nil {
		t.Fatalf("CreateSubtask: %v", err)
	}
	list, err := s.CreateTaskList(user.UserID, model.TaskList{Name: "list"})
	if err != nil {
		t.Fatalf("CreateTaskList: %v", err)
	}
	class, err := s.CreateClass(user.UserID, model.ClassSession{Subject: "Math", DayOfWeek: 1, StartMinute: 480, EndMinute: 540})
	if err != nil {
		t.Fatalf("CreateClass: %v", err)
	}
	event, err := s.CreateEvent(user.UserID, model.Event{Title: "event", StartAt: 1000})
	if err != nil {
		t.Fatalf("CreateEvent: %v", err)
	}

	stale("subtasks", "subtask_id", sub.SubtaskID)
	if err := s.DeleteSubtask(user.UserID, task.TaskID, sub.SubtaskID); err != nil {
		t.Fatalf("DeleteSubtask: %v", err)
	}
	assertTombstone("DeleteSubtask", "subtasks", "subtask_id", sub.SubtaskID)

	stale("task_lists", "list_id", list.ListID)
	if err := s.DeleteTaskList(user.UserID, list.ListID); err != nil {
		t.Fatalf("DeleteTaskList: %v", err)
	}
	assertTombstone("DeleteTaskList", "task_lists", "list_id", list.ListID)

	stale("class_sessions", "class_id", class.ClassID)
	if err := s.DeleteClass(user.UserID, class.ClassID); err != nil {
		t.Fatalf("DeleteClass: %v", err)
	}
	assertTombstone("DeleteClass", "class_sessions", "class_id", class.ClassID)

	stale("events", "event_id", event.EventID)
	if err := s.DeleteEvent(user.UserID, event.EventID); err != nil {
		t.Fatalf("DeleteEvent: %v", err)
	}
	assertTombstone("DeleteEvent", "events", "event_id", event.EventID)

	// Tags and task_tags.
	keep, err := s.CreateTag(user.UserID, model.Tag{Name: "keep"})
	if err != nil {
		t.Fatalf("CreateTag(keep): %v", err)
	}
	gone, err := s.CreateTag(user.UserID, model.Tag{Name: "gone"})
	if err != nil {
		t.Fatalf("CreateTag(gone): %v", err)
	}
	if updatedAt, deleted := row("tags", "tag_id", keep.TagID); updatedAt <= 1000 || deleted != 0 {
		t.Errorf("CreateTag: updated_at = %d deleted = %d, want updated_at set and deleted 0", updatedAt, deleted)
	}

	if err := s.AddTaskTag(user.UserID, task.TaskID, keep.TagID); err != nil {
		t.Fatalf("AddTaskTag(keep): %v", err)
	}
	if err := s.AddTaskTag(user.UserID, task.TaskID, gone.TagID); err != nil {
		t.Fatalf("AddTaskTag(gone): %v", err)
	}
	ttTombstone := func(name, tagID string) {
		t.Helper()
		var updatedAt int64
		var deleted int
		if err := pool.QueryRow(context.Background(),
			`SELECT updated_at, deleted FROM task_tags WHERE user_id = $1 AND task_id = $2 AND tag_id = $3`,
			user.UserID, task.TaskID, tagID,
		).Scan(&updatedAt, &deleted); err != nil {
			t.Fatalf("%s: read task_tags: %v", name, err)
		}
		if deleted != 1 || updatedAt <= 1000 {
			t.Errorf("%s: task_tags updated_at = %d deleted = %d, want a bumped tombstone", name, updatedAt, deleted)
		}
	}

	full, err := s.GetTaskFull(user.UserID, task.TaskID)
	if err != nil {
		t.Fatalf("GetTaskFull: %v", err)
	}
	if len(full.Tags) != 2 {
		t.Fatalf("GetTaskFull: got %d tags, want 2", len(full.Tags))
	}

	// RemoveTaskTag tombstones the link and hides it, then AddTaskTag
	// resurrects it instead of failing on the primary key.
	if _, err := pool.Exec(context.Background(),
		`UPDATE task_tags SET updated_at = 1 WHERE user_id = $1 AND task_id = $2 AND tag_id = $3`,
		user.UserID, task.TaskID, keep.TagID); err != nil {
		t.Fatalf("rewind task_tags: %v", err)
	}
	if err := s.RemoveTaskTag(user.UserID, task.TaskID, keep.TagID); err != nil {
		t.Fatalf("RemoveTaskTag: %v", err)
	}
	ttTombstone("RemoveTaskTag", keep.TagID)
	if tags, err := s.ListTaskTags(user.UserID, task.TaskID); err != nil || len(tags) != 1 {
		t.Fatalf("ListTaskTags after remove: tags = %v err = %v, want 1 tag", tags, err)
	}

	if _, err := pool.Exec(context.Background(),
		`UPDATE task_tags SET updated_at = 1 WHERE user_id = $1 AND task_id = $2 AND tag_id = $3`,
		user.UserID, task.TaskID, keep.TagID); err != nil {
		t.Fatalf("rewind task_tags: %v", err)
	}
	if err := s.AddTaskTag(user.UserID, task.TaskID, keep.TagID); err != nil {
		t.Fatalf("AddTaskTag (resurrect): %v", err)
	}
	var updatedAt int64
	var deleted int
	if err := pool.QueryRow(context.Background(),
		`SELECT updated_at, deleted FROM task_tags WHERE user_id = $1 AND task_id = $2 AND tag_id = $3`,
		user.UserID, task.TaskID, keep.TagID,
	).Scan(&updatedAt, &deleted); err != nil {
		t.Fatalf("read resurrected task_tags: %v", err)
	}
	if deleted != 0 || updatedAt <= 1000 {
		t.Errorf("AddTaskTag (resurrect): updated_at = %d deleted = %d, want deleted 0 and bumped", updatedAt, deleted)
	}
	if tags, err := s.ListTaskTags(user.UserID, task.TaskID); err != nil || len(tags) != 2 {
		t.Fatalf("ListTaskTags after resurrect: tags = %v err = %v, want 2 tags", tags, err)
	}

	// DeleteTag tombstones the tag and every link to it.
	stale("tags", "tag_id", gone.TagID)
	if _, err := pool.Exec(context.Background(),
		`UPDATE task_tags SET updated_at = 1 WHERE user_id = $1 AND tag_id = $2`,
		user.UserID, gone.TagID); err != nil {
		t.Fatalf("rewind task_tags: %v", err)
	}
	if err := s.DeleteTag(user.UserID, gone.TagID); err != nil {
		t.Fatalf("DeleteTag: %v", err)
	}
	assertTombstone("DeleteTag", "tags", "tag_id", gone.TagID)
	ttTombstone("DeleteTag cascade", gone.TagID)

	tags, err := s.ListTags(user.UserID)
	if err != nil {
		t.Fatalf("ListTags: %v", err)
	}
	if len(tags) != 1 || tags[0].TagID != keep.TagID {
		t.Errorf("ListTags: got %+v, want only the kept tag", tags)
	}
	full, err = s.GetTaskFull(user.UserID, task.TaskID)
	if err != nil {
		t.Fatalf("GetTaskFull after DeleteTag: %v", err)
	}
	if len(full.Tags) != 1 || full.Tags[0].TagID != keep.TagID {
		t.Errorf("GetTaskFull: tags = %+v, want only the kept tag", full.Tags)
	}

	// Active excludes tombstones (plan cap); Total keeps them (ceiling).
	active, err := s.CountTags(user.UserID)
	if err != nil {
		t.Fatalf("CountTags: %v", err)
	}
	if active != 1 {
		t.Errorf("CountTags: got %d, want 1 active", active)
	}
	usage, err := s.CountTagsUsage(user.UserID)
	if err != nil {
		t.Fatalf("CountTagsUsage: %v", err)
	}
	if usage.Active != 1 || usage.Total != 2 {
		t.Errorf("CountTagsUsage: got %+v, want Active 1 Total 2", usage)
	}

	// DeleteTask bumps updated_at too.
	stale("tasks", "task_id", task.TaskID)
	if err := s.DeleteTask(user.UserID, task.TaskID); err != nil {
		t.Fatalf("DeleteTask: %v", err)
	}
	assertTombstone("DeleteTask", "tasks", "task_id", task.TaskID)
}
