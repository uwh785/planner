package app

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

// These tests exercise the request-validation paths of the classes handlers
// that return before touching the store, so they run without a database.

func TestListClassesInvalidDayReturns400(t *testing.T) {
	a := &App{}
	req := httptest.NewRequest(http.MethodGet, "/api/classes?day=9", nil)
	w := httptest.NewRecorder()

	a.listClasses(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestListClassesInvalidDayNonNumericReturns400(t *testing.T) {
	a := &App{}
	req := httptest.NewRequest(http.MethodGet, "/api/classes?day=foo", nil)
	w := httptest.NewRecorder()

	a.listClasses(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestListClassesNegativeDayReturns400(t *testing.T) {
	a := &App{}
	req := httptest.NewRequest(http.MethodGet, "/api/classes?day=-1", nil)
	w := httptest.NewRecorder()

	a.listClasses(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateClassInvalidBodyReturns400(t *testing.T) {
	a := &App{}
	req := httptest.NewRequest(http.MethodPost, "/api/classes", bytes.NewBufferString("not json"))
	w := httptest.NewRecorder()

	a.createClass(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateClassEmptySubjectReturns400(t *testing.T) {
	a := &App{}
	body := `{"subject":"","day_of_week":1,"start_minute":480,"end_minute":540}`
	req := httptest.NewRequest(http.MethodPost, "/api/classes", bytes.NewBufferString(body))
	w := httptest.NewRecorder()

	a.createClass(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateClassInvalidTimeRangeReturns400(t *testing.T) {
	a := &App{}
	body := `{"subject":"Math","day_of_week":1,"start_minute":600,"end_minute":500}`
	req := httptest.NewRequest(http.MethodPost, "/api/classes", bytes.NewBufferString(body))
	w := httptest.NewRecorder()

	a.createClass(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func withChiRouteParam(r *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func TestUpdateClassInvalidBodyReturns400(t *testing.T) {
	a := &App{}
	req := httptest.NewRequest(http.MethodPut, "/api/classes/cls_1", bytes.NewBufferString("not json"))
	req = withChiRouteParam(req, "id", "cls_1")
	w := httptest.NewRecorder()

	a.updateClass(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestUpdateClassInvalidDayReturns400(t *testing.T) {
	a := &App{}
	body := `{"subject":"Math","day_of_week":8,"start_minute":480,"end_minute":540}`
	req := httptest.NewRequest(http.MethodPut, "/api/classes/cls_1", bytes.NewBufferString(body))
	req = withChiRouteParam(req, "id", "cls_1")
	w := httptest.NewRecorder()

	a.updateClass(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
