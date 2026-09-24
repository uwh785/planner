#!/usr/bin/env bash
set -euo pipefail

echo "Starting Planner dev environment..."

docker compose up -d

echo "Waiting for PostgreSQL..."
sleep 2

echo "Starting backend..."
(cd backend && go run ./cmd/server) &

echo "Starting frontend..."
(cd web && npm run dev) &

wait
