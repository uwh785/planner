package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/auth"
	"planner/pkg/store"
)

// TestRefreshTokenHandlersIntegration drives register, login, refresh and
// logout the way a mobile client does: every login yields a refresh token,
// refreshing rotates it, a replayed token kills its family, and logout is
// idempotent. It is skipped unless TEST_DATABASE_URL is set and cleans up.
func TestRefreshTokenHandlersIntegration(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	// Registered before the row-cleanup below so it runs last (t.Cleanup is
	// LIFO): the pool must still be open when that cleanup deletes its rows.
	t.Cleanup(pool.Close)

	s := store.New(pool)
	mgr := auth.NewManager("test-secret", 72)
	a := New(s, mgr)

	email := fmt.Sprintf("refresh-app-%d@example.com", time.Now().UnixNano())
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
		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		rec := httptest.NewRecorder()
		h(rec, req)
		var out map[string]any
		if rec.Body.Len() > 0 {
			if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
				t.Fatalf("decode response %q: %v", rec.Body.String(), err)
			}
		}
		return rec.Code, out
	}
	data := func(out map[string]any) map[string]any {
		t.Helper()
		d, ok := out["data"].(map[string]any)
		if !ok {
			t.Fatalf("response has no data envelope: %v", out)
		}
		return d
	}
	refresh := func(tok string) (int, map[string]any) {
		return post(a.refresh, fmt.Sprintf(`{"refresh_token":%q}`, tok))
	}

	// register returns token + user + refresh_token.
	code, out := post(a.register, fmt.Sprintf(`{"email":%q,"name":"R","password":"pw-123456"}`, email))
	if code != http.StatusCreated {
		t.Fatalf("register: status %d body %v", code, out)
	}
	reg := data(out)
	regRefresh, _ := reg["refresh_token"].(string)
	if reg["token"] == "" || reg["user"] == nil || regRefresh == "" {
		t.Fatalf("register response missing token/user/refresh_token: %v", reg)
	}

	// login returns a refresh token from a new family.
	code, out = post(a.login, fmt.Sprintf(`{"email":%q,"password":"pw-123456"}`, email))
	if code != http.StatusOK {
		t.Fatalf("login: status %d body %v", code, out)
	}
	loginRefresh, _ := data(out)["refresh_token"].(string)
	if loginRefresh == "" || loginRefresh == regRefresh {
		t.Fatalf("login refresh_token = %q, want a new non-empty token", loginRefresh)
	}

	// refresh rotates: new access token, user, new refresh token.
	code, out = refresh(regRefresh)
	if code != http.StatusOK {
		t.Fatalf("refresh: status %d body %v", code, out)
	}
	rot := data(out)
	rotRefresh, _ := rot["refresh_token"].(string)
	access, _ := rot["token"].(string)
	if rotRefresh == "" || rotRefresh == regRefresh || access == "" || rot["user"] == nil {
		t.Fatalf("refresh response malformed: %v", rot)
	}
	if _, err := mgr.Verify(access); err != nil {
		t.Fatalf("refreshed access token does not verify: %v", err)
	}

	// Replaying the rotated token is refused and kills the family.
	if code, _ = refresh(regRefresh); code != http.StatusUnauthorized {
		t.Fatalf("reuse: status %d, want 401", code)
	}
	if code, _ = refresh(rotRefresh); code != http.StatusUnauthorized {
		t.Fatalf("newest token after reuse: status %d, want 401", code)
	}
	// The login family is independent and still works.
	if code, _ = refresh(loginRefresh); code != http.StatusOK {
		t.Fatalf("other family refresh: status %d, want 200", code)
	}

	// Unknown, empty and malformed bodies.
	if code, out = refresh("never-issued"); code != http.StatusUnauthorized || out["error"] == nil {
		t.Fatalf("unknown token: status %d body %v, want 401 with an error", code, out)
	}
	if code, _ = post(a.refresh, `{}`); code != http.StatusUnauthorized {
		t.Fatalf("empty token: status %d, want 401", code)
	}
	if code, _ = post(a.refresh, `{`); code != http.StatusBadRequest {
		t.Fatalf("bad json: status %d, want 400", code)
	}

	// Expired token.
	code, out = post(a.login, fmt.Sprintf(`{"email":%q,"password":"pw-123456"}`, email))
	if code != http.StatusOK {
		t.Fatalf("login: status %d", code)
	}
	expiring, _ := data(out)["refresh_token"].(string)
	if _, err := pool.Exec(context.Background(),
		`UPDATE refresh_tokens SET expires_at = $1 WHERE user_id IN (SELECT user_id FROM app_users WHERE email = $2) AND revoked_at IS NULL`,
		time.Now().UnixMilli()-1000, email); err != nil {
		t.Fatalf("expire: %v", err)
	}
	if code, _ = refresh(expiring); code != http.StatusUnauthorized {
		t.Fatalf("expired token: status %d, want 401", code)
	}

	// Logout revokes the family; idempotent; unknown token is still 204.
	code, out = post(a.login, fmt.Sprintf(`{"email":%q,"password":"pw-123456"}`, email))
	if code != http.StatusOK {
		t.Fatalf("login: status %d", code)
	}
	first, _ := data(out)["refresh_token"].(string)
	code, out = refresh(first)
	if code != http.StatusOK {
		t.Fatalf("refresh: status %d", code)
	}
	newest, _ := data(out)["refresh_token"].(string)
	for i := 0; i < 2; i++ {
		if code, _ = post(a.logout, fmt.Sprintf(`{"refresh_token":%q}`, newest)); code != http.StatusNoContent {
			t.Fatalf("logout #%d: status %d, want 204", i+1, code)
		}
	}
	if code, _ = post(a.logout, `{"refresh_token":"never-issued"}`); code != http.StatusNoContent {
		t.Fatalf("logout unknown: status %d, want 204", code)
	}
	if code, _ = refresh(newest); code != http.StatusUnauthorized {
		t.Fatalf("refresh after logout: status %d, want 401", code)
	}

	// Concurrent refresh of one token: exactly one success.
	code, out = post(a.login, fmt.Sprintf(`{"email":%q,"password":"pw-123456"}`, email))
	if code != http.StatusOK {
		t.Fatalf("login: status %d", code)
	}
	raced, _ := data(out)["refresh_token"].(string)
	var wg sync.WaitGroup
	var mu sync.Mutex
	ok := 0
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(fmt.Sprintf(`{"refresh_token":%q}`, raced)))
			rec := httptest.NewRecorder()
			a.refresh(rec, req)
			if rec.Code == http.StatusOK {
				mu.Lock()
				ok++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if ok != 1 {
		t.Fatalf("concurrent refresh successes = %d, want exactly 1", ok)
	}

	// A disabled user cannot refresh and gets no new tokens.
	code, out = post(a.login, fmt.Sprintf(`{"email":%q,"password":"pw-123456"}`, email))
	if code != http.StatusOK {
		t.Fatalf("login: status %d", code)
	}
	disabledTok, _ := data(out)["refresh_token"].(string)
	if _, err := pool.Exec(context.Background(), `UPDATE app_users SET status = 'disabled' WHERE email = $1`, email); err != nil {
		t.Fatalf("disable: %v", err)
	}
	if code, out = refresh(disabledTok); code != http.StatusUnauthorized || out["data"] != nil {
		t.Fatalf("disabled user refresh: status %d body %v, want 401 without data", code, out)
	}
}
