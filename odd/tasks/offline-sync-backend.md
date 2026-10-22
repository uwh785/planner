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
- [x] T3 Idempotent creates: same-user duplicate ID returns the existing row; cross-user collision returns 409. Route: delegated writer (2+ non-trivial files).
- [x] T4a Sync pull: `GET /api/sync?since=` returns every row changed since the cursor, tombstones included, plus a new cursor.
- [x] T4b Sync push: `POST /api/sync/push` applies a batch of upserts/deletes with per-item results (incl. 402/409), reusing the T3 idempotent creates.
- [x] T4c Fix `list_id` decoding on `POST/PUT /api/tasks` (`model.Task.ListID` is `sql.NullString`, so a JSON string fails; verified with a probe) and add tests for the untested push guard paths flagged in the T4b review. Route: delegated writer.
- [x] T5 Client-supplied timestamps for start/pause/complete so offline timer segments replay faithfully.
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

T3: RED observed first (store test build failure on `ReplayTask`/`ErrConflict`; handler test failed because `createEvent` discarded the client `event_id`). GREEN after implementing: `Replay*` lookups, `ON CONFLICT (pk) DO NOTHING` creates mapped to `ErrConflict`, generic `createIdempotent` handler flow (lookup, then plan/ceiling guard, then create, re-lookup on a lost race). New `backend/pkg/store/idempotent_create_integration_test.go` and `backend/pkg/app/idempotent_create_integration_test.go`. `go build ./...`, `go vet ./...`, `gofmt -l pkg` clean; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5434/planner go test -count=1 ./...` (227 passed).

T4a: RED observed first (both new test files failed to compile: `Store.SyncChanges` and `App.syncPull` undefined). GREEN after implementing `backend/pkg/store/sync.go` (`SyncChanges`: cursor read before a single read-only REPEATABLE READ tx, per-table `user_id = $1 AND updated_at >= $2` queries including tombstones, generic `SyncRow[T]` wrapper with its own `MarshalJSON` adding `deleted` so `model.Task`'s custom marshaller is preserved, `SyncTag`/`SyncTaskTag` add `updated_at`), `backend/pkg/app/sync.go` (`GET /api/sync?since=`, 400 on negative/non-integer) and the route in `app.go`. New `backend/pkg/store/sync_integration_test.go` and `backend/pkg/app/sync_integration_test.go`. `go build ./...`, `go vet ./...`, `gofmt -l pkg` clean; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5434/planner go test -count=1 ./...` (230 passed).

Follow-up (non-blocking review advisory): soft-deleted tags are never purged and count toward the tag storage ceiling (`CountTagsUsage.Total`); decide a purge policy later.

T4b: RED observed first (store and app test packages failed to compile: `syncCursor`, `store.SyncCursorOverlapMs`, `App.syncPush` undefined). GREEN after implementing `backend/pkg/app/sync_push.go` (`POST /api/sync/push`: max 200 changes, whole-batch 400 for bad JSON/empty/oversized/unknown entity or op, otherwise 200 with per-item `applied|exists|not_found|conflict|limit|invalid|error` plus the single-endpoint `http_status`; non-atomic, upserts in dependency order then deletes in reverse, results in request order; create guards reuse `enforceLimit`/`enforceCeiling` through a response recorder, with the subtask/class/event guards extracted into `guardSubtask`/`guardClass`/`guardEvent` shared with the create handlers), `store.UpdateTag`, `store.EntityState` (own-live / own-deleted / foreign / absent for idempotent deletes), `store.TaskTagLive`, and the route in `app.go`. Task upsert decodes `list_id` through a shadowing `*string` because `model.Task.ListID` is a `sql.NullString` that cannot decode a plain JSON string. New `backend/pkg/app/sync_push_integration_test.go`. Cursor-margin fix for the T4a review advisory: `SyncChanges` now returns capture time minus `SyncCursorOverlapMs` (5000, floored at 0) via `syncCursor`; new `TestSyncCursorOverlap` and the existing cursor assertions updated. Timer replay (start/pause/complete) is deliberately left to T5.

Note: the T4a review advisory (pull cursor commit race: a writer stamping `updated_at` below the cursor but committing after the snapshot was invisible forever) was fixed here with the overlap margin.

T4c: RED observed first (model: `TestTaskUnmarshalJSONListID` string and empty-string cases, `TestTaskJSONRoundTrip` and `TestTaskFullUnmarshalJSON` failed with "cannot unmarshal string into Go struct field Task.list_id of type sql.NullString"; app: `TestSyncPushGuardPaths` failed because a subtask delete with the wrong `task_id` answered `applied 200` while deleting nothing). GREEN after adding `Task.UnmarshalJSON` (null, absent or empty `list_id` means no list) and `TaskFull.UnmarshalJSON` in `backend/pkg/model/model.go`, decoding task upserts straight into `model.Task` in `sync_push.go`, and refusing a subtask delete whose `task_id` is not the real parent as `not_found` 404 (behaviour change: previously `applied`). New tests: guard paths (foreign or missing list on a task, foreign or missing task or tag on a task_tag, 409 ceilings for subtask/class/event reached by direct inserts, mismatched subtask delete) in `sync_push_integration_test.go`, plus `TestTaskHandlersPersistListID` for POST/PUT `/api/tasks`. `go build ./...`, `go vet ./...`, `gofmt -l pkg` clean; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5434/planner go test -count=1 ./...` (242 passed). Open gap: `createTask`/`updateTask` and `tasks.list_id` (no FK) do not verify that the list is the caller's live list, so the single-item endpoints accept a foreign or missing list id; only sync push checks it.

T5: RED observed first (store and app test packages failed to compile: `StartTask` took too many arguments, `store.MaxClockSkewMs` undefined). GREEN after implementing: `StartTask/PauseTask/CompleteTask(userID, taskID, at int64)` in `backend/pkg/store/store.go` (`at == 0` means server now; negative or beyond `MaxClockSkewMs` (5 min) is the new `ErrInvalidTime`; segments use `GREATEST(at - started_at, 0)`; `updated_at` stays server time), optional `{"at": ms}` body via `transitionAt` in `backend/pkg/app/app.go` (no body or no `at` = now; bad JSON, non-positive or far-future `at` = 400), and sync push ops `start|pause|complete` (entity `task` only, `data.at` required) applied after upserts and before deletes in request order, mapped to applied/conflict/not_found/invalid in `sync_push.go`. New `backend/pkg/store/task_transition_at_test.go` and `backend/pkg/app/task_transition_at_integration_test.go`; existing store callers pass `0`. `go build ./...`, `go vet ./...`, `gofmt -l pkg` clean; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5434/planner go test -count=1 ./...` (246 passed). Note: a push timer op without `data.at` is `invalid` (unlike REST, where a missing `at` means now), because a replay without its real time would credit the sync time.

## Next step
T6.
