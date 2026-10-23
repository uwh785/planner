// Package db builds the Postgres connection pool shared by the server and the
// migrator.
package db

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// execModeOption is the pgx connection-string key that selects the query mode.
const execModeOption = "default_query_exec_mode"

// PoolConfig parses connString and picks a query execution mode that is safe
// behind a transaction-mode connection pooler (PgBouncer, Supavisor, the
// Neon or Supabase poolers).
//
// pgx's default mode prepares and caches named statements per connection. A
// transaction-mode pooler hands every transaction a different server
// connection, so the cache points at statements the connection does not have
// ("prepared statement ... does not exist", 26000) or tries to prepare a name
// another client already took ("... already exists", 42P05). CacheDescribe
// keeps the extended protocol and the description cache but never creates a
// named statement, so it works with and without a pooler.
//
// A mode set explicitly in the URL (default_query_exec_mode=...) wins, so the
// operator can still override this per environment.
func PoolConfig(connString string) (*pgxpool.Config, error) {
	cfg, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, err
	}
	if !strings.Contains(connString, execModeOption) {
		cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeCacheDescribe
	}
	return cfg, nil
}

// NewPool opens a pool configured by PoolConfig.
func NewPool(ctx context.Context, connString string) (*pgxpool.Pool, error) {
	cfg, err := PoolConfig(connString)
	if err != nil {
		return nil, err
	}
	return pgxpool.NewWithConfig(ctx, cfg)
}
