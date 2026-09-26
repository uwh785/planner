# Task state bugs

## Objective
Make task start/pause/complete enforce valid state transitions, report missing tasks, and make the countdown resume where it was paused.

## Problem
- `store.StartTask/PauseTask/CompleteTask` run unconditional `UPDATE`s: a completed task can be started again.
- `RowsAffected` is never checked: a non-existent task ID returns 200.
- Pause only sets `status = 'pending'`; elapsed time is not stored. The frontend computes `remaining = duration_ms - (now - started_at)`, so resuming restarts the countdown from the full duration.

## Why
Correctness of the core feature (countdown) before the production deploy on Supabase (plain Postgres via pgx, no adapter change needed).

## Scope
- Backend: `pkg/store`, `pkg/app` (task handlers), migration for an accumulated elapsed column, `pkg/model`.
- Frontend: countdown math in `web/src/lib/utils.js` (and any consumer that relies on `started_at` alone).
- Out of scope: hexagonal refactor (not selected by the user), subtasks/lists, Supabase pooler config.

## Constraints
- Strict TDD: RED, then GREEN, then REFACTOR. Runner: `go test ./...` in `backend/` (integration tests need `TEST_DATABASE_URL`, DB from `docker-compose.yml` on port 5434).
- Keep existing API response shapes; add new error statuses only.
- ~400 authored changed lines per task is a planning heuristic, not a cap.

## Tasks
- [x] T1 Transitions + not found: start (pending -> in_progress), pause (in_progress -> pending), complete (pending|in_progress -> completed). Missing task -> 404, invalid transition -> 409.
- [x] T2 Pause accumulates elapsed time: persist accumulated elapsed ms; pause/complete add `now - started_at`; start sets `started_at = now`; frontend remaining/progress use accumulated + running segment.
- [x] T3 Review regressions (reason: native review of 302fd51..be36a26, lineage review-bd49734769cf02ad, approved with advisory WARNINGs caused by this feature): (a) completed tasks with a duration must show full progress again (`TaskCard.svelte:37-40`); (b) `taskTransitionError` must map only `pgx.ErrNoRows` to `ErrNotFound` and pass other lookup errors through (`store.go:366-371`); add a handler-level table test for `taskTransitionErrResp` (no DB).

- [x] T4 `PUT /api/tasks/:id` must only edit user-editable fields (list_id, title, description, priority, due_date, due_all_day, duration_ms). Server-managed fields (status, started_at, elapsed_ms, completed_at) are never written by it; sort_order is not sent by the frontend and must not be zeroed. Unknown task -> 404; empty title -> 400; respond with the stored task. Reason: parent read `store.UpdateTask` (store.go:342) + `TaskForm.svelte:105-113` — the edit form omits status/started_at/completed_at/sort_order, so every edit sets status='' (no CHECK constraint), clears the countdown, and makes start/pause/complete return 409 forever; it also lets clients bypass T1 transitions.
## Acceptance criteria
- Starting a completed task returns 409 and does not change the row.
- start/pause/complete on an unknown ID return 404.
- Start 10 min task, run 3 min, pause, resume: remaining is 7 min, not 10.
- `go test ./...` green with `TEST_DATABASE_URL` set; `npm run check` / build green in `web/`.

## Checks
- `cd backend && go vet ./... && TEST_DATABASE_URL=... go test ./...`
- `cd web && npm run check && npm run build`

## Route
- T1, T2: delegated direct (writer trigger: 2+ non-trivial files across store, app, migration, frontend).

## Delivery
- Branch `fix/task-state-transitions`, strategy `ask-on-risk`. Forecast ~250 authored lines.

## Progress
- Branch created from `main` (fdd833c).
- T1 done. Added `store.ErrInvalidTransition`; `StartTask`/`PauseTask`/`CompleteTask` now run conditional UPDATEs scoped to the states they allow and, on 0 rows affected, distinguish missing task (`ErrNotFound`) from wrong-state task (`ErrInvalidTransition`). Handlers map these to 404/409 via `taskTransitionErrResp`, mirroring the existing `updateClass`/`deleteClass` pattern.
  - RED: `TEST_DATABASE_URL=... go test ./pkg/store/... -run TestTaskStateTransitionsIntegration -v` failed to build (`undefined: ErrInvalidTransition`).
  - GREEN: same command passed after implementation; full suite `TEST_DATABASE_URL=... go test ./...` -> `47 passed in 9 packages`; `go vet ./...` clean.
  - Commit: `302fd51` fix(tasks): enforce state transitions and 404 on missing task.
  - Files: `backend/pkg/store/store.go`, `backend/pkg/store/task_transition_test.go` (new), `backend/pkg/app/app.go`.
