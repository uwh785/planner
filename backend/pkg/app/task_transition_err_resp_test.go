package app

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"planner/pkg/store"
)

// TestTaskTransitionErrResp verifies the error-to-status mapping used by
// startTask/pauseTask/completeTask: a missing task is 404, an invalid
// transition is 409, and any other error (e.g. a store/database failure) is
// a 500 rather than being mistaken for a missing task. Runs with no DB.
func TestTaskTransitionErrResp(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{"not found", store.ErrNotFound, http.StatusNotFound},
		{"invalid transition", store.ErrInvalidTransition, http.StatusConflict},
		{"other error", errors.New("connection reset"), http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()

			wrote := taskTransitionErrResp(w, tt.err, "failed to update task")

			if !wrote {
				t.Fatal("taskTransitionErrResp() = false, want true (a non-nil error was passed)")
			}
			if w.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

func TestTaskTransitionErrRespNilError(t *testing.T) {
	w := httptest.NewRecorder()

	if taskTransitionErrResp(w, nil, "failed to update task") {
		t.Fatal("taskTransitionErrResp(nil) = true, want false")
	}
	if w.Code != http.StatusOK && w.Code != 0 {
		t.Errorf("status = %d, want no response written (0 or 200)", w.Code)
	}
}
