package server

import (
	"context"
	"log"
	"net/http"
	"time"

	"planner/pkg/app"
	"planner/pkg/auth"
	"planner/pkg/config"
	"planner/pkg/db"
	"planner/pkg/store"
)

func HandlerOrFatal() http.Handler {
	cfg, err := config.Load(true)
	if err != nil {
		log.Fatal(err)
	}

	pool, err := db.NewPool(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("unable to connect to database: %v", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("unable to ping database: %v", err)
	}

	s := store.New(pool)
	a := auth.NewManager(cfg.JWTSecret, cfg.JWTTLHours)
	return app.New(s, a, app.WithRefreshTokens(
		time.Duration(cfg.RefreshTTLDays)*24*time.Hour,
		time.Duration(cfg.RefreshGraceSeconds)*time.Second,
	)).Handler()
}
