package main

import (
	"context"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("unable to connect: %v", err)
	}
	defer pool.Close()

	migrations := []string{
		`CREATE TABLE IF NOT EXISTS app_users (
			user_id       TEXT PRIMARY KEY,
			email         TEXT UNIQUE NOT NULL,
			name          TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			role          TEXT DEFAULT 'user',
			status        TEXT DEFAULT 'active',
			created_at    BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
		)`,
		`CREATE TABLE IF NOT EXISTS task_lists (
			user_id    TEXT NOT NULL REFERENCES app_users(user_id),
			list_id    TEXT PRIMARY KEY,
			name       TEXT NOT NULL,
			color      TEXT DEFAULT '#0A84FF',
			icon       TEXT DEFAULT 'list',
			sort_order INT DEFAULT 0,
			updated_at BIGINT DEFAULT 0,
			deleted    INT DEFAULT 0
		)`,
		`CREATE INDEX IF NOT EXISTS idx_task_lists_user ON task_lists(user_id)`,
		`CREATE TABLE IF NOT EXISTS tasks (
			user_id     TEXT NOT NULL REFERENCES app_users(user_id),
			list_id     TEXT,
			task_id     TEXT PRIMARY KEY,
			title       TEXT NOT NULL,
			description TEXT DEFAULT '',
			priority    INT DEFAULT 0,
			status      TEXT DEFAULT 'pending',
			due_date    BIGINT,
			duration_ms BIGINT,
			started_at  BIGINT,
			completed_at BIGINT,
			sort_order  INT DEFAULT 0,
			updated_at  BIGINT DEFAULT 0,
			deleted     INT DEFAULT 0
		)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date)`,
		`CREATE TABLE IF NOT EXISTS subtasks (
			user_id    TEXT NOT NULL REFERENCES app_users(user_id),
			task_id    TEXT NOT NULL REFERENCES tasks(task_id),
			subtask_id TEXT PRIMARY KEY,
			title      TEXT NOT NULL,
			completed  BOOLEAN DEFAULT FALSE,
			sort_order INT DEFAULT 0,
			updated_at BIGINT DEFAULT 0,
			deleted    INT DEFAULT 0
		)`,
		`CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(user_id, task_id)`,
		`CREATE TABLE IF NOT EXISTS tags (
			user_id TEXT NOT NULL REFERENCES app_users(user_id),
			tag_id  TEXT PRIMARY KEY,
			name    TEXT NOT NULL,
			color   TEXT DEFAULT '#8E8E93'
		)`,
		`CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id)`,
		`CREATE TABLE IF NOT EXISTS task_tags (
			user_id TEXT NOT NULL,
			task_id TEXT NOT NULL REFERENCES tasks(task_id),
			tag_id  TEXT NOT NULL REFERENCES tags(tag_id),
			PRIMARY KEY (user_id, task_id, tag_id)
		)`,
		`CREATE TABLE IF NOT EXISTS class_sessions (
			user_id      TEXT NOT NULL REFERENCES app_users(user_id),
			class_id     TEXT PRIMARY KEY,
			subject      TEXT NOT NULL,
			day_of_week  INT NOT NULL,
			start_minute INT NOT NULL,
			end_minute   INT NOT NULL,
			room         TEXT DEFAULT '',
			teacher      TEXT DEFAULT '',
			color        TEXT DEFAULT '#0A84FF',
			updated_at   BIGINT DEFAULT 0,
			deleted      INT DEFAULT 0,
			CHECK (day_of_week >= 0 AND day_of_week <= 6),
			CHECK (start_minute >= 0 AND start_minute < end_minute AND end_minute <= 1440)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_class_sessions_user_day ON class_sessions(user_id, day_of_week)`,
		`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_all_day BOOLEAN NOT NULL DEFAULT false`,
		`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS elapsed_ms BIGINT NOT NULL DEFAULT 0`,
	}

	for i, m := range migrations {
		if _, err := pool.Exec(context.Background(), m); err != nil {
			log.Fatalf("migration %d failed: %v", i+1, err)
		}
		log.Printf("migration %d: OK", i+1)
	}

	log.Println("all migrations completed")
}
