package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const testRefreshTTL = 24 * time.Hour

// TestRefreshTokensIntegration covers the refresh-token lifecycle: only the
// hash is stored, rotation revokes the presented token, reuse of a rotated
// token revokes the whole family, expired/unknown/disabled-user tokens are
// refused, logout revokes a family idempotently, concurrent rotations of one
// token yield exactly one winner, and issuing purges stale rows. It is skipped
// unless TEST_DATABASE_URL is set, creates throwaway users and cleans up.
func TestRefreshTokensIntegration(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	// Registered before the row-cleanup below so it runs last (t.Cleanup is
	// LIFO): the pool must still be open when that cleanup deletes its rows.
	t.Cleanup(pool.Close)

	s := New(pool)
	stamp := time.Now().UnixNano()

	newUser := func(label string) string {
		t.Helper()
		u, err := s.Register(fmt.Sprintf("refresh-%s-%d@example.com", label, stamp), "Refresh Test", "hash")
		if err != nil {
			t.Fatalf("register %s: %v", label, err)
		}
		t.Cleanup(func() {
			if _, err := pool.Exec(context.Background(), `DELETE FROM refresh_tokens WHERE user_id = $1`, u.UserID); err != nil {
				t.Errorf("cleanup: delete refresh_tokens: %v", err)
			}
			if _, err := pool.Exec(context.Background(), `DELETE FROM app_users WHERE user_id = $1`, u.UserID); err != nil {
				t.Errorf("cleanup: delete app_users: %v", err)
			}
		})
		return u.UserID
	}
	hashOf := func(raw string) string {
		sum := sha256.Sum256([]byte(raw))
		return hex.EncodeToString(sum[:])
	}
	issue := func(userID string) string {
		t.Helper()
		raw, err := s.IssueRefreshToken(userID, testRefreshTTL)
		if err != nil {
			t.Fatalf("issue: %v", err)
		}
		return raw
	}
	rotate := func(raw string) (string, error) {
		_, next, err := s.RotateRefreshToken(raw, testRefreshTTL)
		return next, err
	}
	wantInvalid := func(what string, err error) {
		t.Helper()
		if !errors.Is(err, ErrInvalidRefreshToken) {
			t.Fatalf("%s: err = %v, want ErrInvalidRefreshToken", what, err)
		}
	}

	t.Run("stores only the hash", func(t *testing.T) {
		uid := newUser("hash")
		raw := issue(uid)
		if len(raw) < 43 {
			t.Fatalf("token %q too short for 32 random bytes", raw)
		}
		var n int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM refresh_tokens WHERE token_hash = $1`, raw).Scan(&n); err != nil || n != 0 {
			t.Fatalf("raw token found as a stored value: n=%d err=%v", n, err)
		}
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2`, hashOf(raw), uid).Scan(&n); err != nil || n != 1 {
			t.Fatalf("hashed token row: n=%d err=%v, want 1", n, err)
		}
	})

	t.Run("rotation revokes the old token and keeps the family", func(t *testing.T) {
		uid := newUser("rotate")
		first := issue(uid)
		user, second, err := s.RotateRefreshToken(first, testRefreshTTL)
		if err != nil {
			t.Fatalf("rotate: %v", err)
		}
		if user.UserID != uid || second == "" || second == first {
			t.Fatalf("rotate = (%q, %q), want the user and a new token", user.UserID, second)
		}
		var fams int
		if err := pool.QueryRow(ctx, `SELECT count(DISTINCT family_id) FROM refresh_tokens WHERE user_id = $1`, uid).Scan(&fams); err != nil || fams != 1 {
			t.Fatalf("families = %d err=%v, want 1", fams, err)
		}
		_, err = rotate(first)
		wantInvalid("old token after rotation", err)
	})

	t.Run("reuse of a rotated token revokes the family", func(t *testing.T) {
		uid := newUser("reuse")
		first := issue(uid)
		second, err := rotate(first)
		if err != nil {
			t.Fatalf("rotate: %v", err)
		}
		_, err = rotate(first) // replay of the already-rotated token
		wantInvalid("reuse", err)
		_, err = rotate(second) // the newest token died with the family
		wantInvalid("newest token after reuse", err)
	})

	t.Run("reuse does not touch another family", func(t *testing.T) {
		uid := newUser("fams")
		a, b := issue(uid), issue(uid)
		if _, err := rotate(a); err != nil {
			t.Fatalf("rotate a: %v", err)
		}
		_, err := rotate(a)
		wantInvalid("reuse of a", err)
		if _, err := rotate(b); err != nil {
			t.Fatalf("other family must survive: %v", err)
		}
	})

	t.Run("unknown and empty tokens", func(t *testing.T) {
		_, err := rotate("not-a-real-token")
		wantInvalid("unknown", err)
		_, err = rotate("")
		wantInvalid("empty", err)
	})

	t.Run("expired token", func(t *testing.T) {
		uid := newUser("expired")
		raw := issue(uid)
		if _, err := pool.Exec(ctx, `UPDATE refresh_tokens SET expires_at = $1 WHERE token_hash = $2`, time.Now().UnixMilli()-1000, hashOf(raw)); err != nil {
			t.Fatalf("expire: %v", err)
		}
		_, err := rotate(raw)
		wantInvalid("expired", err)
	})

	t.Run("disabled user", func(t *testing.T) {
		uid := newUser("disabled")
		raw := issue(uid)
		if _, err := pool.Exec(ctx, `UPDATE app_users SET status = 'disabled' WHERE user_id = $1`, uid); err != nil {
			t.Fatalf("disable: %v", err)
		}
		_, err := rotate(raw)
		wantInvalid("disabled user", err)
		var open int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`, uid).Scan(&open); err != nil || open != 0 {
			t.Fatalf("unrevoked tokens for disabled user = %d err=%v, want 0", open, err)
		}
	})

	t.Run("logout revokes the family idempotently", func(t *testing.T) {
		uid := newUser("logout")
		first := issue(uid)
		second, err := rotate(first)
		if err != nil {
			t.Fatalf("rotate: %v", err)
		}
		if err := s.RevokeRefreshFamily(second); err != nil {
			t.Fatalf("logout: %v", err)
		}
		if err := s.RevokeRefreshFamily(second); err != nil {
			t.Fatalf("second logout: %v", err)
		}
		if err := s.RevokeRefreshFamily("unknown-token"); err != nil {
			t.Fatalf("logout of unknown token: %v", err)
		}
		_, err = rotate(second)
		wantInvalid("token after logout", err)
	})

	t.Run("concurrent rotation has one winner", func(t *testing.T) {
		uid := newUser("race")
		raw := issue(uid)
		const n = 8
		var wg sync.WaitGroup
		var mu sync.Mutex
		wins := 0
		for i := 0; i < n; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				if _, err := rotate(raw); err == nil {
					mu.Lock()
					wins++
					mu.Unlock()
				} else if !errors.Is(err, ErrInvalidRefreshToken) {
					t.Errorf("rotate: unexpected error %v", err)
				}
			}()
		}
		wg.Wait()
		if wins != 1 {
			t.Fatalf("successful rotations = %d, want exactly 1", wins)
		}
	})

	t.Run("issuing purges long-expired rows of that user only", func(t *testing.T) {
		uid := newUser("purge")
		other := newUser("purge-other")
		now := time.Now().UnixMilli()
		day := int64(24 * time.Hour / time.Millisecond)
		for _, row := range []struct {
			hash, user string
			expires    int64
		}{
			{"purge-old-" + fmt.Sprint(stamp), uid, now - 8*day},
			{"purge-recent-" + fmt.Sprint(stamp), uid, now - 2*day},
			{"purge-other-" + fmt.Sprint(stamp), other, now - 8*day},
		} {
			if _, err := pool.Exec(ctx,
				`INSERT INTO refresh_tokens (token_hash, user_id, family_id, created_at, expires_at) VALUES ($1, $2, 'fam_purge', $3, $4)`,
				row.hash, row.user, now-30*day, row.expires); err != nil {
				t.Fatalf("seed: %v", err)
			}
		}
		issue(uid)
		exists := func(hash string) bool {
			var n int
			if err := pool.QueryRow(ctx, `SELECT count(*) FROM refresh_tokens WHERE token_hash = $1`, hash).Scan(&n); err != nil {
				t.Fatalf("count: %v", err)
			}
			return n == 1
		}
		if exists("purge-old-" + fmt.Sprint(stamp)) {
			t.Error("row expired more than 7 days ago was not purged")
		}
		if !exists("purge-recent-" + fmt.Sprint(stamp)) {
			t.Error("recently expired row was purged")
		}
		if !exists("purge-other-" + fmt.Sprint(stamp)) {
			t.Error("another user's row was purged")
		}
	})
}
