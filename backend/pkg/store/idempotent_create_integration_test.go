package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/model"
)

// TestIdempotentCreateIntegration checks the offline-replay contract of the
// create paths: a client-supplied ID is honored, a duplicate create never
// inserts or mutates, Replay* returns the caller's own live row, and an ID
// that is soft-deleted or owned by another user reads as ErrConflict without
// leaking the other user's data. It is skipped unless TEST_DATABASE_URL is
// set, creates two throwaway users, and cleans up every row it creates.
func TestIdempotentCreateIntegration(t *testing.T) {
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
	owner, err := s.Register(fmt.Sprintf("idem-owner-%d@example.com", stamp), "Idem Owner", "hash")
	if err != nil {
		t.Fatalf("register owner: %v", err)
	}
	other, err := s.Register(fmt.Sprintf("idem-other-%d@example.com", stamp), "Idem Other", "hash")
	if err != nil {
		t.Fatalf("register other: %v", err)
	}
	t.Cleanup(func() {
		for _, u := range []string{owner.UserID, other.UserID} {
			for _, table := range []string{"subtasks", "tags", "tasks", "task_lists", "class_sessions", "events"} {
				if _, err := pool.Exec(context.Background(), `DELETE FROM `+table+` WHERE user_id = $1`, u); err != nil {
					t.Errorf("cleanup: delete %s: %v", table, err)
				}
			}
			if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, u); err != nil {
				t.Errorf("cleanup: delete app_users: %v", err)
			}
		}
	})

	suffix := fmt.Sprint(stamp)
	taskID := "tsk_idem_" + suffix
	parentID := "tsk_idem_parent_" + suffix

	// Subtasks reference their parent task by foreign key.
	if _, err := s.CreateTask(owner.UserID, model.Task{TaskID: parentID, Title: "parent"}); err != nil {
		t.Fatalf("create parent task: %v", err)
	}

	cases := []struct {
		name string
		// create inserts the fixture row for the given user with the stable
		// client ID and the given title/name marker.
		create func(userID, marker string) error
		// replay returns the marker stored on the row Replay* finds.
		replay func(userID string) (string, error)
		remove func(userID string) error
	}{
		{
			name: "task",
			create: func(u, m string) error {
				_, err := s.CreateTask(u, model.Task{TaskID: taskID, Title: m})
				return err
			},
			replay: func(u string) (string, error) {
				v, err := s.ReplayTask(u, taskID)
				return v.Title, err
			},
			remove: func(u string) error { return s.DeleteTask(u, taskID) },
		},
		{
			name: "list",
			create: func(u, m string) error {
				_, err := s.CreateTaskList(u, model.TaskList{ListID: "lst_idem_" + suffix, Name: m})
				return err
			},
			replay: func(u string) (string, error) {
				v, err := s.ReplayTaskList(u, "lst_idem_"+suffix)
				return v.Name, err
			},
			remove: func(u string) error { return s.DeleteTaskList(u, "lst_idem_"+suffix) },
		},
		{
			name: "tag",
			create: func(u, m string) error {
				_, err := s.CreateTag(u, model.Tag{TagID: "tag_idem_" + suffix, Name: m})
				return err
			},
			replay: func(u string) (string, error) {
				v, err := s.ReplayTag(u, "tag_idem_"+suffix)
				return v.Name, err
			},
			remove: func(u string) error { return s.DeleteTag(u, "tag_idem_"+suffix) },
		},
		{
			name: "subtask",
			create: func(u, m string) error {
				_, err := s.CreateSubtask(u, parentID, model.Subtask{SubtaskID: "sub_idem_" + suffix, Title: m})
				return err
			},
			replay: func(u string) (string, error) {
				v, err := s.ReplaySubtask(u, parentID, "sub_idem_"+suffix)
				return v.Title, err
			},
			remove: func(u string) error { return s.DeleteSubtask(u, parentID, "sub_idem_"+suffix) },
		},
		{
			name: "class",
			create: func(u, m string) error {
				_, err := s.CreateClass(u, model.ClassSession{ClassID: "cls_idem_" + suffix, Subject: m, DayOfWeek: 1, StartMinute: 480, EndMinute: 540})
				return err
			},
			replay: func(u string) (string, error) {
				v, err := s.ReplayClass(u, "cls_idem_"+suffix)
				return v.Subject, err
			},
			remove: func(u string) error { return s.DeleteClass(u, "cls_idem_"+suffix) },
		},
		{
			name: "event",
			create: func(u, m string) error {
				_, err := s.CreateEvent(u, model.Event{EventID: "evt_idem_" + suffix, Title: m, StartAt: 1000})
				return err
			},
			replay: func(u string) (string, error) {
				v, err := s.ReplayEvent(u, "evt_idem_"+suffix)
				return v.Title, err
			},
			remove: func(u string) error { return s.DeleteEvent(u, "evt_idem_"+suffix) },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := tc.replay(owner.UserID); !errors.Is(err, ErrNotFound) {
				t.Fatalf("replay before create: err = %v, want ErrNotFound", err)
			}

			if err := tc.create(owner.UserID, "original"); err != nil {
				t.Fatalf("first create: %v", err)
			}

			// A duplicate create must not insert or mutate.
			if err := tc.create(owner.UserID, "changed"); !errors.Is(err, ErrConflict) {
				t.Fatalf("duplicate create: err = %v, want ErrConflict", err)
			}
			got, err := tc.replay(owner.UserID)
			if err != nil {
				t.Fatalf("replay: %v", err)
			}
			if got != "original" {
				t.Errorf("stored marker = %q after duplicate create, want %q", got, "original")
			}

			// Another user's collision is a conflict that exposes nothing.
			if err := tc.create(other.UserID, "intruder"); !errors.Is(err, ErrConflict) {
				t.Errorf("cross-user create: err = %v, want ErrConflict", err)
			}
			leaked, err := tc.replay(other.UserID)
			if !errors.Is(err, ErrConflict) {
				t.Errorf("cross-user replay: err = %v, want ErrConflict", err)
			}
			if leaked != "" {
				t.Errorf("cross-user replay leaked %q", leaked)
			}

			// A soft-deleted row is never resurrected by a replayed create.
			if err := tc.remove(owner.UserID); err != nil {
				t.Fatalf("delete: %v", err)
			}
			if _, err := tc.replay(owner.UserID); !errors.Is(err, ErrConflict) {
				t.Errorf("replay after delete: err = %v, want ErrConflict", err)
			}
			if err := tc.create(owner.UserID, "again"); !errors.Is(err, ErrConflict) {
				t.Errorf("create after delete: err = %v, want ErrConflict", err)
			}
		})
	}
}
