package app

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
)

// These tests exercise the request-validation paths of the task handlers
// that return before touching the store, so they run without a database.

func TestParseDateRange(t *testing.T) {
	tests := []struct {
		name     string
		query    string
		wantFrom *int64
		wantTo   *int64
		wantErr  bool
	}{
		{
			name:     "none",
			query:    "",
			wantFrom: nil,
			wantTo:   nil,
		},
		{
			name:     "only from",
			query:    "from=1000",
			wantFrom: int64Ptr(1000),
			wantTo:   nil,
		},
		{
			name:     "only to",
			query:    "to=2000",
			wantFrom: nil,
			wantTo:   int64Ptr(2000),
		},
		{
			name:     "both valid",
			query:    "from=1000&to=2000",
			wantFrom: int64Ptr(1000),
			wantTo:   int64Ptr(2000),
		},
		{
			name:    "non-integer from",
			query:   "from=abc",
			wantErr: true,
		},
		{
			name:    "non-integer to",
			query:   "to=abc",
			wantErr: true,
		},
		{
			name:    "negative from",
			query:   "from=-1",
			wantErr: true,
		},
		{
			name:    "negative to",
			query:   "to=-1",
			wantErr: true,
		},
		{
			name:    "from == to",
			query:   "from=1000&to=1000",
			wantErr: true,
		},
		{
			name:    "from > to",
			query:   "from=2000&to=1000",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q, err := url.ParseQuery(tt.query)
			if err != nil {
				t.Fatalf("parse test query: %v", err)
			}
			from, to, err := parseDateRange(q)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("parseDateRange(%q): expected error, got none", tt.query)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseDateRange(%q): unexpected error: %v", tt.query, err)
			}
			if !int64PtrEqual(from, tt.wantFrom) {
				t.Errorf("from = %s, want %s", int64PtrStr(from), int64PtrStr(tt.wantFrom))
			}
			if !int64PtrEqual(to, tt.wantTo) {
				t.Errorf("to = %s, want %s", int64PtrStr(to), int64PtrStr(tt.wantTo))
			}
		})
	}
}

func int64Ptr(v int64) *int64 { return &v }

func int64PtrEqual(a, b *int64) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

func int64PtrStr(v *int64) string {
	if v == nil {
		return "<nil>"
	}
	return strconv.FormatInt(*v, 10)
}

func TestListTasksInvalidFromReturns400(t *testing.T) {
	a := &App{}
	req := httptest.NewRequest(http.MethodGet, "/api/tasks?from=abc", nil)
	w := httptest.NewRecorder()

	a.listTasks(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestListTasksInvalidToReturns400(t *testing.T) {
	a := &App{}
	req := httptest.NewRequest(http.MethodGet, "/api/tasks?to=abc", nil)
	w := httptest.NewRecorder()

	a.listTasks(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestListTasksFromGreaterOrEqualToReturns400(t *testing.T) {
	a := &App{}
	req := httptest.NewRequest(http.MethodGet, "/api/tasks?from=2000&to=1000", nil)
	w := httptest.NewRecorder()

	a.listTasks(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestListTasksNegativeFromReturns400(t *testing.T) {
	a := &App{}
	req := httptest.NewRequest(http.MethodGet, "/api/tasks?from=-5", nil)
	w := httptest.NewRecorder()

	a.listTasks(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
