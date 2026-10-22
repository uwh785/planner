package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/auth"
	"planner/pkg/store"
)

// TestLoginRefusesInactiveUserIntegration pins that login enforces the same
// active-user rule as refresh: a user whose status is not "active" gets the
// generic 401 even with the right password, and no tokens are issued. It is
// skipped unless TEST_DATABASE_URL is set and cleans up.
func TestLoginRefusesInactiveUserIntegration(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	// Registered first so it runs last (t.Cleanup is LIFO).
	t.Cleanup(pool.Close)

	a := New(store.New(pool), auth.NewManager("test-secret", 72))

	email := fmt.Sprintf("login-status-%d@example.com", time.Now().UnixNano())
	t.Cleanup(func() {
		ctx := context.Background()
		if _, err := pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id IN (SELECT user_id FROM app_users WHERE email = $1)`, email); err != nil {
			t.Errorf("cleanup: delete refresh_tokens: %v", err)
		}
		if _, err := pool.Exec(ctx, `DELETE FROM app_users WHERE email = $1`, email); err != nil {
			t.Errorf("cleanup: delete app_users: %v", err)
		}
	})

	post := func(h http.HandlerFunc, body string) (int, map[string]any) {
		t.Helper()
		rec := httptest.NewRecorder()
		h(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)))
		var out map[string]any
		if rec.Body.Len() > 0 {
			if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
				t.Fatalf("decode response %q: %v", rec.Body.String(), err)
			}
		}
		return rec.Code, out
	}

	if code, out := post(a.register, fmt.Sprintf(`{"email":%q,"name":"L","password":"pw-123456"}`, email)); code != http.StatusCreated {
		t.Fatalf("register: status %d body %v", code, out)
	}
	login := fmt.Sprintf(`{"email":%q,"password":"pw-123456"}`, email)

	if code, out := post(a.login, login); code != http.StatusOK || out["data"] == nil {
		t.Fatalf("active user login: status %d body %v, want 200 with data", code, out)
	}

	countTokens := func() int {
		t.Helper()
		var n int
		if err := pool.QueryRow(context.Background(),
			`SELECT COUNT(*) FROM refresh_tokens WHERE user_id = (SELECT user_id FROM app_users WHERE email = $1)`, email,
		).Scan(&n); err != nil {
			t.Fatalf("count refresh tokens: %v", err)
		}
		return n
	}
	before := countTokens()

	if _, err := pool.Exec(context.Background(), `UPDATE app_users SET status = 'disabled' WHERE email = $1`, email); err != nil {
		t.Fatalf("disable user: %v", err)
	}
	code, out := post(a.login, login)
	if code != http.StatusUnauthorized || out["data"] != nil {
		t.Fatalf("disabled user login: status %d body %v, want 401 without data", code, out)
	}
	if out["error"] != "invalid credentials" {
		t.Fatalf("disabled user login error = %v, want the generic %q", out["error"], "invalid credentials")
	}

	if after := countTokens(); after != before {
		t.Fatalf("refresh tokens for the user went from %d to %d, want none issued to a disabled user", before, after)
	}
}
