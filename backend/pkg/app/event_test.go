package app

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"planner/pkg/plan"
)

// These tests exercise the request-validation paths of the events handlers
// that return before touching the store, so they run without a database.

func TestEventRoutesRegistered(t *testing.T) {
	a := &App{}
	router, ok := a.Handler().(chi.Routes)
	if !ok {
		t.Fatal("Handler() is not a chi.Routes")
	}

	want := map[string]bool{
		"GET /api/events":         false,
		"POST /api/events":        false,
		"GET /api/events/{id}":    false,
		"PUT /api/events/{id}":    false,
		"DELETE /api/events/{id}": false,
	}
	err := chi.Walk(router, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		key := method + " " + route
		if _, ok := want[key]; ok {
			want[key] = true
		}
		return nil
	})
	if err != nil {
		t.Fatalf("chi.Walk: %v", err)
	}
	for route, found := range want {
		if !found {
			t.Errorf("route %s not registered", route)
		}
	}
}

func TestListEventsInvalidRangeReturns400(t *testing.T) {
	tests := []struct {
		name  string
		query string
	}{
		{name: "non-numeric from", query: "?from=abc"},
		{name: "negative to", query: "?to=-1"},
		{name: "from not before to", query: "?from=10&to=10"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &App{}
			req := httptest.NewRequest(http.MethodGet, "/api/events"+tt.query, nil)
			w := httptest.NewRecorder()

			a.listEvents(w, req)

			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestCreateEventInvalidBodyReturns400(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "malformed json", body: "not json"},
		{name: "missing title", body: `{"start_at":1700000000000}`},
		{name: "blank title", body: `{"title":"   ","start_at":1700000000000}`},
		{name: "title too long", body: `{"title":"` + strings.Repeat("a", 201) + `","start_at":1700000000000}`},
		{name: "description too long", body: `{"title":"x","description":"` + strings.Repeat("a", 5001) + `","start_at":1700000000000}`},
		{name: "location too long", body: `{"title":"x","location":"` + strings.Repeat("a", 201) + `","start_at":1700000000000}`},
		{name: "missing start", body: `{"title":"x"}`},
		{name: "end before start", body: `{"title":"x","start_at":1700000000000,"end_at":1699999999999}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &App{}
			req := httptest.NewRequest(http.MethodPost, "/api/events", strings.NewReader(tt.body))
			w := httptest.NewRecorder()

			a.createEvent(w, req)

			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestUpdateEventInvalidBodyReturns400(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "malformed json", body: "not json"},
		{name: "blank title", body: `{"title":"","start_at":1700000000000}`},
		{name: "end before start", body: `{"title":"x","start_at":1700000000000,"end_at":1}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &App{}
			req := httptest.NewRequest(http.MethodPut, "/api/events/evt_1", strings.NewReader(tt.body))
			w := httptest.NewRecorder()

			a.updateEvent(w, req)

			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestEventOversizedBodyReturns413(t *testing.T) {
	a := &App{}
	tests := []struct {
		name    string
		method  string
		handler http.HandlerFunc
	}{
		{name: "create", method: http.MethodPost, handler: a.createEvent},
		{name: "update", method: http.MethodPut, handler: a.updateEvent},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/api/events", bytes.NewReader(oversizedJSONBody()))
			w := httptest.NewRecorder()
			req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

			tt.handler(w, req)

			if w.Code != http.StatusRequestEntityTooLarge {
				t.Fatalf("status = %d, want %d", w.Code, http.StatusRequestEntityTooLarge)
			}
		})
	}
}

func TestEnforceCeilingEvents(t *testing.T) {
	tests := []struct {
		name     string
		total    int
		wantOK   bool
		wantCode int
	}{
		{name: "under ceiling", total: 1999, wantOK: true, wantCode: http.StatusOK},
		{name: "at ceiling refused", total: 2000, wantOK: false, wantCode: http.StatusConflict},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &App{}
			w := httptest.NewRecorder()

			ok := a.enforceCeiling(w, plan.ResourceEvent, tt.total)

			if ok != tt.wantOK {
				t.Fatalf("enforceCeiling() = %v, want %v", ok, tt.wantOK)
			}
			if w.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d", w.Code, tt.wantCode)
			}
		})
	}
}
