package db

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const exampleURL = "postgres://u:p@localhost:5432/planner?sslmode=disable"

func TestPoolConfigDefaultsToACachelessExecMode(t *testing.T) {
	cfg, err := PoolConfig(exampleURL)
	if err != nil {
		t.Fatalf("PoolConfig: %v", err)
	}
	if got := cfg.ConnConfig.DefaultQueryExecMode; got != pgx.QueryExecModeCacheDescribe {
		t.Fatalf("DefaultQueryExecMode = %v, want CacheDescribe so named prepared statements are never created", got)
	}
}

func TestPoolConfigHonorsAnExplicitExecModeInTheURL(t *testing.T) {
	cfg, err := PoolConfig(exampleURL + "&default_query_exec_mode=exec")
	if err != nil {
		t.Fatalf("PoolConfig: %v", err)
	}
	if got := cfg.ConnConfig.DefaultQueryExecMode; got != pgx.QueryExecModeExec {
		t.Fatalf("DefaultQueryExecMode = %v, want the explicit URL value (Exec)", got)
	}
}

func TestPoolConfigRejectsAnInvalidURL(t *testing.T) {
	if _, err := PoolConfig("not a url"); err == nil {
		t.Fatal("PoolConfig accepted an invalid URL")
	}
}

// preparedStatementCount counts the named prepared statements the server holds
// for the connection the query runs on.
func preparedStatementCount(t *testing.T, conn *pgxpool.Conn) int {
	t.Helper()
	var n int
	if err := conn.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM pg_prepared_statements`).Scan(&n); err != nil {
		t.Fatalf("count prepared statements: %v", err)
	}
	return n
}

// runWorkload issues the same query shapes the API uses: a plain query, a
// parameterized query and a transaction, each more than once so a statement
// cache would have a chance to prepare and reuse them.
func runWorkload(t *testing.T, conn *pgxpool.Conn) {
	t.Helper()
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		var one int
		if err := conn.QueryRow(ctx, `SELECT 1`).Scan(&one); err != nil {
			t.Fatalf("select 1: %v", err)
		}
		var echoed string
		if err := conn.QueryRow(ctx, `SELECT $1::text`, "x").Scan(&echoed); err != nil {
			t.Fatalf("select param: %v", err)
		}
		tx, err := conn.Begin(ctx)
		if err != nil {
			t.Fatalf("begin: %v", err)
		}
		if _, err := tx.Exec(ctx, `SELECT $1::bigint`, int64(i)); err != nil {
			t.Fatalf("tx exec: %v", err)
		}
		if err := tx.Commit(ctx); err != nil {
			t.Fatalf("commit: %v", err)
		}
	}
}

// TestNewPoolCreatesNoNamedPreparedStatementsIntegration is the regression
// test for the production failure behind a transaction-mode pooler:
// "prepared statement ... does not exist" (26000) and "... already exists"
// (42P05). Both come from pgx's default statement cache, so the proof is that
// no named prepared statement is ever created on the server connection.
// Skipped unless TEST_DATABASE_URL is set.
func TestNewPoolCreatesNoNamedPreparedStatementsIntegration(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}
	ctx := context.Background()

	// Control: the stock pool does leave named statements behind, which is
	// what breaks under a pooler. If this ever reads 0 the test below proves
	// nothing, so fail loudly.
	stock, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("stock pool: %v", err)
	}
	defer stock.Close()
	stockConn, err := stock.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire stock: %v", err)
	}
	runWorkload(t, stockConn)
	if n := preparedStatementCount(t, stockConn); n == 0 {
		stockConn.Release()
		t.Fatal("control failed: the stock pool created no named prepared statements, so this test cannot detect the bug")
	}
	stockConn.Release()

	pool, err := NewPool(ctx, dbURL)
	if err != nil {
		t.Fatalf("NewPool: %v", err)
	}
	defer pool.Close()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire: %v", err)
	}
	defer conn.Release()
	runWorkload(t, conn)
	if n := preparedStatementCount(t, conn); n != 0 {
		t.Fatalf("NewPool left %d named prepared statements on the connection, want 0", n)
	}
}
