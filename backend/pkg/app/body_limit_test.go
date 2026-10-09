package app

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// These tests exercise decodeJSONOrRespond directly, wrapping the request
// body the same way the maxBodySize middleware does, so they cover the 413
// path without needing the full chi router or a database.

// oversizedJSONBody builds a syntactically valid JSON document larger than
// maxRequestBodyBytes, so the decoder is still consuming valid bytes when it
// hits the body limit. A body of just repeated garbage bytes fails the JSON
// syntax check on its very first byte, before the reader ever gets far
// enough to trip the limit, so it would exercise the wrong error path.
func oversizedJSONBody() []byte {
	return []byte(`{"title":"` + strings.Repeat("a", maxRequestBodyBytes+1) + `"}`)
}

func TestDecodeJSONOrRespondTooLargeReturns413(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader(oversizedJSONBody()))
	w := httptest.NewRecorder()
	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	var v map[string]any
	ok := decodeJSONOrRespond(w, req, &v)

	if ok {
		t.Fatal("decodeJSONOrRespond() = true, want false")
	}
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusRequestEntityTooLarge)
	}
}

func TestDecodeJSONOrRespondWithinLimitSucceeds(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader([]byte(`{"title":"x"}`)))
	w := httptest.NewRecorder()
	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	var v map[string]any
	ok := decodeJSONOrRespond(w, req, &v)

	if !ok {
		t.Fatalf("decodeJSONOrRespond() = false, want true (status %d)", w.Code)
	}
	if v["title"] != "x" {
		t.Errorf("decoded title = %v, want %q", v["title"], "x")
	}
}

func TestDecodeJSONOrRespondMalformedBodyReturns400(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader([]byte("not json")))
	w := httptest.NewRecorder()
	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	var v map[string]any
	ok := decodeJSONOrRespond(w, req, &v)

	if ok {
		t.Fatal("decodeJSONOrRespond() = true, want false")
	}
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestCreateTaskOversizedBodyReturns413(t *testing.T) {
	a := &App{}
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader(oversizedJSONBody()))
	w := httptest.NewRecorder()
	req.Body = http.MaxBytesReader(w, req.Body, maxRequestBodyBytes)

	a.createTask(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusRequestEntityTooLarge)
	}
}