- T2 done. Added `tasks.elapsed_ms BIGINT NOT NULL DEFAULT 0` migration and `model.Task.ElapsedMs` (`elapsed_ms` in JSON). `PauseTask` and `CompleteTask` (when previously `in_progress`) now add `now - started_at` to `elapsed_ms` and clear `started_at`; `StartTask` only sets `started_at`, leaving `elapsed_ms` as the resume base. Frontend `getElapsedMs`/`getProgressPercent`/`getRemainingMs` in `utils.js` now compute `accumulated elapsed_ms + running segment`; `TaskCard.svelte`'s effect shows a frozen countdown when paused (no `started_at`) instead of only ticking when both `started_at` and `duration_ms` are set. `tasks/[id]/+page.svelte` needed no change (already delegates to the util functions). Also updated `prisma/schema.prisma` to mirror the new column.
  - RED: `TEST_DATABASE_URL=... go test ./pkg/store/... -run TestTaskElapsedAccumulationIntegration -v` failed to build (`afterPause.ElapsedMs undefined`).
  - GREEN: same command passed after implementation (`2 passed` alongside the T1 test); full suite `TEST_DATABASE_URL=... go test ./...` -> `48 passed in 9 packages`; `go vet ./...` clean.
  - Frontend: `npm run build` succeeds. `npm run check` is not a defined script in `web/package.json` (no `check`/`svelte-check` present in this repo) — could not run as specified; reported honestly rather than skipped silently. Did not add a check script/dependency (out of scope, minimal diff).
  - Commit: `be36a26` fix(tasks): persist accumulated elapsed time across pause/resume.
  - Files: `backend/pkg/store/store.go`, `backend/pkg/store/task_elapsed_test.go` (new), `backend/pkg/model/model.go`, `backend/cmd/migrate/main.go`, `prisma/schema.prisma`, `web/src/lib/utils.js`, `web/src/lib/components/TaskCard.svelte`.

- Review: assessed medium (executable change in migrate), consent granted, 1 lens (reliability), approved and acknowledged. Advisory: 2 WARNINGs -> T3; SUGGESTION frontend elapsed helpers untested (no JS test runner in repo, not added).

- T3 done. (a) Fixed once in `web/src/lib/utils.js`: `getProgressPercent`/`getRemainingMs` now check `task.status === 'completed'` first (return 1 / 0) before the `duration_ms` check, so a task completed straight from pending (elapsed_ms 0) or from any partial elapsed state shows full progress/zero remaining. Both `TaskCard.svelte` and `tasks/[id]/+page.svelte` delegate to these helpers, so no change was needed in either consumer. (b) `store.taskTransitionError` (`store.go`) now does `_, err := s.GetTask(...)`; if `err == nil` -> `ErrInvalidTransition`; if `errors.Is(err, pgx.ErrNoRows)` -> `ErrNotFound`; otherwise the raw `err` is returned so handlers map it to 500 via the existing `taskTransitionErrResp` (already correct, now exercised directly by a test). (c) Added `backend/pkg/app/task_transition_err_resp_test.go`: table test for `taskTransitionErrResp` (`store.ErrNotFound`->404, `store.ErrInvalidTransition`->409, other error->500) plus a nil-error case, no DB.
  - RED (b): new no-DB unit test `backend/pkg/store/task_transition_error_test.go::TestTaskTransitionErrorPassesThroughNonNotFoundError` creates a `pgxpool.Pool` that is closed before use (so `Acquire` fails immediately and deterministically with a non-`ErrNoRows` error, no live DB needed) and asserts `taskTransitionError` does NOT map it to `ErrNotFound`. Before the fix: `go test ./pkg/store/... -run TestTaskTransitionErrorPassesThroughNonNotFoundError -v` -> FAIL (`taskTransitionError with closed pool = not found, want passthrough error, not ErrNotFound`).
  - GREEN (b): same command -> `1 passed` after the `store.go` fix.
  - (a) has no JS test runner in the repo (per task instructions, none added); verified via `npm run build` (succeeds) and by reading both consumers to confirm they delegate to the fixed helpers with no independent progress logic.
  - (c) is a regression-locking test for already-correct handler logic (not a bug fix), so it passed on first run: `go test ./pkg/app/... -run TestTaskTransitionErrResp -v` -> `5 passed`.
  - Full suite: `go vet ./...` clean; `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5434/planner?sslmode=disable go test ./...` -> `54 passed in 9 packages`.
  - `cd web && npm run build` -> succeeds.
  - Commit: `689a296` fix(tasks): keep completed progress full and surface lookup errors.
  - Files: `backend/pkg/store/store.go`, `backend/pkg/store/task_transition_error_test.go` (new), `backend/pkg/app/task_transition_err_resp_test.go` (new), `web/src/lib/utils.js`.

