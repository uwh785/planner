package store

import (
	"context"
	"errors"
	"testing"

	"planner/pkg/model"
)

// TestEventsIntegration exercises the Event store methods against a real
// database. It is skipped unless TEST_DATABASE_URL is set, creates its own
// throwaway user, and cleans up every row it creates.
func TestEventsIntegration(t *testing.T) {
	s, pool, user := newTestStore(t)
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM events WHERE user_id = $1`, user.UserID); err != nil {
			t.Errorf("cleanup: delete events: %v", err)
		}
	})

	const hour = int64(3_600_000)
	base := int64(1_700_000_000_000)
	end := base + 2*hour

	created, err := s.CreateEvent(user.UserID, model.Event{
		Title:    "Thesis presentation",
		Location: "Room 4",
		StartAt:  base,
		EndAt:    &end,
		Color:    "#FF0000",
	})
	if err != nil {
		t.Fatalf("CreateEvent: %v", err)
	}
	if created.EventID == "" {
		t.Fatal("CreateEvent: expected generated event_id")
	}
	if created.UserID != user.UserID {
		t.Errorf("CreateEvent: user_id = %q, want %q", created.UserID, user.UserID)
	}

	// A point event (no end) later on, used to check range overlap.
	point, err := s.CreateEvent(user.UserID, model.Event{Title: "Deadline", StartAt: base + 10*hour, AllDay: true})
	if err != nil {
		t.Fatalf("CreateEvent (point): %v", err)
	}

	got, err := s.GetEvent(user.UserID, created.EventID)
	if err != nil {
		t.Fatalf("GetEvent: %v", err)
	}
	if got.Title != "Thesis presentation" || got.Location != "Room 4" || got.EndAt == nil || *got.EndAt != end {
		t.Errorf("GetEvent: unexpected event = %+v", got)
	}
	if _, err := s.GetEvent("usr_someone_else", created.EventID); err == nil {
		t.Error("GetEvent: expected not found for a different user")
	}

	all, err := s.ListEvents(user.UserID, nil, nil)
	if err != nil {
		t.Fatalf("ListEvents: %v", err)
	}
	if len(all) != 2 || all[0].EventID != created.EventID || all[1].EventID != point.EventID {
		t.Fatalf("ListEvents: got %+v, want [created, point] ordered by start_at", all)
	}

	ptr := func(v int64) *int64 { return &v }
	rangeTests := []struct {
		name     string
		from, to *int64
		want     []string
	}{
		{name: "range overlapping the tail of a span", from: ptr(base + hour), to: ptr(base + 3*hour), want: []string{created.EventID}},
		{name: "range starting exactly at span end", from: ptr(end), to: ptr(end + hour), want: []string{created.EventID}},
		{name: "range ending at span start excludes it", from: ptr(base - hour), to: ptr(base), want: nil},
		{name: "range containing a point event", from: ptr(base + 9*hour), to: ptr(base + 11*hour), want: []string{point.EventID}},
		{name: "only from", from: ptr(base + 5*hour), want: []string{point.EventID}},
		{name: "only to", to: ptr(base + 5*hour), want: []string{created.EventID}},
	}
	for _, tt := range rangeTests {
		t.Run(tt.name, func(t *testing.T) {
			items, err := s.ListEvents(user.UserID, tt.from, tt.to)
			if err != nil {
				t.Fatalf("ListEvents: %v", err)
			}
			var ids []string
			for _, e := range items {
				ids = append(ids, e.EventID)
			}
			if len(ids) != len(tt.want) {
				t.Fatalf("ListEvents: got %v, want %v", ids, tt.want)
			}
			for i := range ids {
				if ids[i] != tt.want[i] {
					t.Fatalf("ListEvents: got %v, want %v", ids, tt.want)
				}
			}
		})
	}

	got.Title = "Final presentation"
	got.EndAt = nil
	if err := s.UpdateEvent(user.UserID, got); err != nil {
		t.Fatalf("UpdateEvent: %v", err)
	}
	updated, err := s.GetEvent(user.UserID, created.EventID)
	if err != nil {
		t.Fatalf("GetEvent after update: %v", err)
	}
	if updated.Title != "Final presentation" || updated.EndAt != nil {
		t.Errorf("UpdateEvent: got %+v, want title=Final presentation end_at=nil", updated)
	}

	if err := s.UpdateEvent(user.UserID, model.Event{EventID: "evt_does_not_exist", Title: "x", StartAt: 1}); !errors.Is(err, ErrNotFound) {
		t.Errorf("UpdateEvent on missing event: err = %v, want ErrNotFound", err)
	}
	if err := s.UpdateEvent("usr_someone_else", got); !errors.Is(err, ErrNotFound) {
		t.Errorf("UpdateEvent for another user: err = %v, want ErrNotFound", err)
	}
	if err := s.DeleteEvent("usr_someone_else", created.EventID); !errors.Is(err, ErrNotFound) {
		t.Errorf("DeleteEvent for another user: err = %v, want ErrNotFound", err)
	}

	if err := s.DeleteEvent(user.UserID, created.EventID); err != nil {
		t.Fatalf("DeleteEvent: %v", err)
	}
	if _, err := s.GetEvent(user.UserID, created.EventID); err == nil {
		t.Error("GetEvent after delete: expected not found")
	}
	if err := s.DeleteEvent(user.UserID, created.EventID); !errors.Is(err, ErrNotFound) {
		t.Errorf("DeleteEvent again: err = %v, want ErrNotFound", err)
	}
	remaining, err := s.ListEvents(user.UserID, nil, nil)
	if err != nil {
		t.Fatalf("ListEvents after delete: %v", err)
	}
	if len(remaining) != 1 || remaining[0].EventID != point.EventID {
		t.Errorf("ListEvents after delete: got %+v, want only the point event", remaining)
	}
}
