# Offline sync backend

## Objective
Make the Go backend able to serve an offline-first React Native client: incremental pull, idempotent push, tombstones.

## Problem
Evidence from backend mapping (2026-10-22):
- Tags and task_tags have no `updated_at` and no soft delete; deletes are hard.
- Task and subtask deletes do not bump `updated_at`, so a delta cursor never sees them.
- Duplicate primary key on create returns 500; offline retries are not idempotent.
- Server overwrites `updated_at` (last-write-wins) and times start/pause/complete with the server clock.
- No `since` pull endpoint. Plan caps (402) and storage ceilings (409) can reject replayed creates.
- JWT lasts 72h with no refresh.

## Scope
Backend only (`backend/`, `prisma/`). The React Native client lives in `/home/kv/Projects/programming/planner-mobile` and is out of scope here.

## Constraints
- Migrations in `backend/cmd/migrate/main.go` are an append-only, idempotent statement list. Never edit earlier statements.
- Existing behavior must not change until the store layer opts in.
- Conventional Commits, no AI attribution.

## Delivery strategy
ask-on-risk. Forecast ~350 authored changed lines across the feature.

## Tasks
- [x] T1 Schema migration: `updated_at` + `deleted` on tags and task_tags, backfill, `(user_id, updated_at)` indexes on all synced tables. Route: inline (one mechanical file).
- [x] T2 Store: soft-delete tags/task_tags, bump `updated_at` on task/subtask delete, filter `deleted` in reads and counts. Route: delegated writer (2+ non-trivial files).
- [ ] T3 Idempotent creates: same-user duplicate ID returns the existing row; cross-user collision returns 409.
- [ ] T4 Sync endpoints: `GET /api/sync?since=` (changes + tombstones) and `POST /api/sync/push` (batch, per-item results incl. 402/409).
- [ ] T5 Client-supplied timestamps for start/pause/complete so offline timer segments replay faithfully.
- [ ] T6 Auth: longer-lived or refreshable token for long offline periods.

## Acceptance criteria
- `go run ./cmd/migrate` succeeds twice in a row on an existing database and on an empty one.
- Existing `go test ./...` still passes.

## Checks
- Test-first exception for T1: SQL-only change with no runnable unit test. Verify by running the migrator twice and inspecting the schema. Integration tests need `TEST_DATABASE_URL`.

## Progress
- Branch: `feat/offline-sync-schema`.

## Verification evidence
T1: `go run ./cmd/migrate` run twice on the local dev DB, both OK (34 statements). `\d tags` and `\d task_tags` show `updated_at` bigint and `deleted` int plus the new indexes. `go build ./...`, `go vet ./cmd/migrate`, `go test ./...` (194 passed).

T2: RED observed first (compile failure on `CountTagsUsage`, then with a stub 6 assertion failures: delete `updated_at` not bumped for subtask/list/class/event, `CreateTag` `updated_at` unset, `RemoveTaskTag` hard-deleted the row). GREEN after implementing. New `backend/pkg/store/tombstone_integration_test.go`. `go build ./...` and `go vet ./...` clean; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5434/planner go test ./...` (219 passed). `CountTags` now counts active tags only; new `CountTagsUsage` (Active/Total) feeds `enforceLimit` so the plan cap uses active and the ceiling uses total.

## Next step
T3.
