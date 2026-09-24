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

// TestTasksDueAllDayAndRangeIntegration exercises the due_all_day overdue
// rule and the from/to range filter against a real database. It is skipped
// unless TEST_DATABASE_URL is set, creates its own throwaway user, and
// cleans up every row it creates.
func TestTasksDueAllDayAndRangeIntegration(t *testing.T) {
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

	email := fmt.Sprintf("task-range-test-%d@example.com", time.Now().UnixNano())
	user, err := s.Register(email, "Task Range Test User", "hash")
	if err != nil {
		t.Fatalf("register throwaway user: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM tasks WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete tasks: %v", err)
		}
		if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete app_users: %v", err)
		}
	})

	now := time.Now()
	loc := now.Location()
	todayMidnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	yesterdayMidnight := todayMidnight.AddDate(0, 0, -1)
	oneHourAgo := now.Add(-time.Hour)
	tomorrow := now.AddDate(0, 0, 1)

	mustCreate := func(title string, dueDate int64, allDay bool) model.Task {
		created, err := s.CreateTask(user.UserID, model.Task{
			Title:     title,
			DueDate:   &dueDate,
			DueAllDay: allDay,
		})
		if err != nil {
			t.Fatalf("CreateTask(%s): %v", title, err)
		}
		return created
	}

	overdueAllDay := mustCreate("overdue all-day (yesterday midnight)", yesterdayMidnight.UnixMilli(), true)
	notOverdueAllDay := mustCreate("not overdue all-day (today midnight)", todayMidnight.UnixMilli(), true)
	overdueTimed := mustCreate("overdue timed (1h ago)", oneHourAgo.UnixMilli(), false)
	notOverdueTimed := mustCreate("not overdue timed (tomorrow)", tomorrow.UnixMilli(), false)

	// due_all_day round-trips through create and get.
	got, err := s.GetTask(user.UserID, overdueAllDay.TaskID)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if !got.DueAllDay {
		t.Errorf("GetTask: due_all_day = false, want true")
	}

	// overdue filter: yesterday-midnight all-day and 1h-ago timed are
	// overdue; today-midnight all-day and tomorrow timed are not.
	overdueList, _, err := s.ListTasks(user.UserID, TaskFilters{Status: "overdue"}, 100, 0)
	if err != nil {
		t.Fatalf("ListTasks(overdue): %v", err)
	}
	overdueIDs := map[string]bool{}
	for _, task := range overdueList {
		overdueIDs[task.TaskID] = true
	}
	if !overdueIDs[overdueAllDay.TaskID] {
		t.Errorf("overdue filter: expected yesterday-midnight all-day task to be overdue")
	}
	if !overdueIDs[overdueTimed.TaskID] {
		t.Errorf("overdue filter: expected 1h-ago timed task to be overdue")
	}
	if overdueIDs[notOverdueAllDay.TaskID] {
		t.Errorf("overdue filter: today-midnight all-day task should not be overdue yet")
	}
	if overdueIDs[notOverdueTimed.TaskID] {
		t.Errorf("overdue filter: tomorrow timed task should not be overdue")
	}

	// dashboard summary overdue count matches the same rule.
	summary, err := s.GetDashboardSummary(user.UserID)
	if err != nil {
		t.Fatalf("GetDashboardSummary: %v", err)
	}
	if summary.Overdue != 2 {
		t.Errorf("GetDashboardSummary: overdue = %d, want 2", summary.Overdue)
	}

	// from/to range: [todayMidnight, todayMidnight+1day) should return the
	// two tasks due today (the today-midnight all-day task and the 1h-ago
	// timed task) and exclude yesterday's and tomorrow's.
	from := todayMidnight.UnixMilli()
	to := todayMidnight.AddDate(0, 0, 1).UnixMilli()
	ranged, _, err := s.ListTasks(user.UserID, TaskFilters{From: &from, To: &to}, 100, 0)
	if err != nil {
		t.Fatalf("ListTasks(from/to): %v", err)
	}
	rangedIDs := map[string]bool{}
	for _, task := range ranged {
		rangedIDs[task.TaskID] = true
	}
	if len(ranged) != 2 {
		t.Errorf("ListTasks(from/to): got %d tasks, want 2", len(ranged))
	}
	if !rangedIDs[notOverdueAllDay.TaskID] {
		t.Errorf("ListTasks(from/to): expected today-midnight all-day task in range")
	}
	if !rangedIDs[overdueTimed.TaskID] {
		t.Errorf("ListTasks(from/to): expected 1h-ago timed task in range")
	}
	if rangedIDs[overdueAllDay.TaskID] {
		t.Errorf("ListTasks(from/to): yesterday's all-day task should not be in range")
	}
	if rangedIDs[notOverdueTimed.TaskID] {
		t.Errorf("ListTasks(from/to): tomorrow's timed task should not be in range")
	}
}
