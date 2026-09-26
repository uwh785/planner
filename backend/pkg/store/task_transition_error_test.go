package store

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestTaskTransitionErrorPassesThroughNonNotFoundError verifies that
// taskTransitionError maps only a genuine "no rows" lookup (task missing) to
// ErrNotFound. Any other GetTask failure (e.g. a lost connection) must be
// returned as-is so handlers report it as a 500, not a 404.
//
// This needs no live database: a pool that was never connected and is then
// closed fails Acquire immediately with a "closed pool" error, which is a
// deterministic non-ErrNoRows failure.
func TestTaskTransitionErrorPassesThroughNonNotFoundError(t *testing.T) {
	pool, err := pgxpool.New(context.Background(), "postgres://user:pass@127.0.0.1:1/db")
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	pool.Close()

	s := New(pool)

	got := s.taskTransitionError("usr_x", "tsk_x")
	if got == nil {
		t.Fatal("taskTransitionError with closed pool = nil, want a passthrough error")
	}
	if errors.Is(got, ErrNotFound) {
		t.Fatalf("taskTransitionError with closed pool = %v, want passthrough error, not ErrNotFound", got)
	}
}
