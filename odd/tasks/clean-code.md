# Clean code pass

## Objective
Apply behavior-preserving clean-code fixes found by a read-only audit of backend and frontend.

## Baseline (audit)
- `go vet ./...` clean; `go test ./...` 42 passed; `gofmt -l`: `pkg/app/app.go`, `pkg/config/config.go`, `pkg/model/model.go`.
- Svelte warnings: `state_referenced_locally` x22 (ClassForm, TaskForm), `a11y_label_has_associated_control` x2, `a11y_click_events_have_key_events` x1 (TaskCard).

## Decisions
- F4 forms keep one-time initialization from props (editing must not be reset by prop updates): silence with `untrack`, do NOT switch to `$derived`.
- B2 dashboard: surfacing store errors as 500 instead of silently rendering empty lists is an intended correctness fix.
- B5 committed binary `backend/server`: add to `.gitignore` only (no repo yet; file left in place, user decides deletion).
- Dashboard `upcoming` (rolling 24h) is still rendered by the frontend: keep it.

## Tasks
- [x] T1 Backend: B1 build handler once in `api/index.go`; B2 check `ListTasks` errors in dashboard; B3 handle `rand.Read` error in `genID`; B6 name the 24h constant (share with store's 86400000 if natural); B4 `gofmt -w`. (route: delegated writer)
- [x] T2 Frontend: F1 single `request()` behind `api()`/`apiRaw()`; F2 shared `.btn-back` style; F3 remove dead `cn`, `formatDateTime`, `formatMinutes`; F4 `untrack` initializers; F5 TaskCard keyboard-accessible; F6 label/control association. (route: delegated writer, same)
- [x] T3 `.gitignore`: `backend/server`, `.playwright-mcp/`. (route: parent, inline)
- [x] T4 Verify: go vet/test/gofmt clean, `npm run build` with zero Svelte warnings, Playwright smoke on main routes at 375px (no page errors, no overflow). (route: parent)

## Acceptance criteria
- `gofmt -l backend/` empty, `go vet` clean, `go test ./...` passes.
- `npm run build` passes with 0 `svelte.dev/e/` warnings.
- App behaves the same in the browser.

## Constraints
- TDD strict for backend behavior changes (B2, B3): test first where the code is testable without a DB; otherwise document why.
- No git repo: no commits.

## Progress / evidence
- T1/T2 (delegated writer): B1 `sync.Once` handler in `api/index.go`; B2 dashboard returns 500 on ListTasks errors (not unit-tested: App uses concrete *store.Store, no interface added on purpose); B3 `genID` panics on rand failure, characterization tests `TestGenIDShape`/`TestGenIDUniqueAcrossCalls` (green before and after); B6 `store.DayMs` shared by dashboard and `overdueCondition`; B4 gofmt. F1 `request()` behind `api()`/`apiRaw()`; F2 global `.btn-back` in app.css; F3 removed `cn`, `formatDateTime`, `formatMinutes`; F4 `untrack` initializers; F5 TaskCard Enter/Space with target guard; F6 span + aria-labelledby for color and duration groups.
- T3 (parent): `.gitignore` += `backend/server`, `.playwright-mcp/`.
- T4 (parent): `gofmt -l` empty; `go vet` clean; `go test ./...` 44 passed (46 with TEST_DATABASE_URL per writer); `npm run build` 0 Svelte warnings (baseline 25); Playwright 375px on dashboard, tasks, task detail, tasks/new, schedule, calendar, config: no overflow, no page/console errors; `.btn-back` 44x44; Enter on focused task card navigates to detail.
- Found (pre-existing, not a regression): config page shows "-" for email/name because `A.user` is never assigned anywhere in the frontend.
- Commits: not possible (no git repo).

## Next step
- Fix config user info (load `/api/auth/me` into `A.user`).
