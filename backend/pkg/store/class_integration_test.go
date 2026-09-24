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

// TestClassSessionsIntegration exercises the ClassSession store methods
// against a real database. It is skipped unless TEST_DATABASE_URL is set,
// creates its own throwaway user, and cleans up every row it creates.
func TestClassSessionsIntegration(t *testing.T) {
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

	email := fmt.Sprintf("class-test-%d@example.com", time.Now().UnixNano())
	user, err := s.Register(email, "Class Test User", "hash")
	if err != nil {
		t.Fatalf("register throwaway user: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM class_sessions WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete class_sessions: %v", err)
		}
		if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete app_users: %v", err)
		}
	})

	class := model.ClassSession{
		Subject:     "Math",
		DayOfWeek:   1,
		StartMinute: 480,
		EndMinute:   540,
		Room:        "101",
		Teacher:     "Smith",
		Color:       "#FF0000",
	}

	created, err := s.CreateClass(user.UserID, class)
	if err != nil {
		t.Fatalf("CreateClass: %v", err)
	}
	if created.ClassID == "" {
		t.Fatal("CreateClass: expected generated class_id")
	}
	if created.UserID != user.UserID {
		t.Errorf("CreateClass: user_id = %q, want %q", created.UserID, user.UserID)
	}

	got, err := s.GetClass(user.UserID, created.ClassID)
	if err != nil {
		t.Fatalf("GetClass: %v", err)
	}
	if got.Subject != "Math" || got.Room != "101" || got.Teacher != "Smith" {
		t.Errorf("GetClass: unexpected class = %+v", got)
	}

	// scoped by user: another user's id must not see it
	if _, err := s.GetClass("usr_someone_else", created.ClassID); err == nil {
		t.Error("GetClass: expected not found for a different user")
	}

	list, err := s.ListClasses(user.UserID, nil)
	if err != nil {
		t.Fatalf("ListClasses: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("ListClasses: got %d classes, want 1", len(list))
	}

	sameDay := 1
	filtered, err := s.ListClasses(user.UserID, &sameDay)
	if err != nil {
		t.Fatalf("ListClasses(day=1): %v", err)
	}
	if len(filtered) != 1 {
		t.Errorf("ListClasses(day=1): got %d, want 1", len(filtered))
	}

	otherDay := 2
	filteredEmpty, err := s.ListClasses(user.UserID, &otherDay)
	if err != nil {
		t.Fatalf("ListClasses(day=2): %v", err)
	}
	if len(filteredEmpty) != 0 {
		t.Errorf("ListClasses(day=2): got %d, want 0", len(filteredEmpty))
	}

	got.Subject = "Advanced Math"
	got.Room = "202"
	if err := s.UpdateClass(user.UserID, got); err != nil {
		t.Fatalf("UpdateClass: %v", err)
	}
	updated, err := s.GetClass(user.UserID, created.ClassID)
	if err != nil {
		t.Fatalf("GetClass after update: %v", err)
	}
	if updated.Subject != "Advanced Math" || updated.Room != "202" {
		t.Errorf("UpdateClass: got %+v, want subject=Advanced Math room=202", updated)
	}

	if err := s.UpdateClass(user.UserID, model.ClassSession{ClassID: "cls_does_not_exist"}); !errors.Is(err, ErrNotFound) {
		t.Errorf("UpdateClass on missing class: err = %v, want ErrNotFound", err)
	}

	if err := s.DeleteClass(user.UserID, created.ClassID); err != nil {
		t.Fatalf("DeleteClass: %v", err)
	}
	if _, err := s.GetClass(user.UserID, created.ClassID); err == nil {
		t.Error("GetClass after delete: expected not found")
	}
	if err := s.DeleteClass(user.UserID, created.ClassID); !errors.Is(err, ErrNotFound) {
		t.Errorf("DeleteClass again: err = %v, want ErrNotFound", err)
	}
}
