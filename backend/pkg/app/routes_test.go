package app

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"planner/pkg/auth"
)

// TestSyncRoutesAreRegistered drives the real router, not the handlers, so a
// handler that exists but was never mounted is caught: without a token every
// authenticated route answers 401, while an unregistered path answers 404/405.
func TestSyncRoutesAreRegistered(t *testing.T) {
	h := New(nil, auth.NewManager("test-secret", 72)).Handler()

	routes := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/sync"},
		{http.MethodPost, "/api/sync/push"},
		{http.MethodPost, "/api/auth/logout"},
		{http.MethodPost, "/api/auth/refresh"},
	}
	for _, rt := range routes {
		t.Run(rt.method+" "+rt.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(rt.method, rt.path, nil))
			if rec.Code == http.StatusNotFound || rec.Code == http.StatusMethodNotAllowed {
				t.Fatalf("%s %s is not registered: status %d", rt.method, rt.path, rec.Code)
			}
		})
	}

	// The two sync routes must sit behind authentication.
	for _, rt := range routes[:2] {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(rt.method, rt.path, nil))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s without a token: status %d, want 401", rt.method, rt.path, rec.Code)
		}
	}
}
