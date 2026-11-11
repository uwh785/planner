package model

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestValidateEvent(t *testing.T) {
	int64Ptr := func(v int64) *int64 { return &v }
	valid := func() Event {
		return Event{
			Title:   "Thesis presentation",
			StartAt: 1_700_000_000_000,
		}
	}

	tests := []struct {
		name    string
		mutate  func(*Event)
		wantErr bool
	}{
		{name: "valid", mutate: func(e *Event) {}},
		{name: "valid with end after start", mutate: func(e *Event) { e.EndAt = int64Ptr(e.StartAt + 3_600_000) }},
		{name: "valid with end equal to start", mutate: func(e *Event) { e.EndAt = int64Ptr(e.StartAt) }},
		{name: "empty title", mutate: func(e *Event) { e.Title = "" }, wantErr: true},
		{name: "whitespace title", mutate: func(e *Event) { e.Title = "   " }, wantErr: true},
		{name: "title at limit", mutate: func(e *Event) { e.Title = strings.Repeat("a", 200) }},
		{name: "title too long", mutate: func(e *Event) { e.Title = strings.Repeat("a", 201) }, wantErr: true},
		{name: "description at limit", mutate: func(e *Event) { e.Description = strings.Repeat("a", 5000) }},
		{name: "description too long", mutate: func(e *Event) { e.Description = strings.Repeat("a", 5001) }, wantErr: true},
		{name: "location at limit", mutate: func(e *Event) { e.Location = strings.Repeat("a", 200) }},
		{name: "location too long", mutate: func(e *Event) { e.Location = strings.Repeat("a", 201) }, wantErr: true},
		{name: "missing start", mutate: func(e *Event) { e.StartAt = 0 }, wantErr: true},
		{name: "negative start", mutate: func(e *Event) { e.StartAt = -1 }, wantErr: true},
		{name: "end before start", mutate: func(e *Event) { e.EndAt = int64Ptr(e.StartAt - 1) }, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := valid()
			tt.mutate(&e)
			err := ValidateEvent(&e)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateEvent() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateEventNormalizes(t *testing.T) {
	e := Event{
		Title:       "  Thesis  ",
		Description: "  notes  ",
		Location:    "  Room 4  ",
		StartAt:     1,
	}
	if err := ValidateEvent(&e); err != nil {
		t.Fatalf("ValidateEvent() error = %v", err)
	}
	if e.Title != "Thesis" || e.Description != "notes" || e.Location != "Room 4" {
		t.Errorf("ValidateEvent() did not trim: %+v", e)
	}
	if e.Color != defaultEventColor {
		t.Errorf("Color = %q, want default %q", e.Color, defaultEventColor)
	}
}

func TestValidateEventKeepsColor(t *testing.T) {
	e := Event{Title: "x", StartAt: 1, Color: "#FF0000"}
	if err := ValidateEvent(&e); err != nil {
		t.Fatalf("ValidateEvent() error = %v", err)
	}
	if e.Color != "#FF0000" {
		t.Errorf("Color = %q, want %q", e.Color, "#FF0000")
	}
}

func TestEventMarshalJSONIncludesRemind(t *testing.T) {
	tests := []struct {
		name       string
		remind     bool
		wantEncode string
	}{
		{name: "false", remind: false, wantEncode: "false"},
		{name: "true", remind: true, wantEncode: "true"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw, err := json.Marshal(Event{EventID: "evt_1", Remind: &tt.remind})
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got map[string]json.RawMessage
			if err := json.Unmarshal(raw, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if string(got["remind"]) != tt.wantEncode {
				t.Errorf("remind = %s, want %s", got["remind"], tt.wantEncode)
			}
		})
	}
}

// A client that predates the field omits it; that must stay distinguishable
// from an explicit false so an update can keep the stored value.
func TestEventUnmarshalJSONRemind(t *testing.T) {
	boolPtr := func(v bool) *bool { return &v }
	tests := []struct {
		name string
		body string
		want *bool
	}{
		{name: "absent", body: `{"title":"Exam","start_at":1}`, want: nil},
		{name: "false", body: `{"title":"Exam","start_at":1,"remind":false}`, want: boolPtr(false)},
		{name: "true", body: `{"title":"Exam","start_at":1,"remind":true}`, want: boolPtr(true)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var e Event
			if err := json.Unmarshal([]byte(tt.body), &e); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if (e.Remind == nil) != (tt.want == nil) {
				t.Fatalf("remind = %v, want %v", e.Remind, tt.want)
			}
			if tt.want != nil && *e.Remind != *tt.want {
				t.Errorf("remind = %v, want %v", *e.Remind, *tt.want)
			}
		})
	}
}
