package server

import (
	"context"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"planner/pkg/app"
	"planner/pkg/auth"
	"planner/pkg/config"
	"planner/pkg/store"
)

func HandlerOrFatal() http.Handler {
	cfg, err := config.Load(true)
	if err != nil {
		log.Fatal(err)
	}

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("unable to connect to database: %v", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("unable to ping database: %v", err)
	}

	s := store.New(pool)
	a := auth.NewManager(cfg.JWTSecret, cfg.JWTTLHours)
	return app.New(s, a).Handler()
}
