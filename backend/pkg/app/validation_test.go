package app

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// These tests exercise the request-validation paths of the create/update
// handlers that return before touching the store, so they run without a
// database. They cover the length limits added on top of the existing
// "required" checks.

func TestCreateTaskTitleTooLongReturns400(t *testing.T) {
	a := &App{}
	body := `{"title":"` + strings.Repeat("a", 201) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.createTask(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateTaskDescriptionTooLongReturns400(t *testing.T) {
	a := &App{}
	body := `{"title":"x","description":"` + strings.Repeat("a", 5001) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.createTask(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestUpdateTaskTitleTooLongReturns400(t *testing.T) {
	a := &App{}
	body := `{"title":"` + strings.Repeat("a", 201) + `"}`
	req := httptest.NewRequest(http.MethodPut, "/api/tasks/tsk_1", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.updateTask(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateListNameTooLongReturns400(t *testing.T) {
	a := &App{}
	body := `{"name":"` + strings.Repeat("a", 101) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/lists", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.createList(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateListEmptyNameReturns400(t *testing.T) {
	a := &App{}
	body := `{"name":"   "}`
	req := httptest.NewRequest(http.MethodPost, "/api/lists", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.createList(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestUpdateListNameTooLongReturns400(t *testing.T) {
	a := &App{}
	body := `{"name":"` + strings.Repeat("a", 101) + `"}`
	req := httptest.NewRequest(http.MethodPut, "/api/lists/lst_1", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.updateList(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestUpdateListEmptyNameReturns400(t *testing.T) {
	a := &App{}
	body := `{"name":""}`
	req := httptest.NewRequest(http.MethodPut, "/api/lists/lst_1", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.updateList(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateTagNameTooLongReturns400(t *testing.T) {
	a := &App{}
	body := `{"name":"` + strings.Repeat("a", 51) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tags", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.createTag(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateSubtaskTitleTooLongReturns400(t *testing.T) {
	a := &App{}
	body := `{"title":"` + strings.Repeat("a", 201) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks/tsk_1/subtasks", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.createSubtask(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestUpdateSubtaskTitleTooLongReturns400(t *testing.T) {
	a := &App{}
	body := `{"title":"` + strings.Repeat("a", 201) + `"}`
	req := httptest.NewRequest(http.MethodPut, "/api/tasks/tsk_1/subtasks/sub_1", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.updateSubtask(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestUpdateSubtaskEmptyTitleReturns400(t *testing.T) {
	a := &App{}
	body := `{"title":"   "}`
	req := httptest.NewRequest(http.MethodPut, "/api/tasks/tsk_1/subtasks/sub_1", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.updateSubtask(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateClassRoomTooLongReturns400(t *testing.T) {
	a := &App{}
	body := `{"subject":"Math","day_of_week":1,"start_minute":480,"end_minute":540,"room":"` + strings.Repeat("a", 101) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/classes", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.createClass(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateClassTeacherTooLongReturns400(t *testing.T) {
	a := &App{}
	body := `{"subject":"Math","day_of_week":1,"start_minute":480,"end_minute":540,"teacher":"` + strings.Repeat("a", 101) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/classes", strings.NewReader(body))
	w := httptest.NewRecorder()

	a.createClass(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