- T3 review assess (base be36a26, committed-only): medium, 106 lines, review_due=false (under_budget) -> pending in slice. Parent spot check: `go test ./...` green; `GetTask` returns raw pgx.ErrNoRows, so the errors.Is mapping is correct.

- T4 done. `store.UpdateTask` (`store.go`) now writes only `list_id, title, description, priority, due_date, due_all_day, duration_ms, updated_at`; it no longer touches `status`, `started_at`, `elapsed_ms`, `completed_at`, or `sort_order`, and returns `ErrNotFound` when the conditional `UPDATE` affects 0 rows (unknown ID, deleted, or another user's task), mirroring `UpdateClass`. `app.updateTask` now validates a non-empty (trimmed) title like `createTask`, maps store errors through the existing `taskTransitionErrResp` helper (`ErrNotFound` -> 404 "task not found"), and on success re-reads the task via `GetTaskFull` (same as `getTask`) and responds with that instead of echoing the request body.
  - RED: stashed the implementation, ran new tests against the unfixed code.
    - `TEST_DATABASE_URL=... go test ./pkg/store/... -run 'TestUpdateTaskEditableFieldsOnlyIntegration|TestUpdateTaskUnknownIDReturnsNotFoundIntegration' -v` -> `0 passed, 2 failed`: `status = "", want unchanged in_progress`; `started_at = <nil>, want unchanged ...`; `sort_order = 0, want unchanged 5`; `UpdateTask(unknown): err = <nil>, want ErrNotFound`.
    - `go test ./pkg/app/... -run TestUpdateTaskEmptyTitleReturns400 -v` -> panic (nil pointer dereference on `claims.UserID`): current handler has no title check and reaches the store unconditionally.
  - GREEN: unstashed the implementation.
    - `go vet ./...` -> clean.
    - `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5434/planner?sslmode=disable go test ./...` -> `57 passed in 9 packages` (54 prior + 3 new: `TestUpdateTaskEditableFieldsOnlyIntegration`, `TestUpdateTaskUnknownIDReturnsNotFoundIntegration`, `TestUpdateTaskEmptyTitleReturns400`).
  - Frontend: confirmed no change needed. `tasks/[id]/+page.svelte` `handleUpdate` discards the PUT response body and calls `loadTask()` (a `GET`) right after, so the handler's new response shape (re-read `TaskFull` instead of echoed input) is transparent to it. `cd web && npm run build` -> succeeds.
  - Commit: `f2e6590` fix(tasks): restrict task update to editable fields.
  - Files: `backend/pkg/store/store.go`, `backend/pkg/store/task_update_test.go` (new), `backend/pkg/app/app.go`, `backend/pkg/app/tasks_test.go`.

- T3+T4 review (base be36a26, lineage review-0d0cd0327b4a0f82): high risk (update path), consent granted, 4 lenses, approved and acknowledged. Advisory WARNING (R2/R3/R4): updateTask read-back mapped every GetTaskFull error to 404 -> fixed inline in `9d1416a` (500 + log); no deterministic RED possible without a store fake (app depends on concrete store), verified by `go vet` + `go test ./...` 57 passed. R3-notfound-branch-unproved refuted: `task_transition_test.go:58-60` covers unknown ID -> ErrNotFound. Remaining SUGGESTIONs (test naming/docs, frontend utils untested) left as follow-ups. `9d1416a` pending review in the next slice (4 lines, under budget).

## Next step
- Feature done (T1-T4). Delivery: push + PR to `main` is the user's decision. Then deploy (Supabase migration for `elapsed_ms`, pooler mode, Vercel env vars).
