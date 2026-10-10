# Events

## Objective
Let the user record one-off dated events (e.g. "thesis presentation on Nov 14 at 10:00") separately from tasks.

## Problem
The only creatable item is a task. A task models work to do (status, priority, timer, subtasks, completion). An event is something that happens at a time: it has a start, an optional end, an optional location, and is never started, paused, or completed.

## Why
The user felt events are different from tasks and only had "new task" available.

## Scope
- New `events` entity, separate from `tasks` (no `type` flag on Task — avoids task-only fields and `if type == event` branches leaking into events).
- Fields: title, description (notes), location, start_at (epoch ms), end_at (epoch ms, optional), all_day, color.
- One-off only; no recurrence.
- Backend CRUD at `/api/events` with `from`/`to` range filter.
- Storage ceiling for events (applies to every plan), text length limits, body size limit — reusing the storage-caps machinery.
- Frontend: the "+" lets the user choose Task or Event; event create/edit form; events shown in the tasks day view, calendar month, and dashboard "today".

## Out of scope
- Recurring events, reminders/notifications, invitations, external calendar sync.
- Free plan limit for events (only the hard ceiling).

## Constraints
- Branch `feat/events` was stacked on `feat/storage-caps`; after storage-caps merged into `main` (d82b62c) it sits directly on `main`.
- Mirror the existing class-session layering: model + Validate func, store methods, app handlers, migration in `backend/cmd/migrate/main.go`.
- Test-first where a deterministic test exists. Runner: `go test ./...` in `backend/`; integration tests need `TEST_DATABASE_URL` (skip otherwise). Frontend check: `npm run build` in `web/`.
- Artifacts (code, UI copy, comments) in English; Spanish UI strings go through the existing i18n file.

## Tasks
- [x] T1 Backend events: migration, model + validation, store CRUD + range list, handlers + routes, storage ceiling, tests - route: delegated writer (5+ non-trivial files)
- [x] T2 Frontend create/edit: Task/Event chooser on "+", event form, `/events/new` and `/events/[id]`, i18n - route: delegated writer
- [x] T3 Frontend display: events in tasks day view, calendar month, dashboard today - route: delegated writer

## Acceptance criteria
- POST `/api/events` with a valid body returns 201; missing title, end before start, or oversized text returns 400; body over the limit returns 413.
- GET `/api/events?from=&to=` returns only the user's non-deleted events overlapping the range.
- PUT/DELETE on another user's event returns 404.
- Creating past the events ceiling is refused with the same non-402 status used by other ceilings.
- The user can create, edit, and delete an event from the UI and sees it on its day in the calendar, the day view, and the dashboard.
- `go test ./...` passes; `npm run build` passes.

## Delivery
- Strategy: ask-on-risk. Forecast ~900 authored lines across 3 tasks (exceeds ~400).
- Chain strategy (user, 2026-10-09): `stacked-to-main`.
- Slices: PR1 = T1 backend (`4440576` + docs), PR2 = T2 create/edit UI, PR3 = T3 display. Each PR targets `main` and is based on the previous slice. Push and PR creation remain the user's decision.

## Progress
- Branch `feat/events` created on top of `feat/storage-caps` (d82b62c).
- T1 done (delegated writer), committed 398a888, rebased to 4440576 (same content).
  - RED: build failures (undefined model.Event, plan.ResourceEvent, store/app methods).
  - GREEN: `gofmt -l .` empty, `go vet ./...` clean, `go test ./...` 194 passed; store integration against local docker Postgres (port 5434, migrations 1-21) `go test ./pkg/store/` ok, 27 PASS, 0 skipped.
  - Decisions: `event_id TEXT PRIMARY KEY` like every table; DB CHECK end_at >= start_at; ceiling via enforceCeiling returns 409; updateEvent returns the stored row; server always generates event_id.
  - RDD: medium, consent granted, reliability lens approved with 0 findings, acknowledged (review-23e82f1b428b9a1a). A consolidated review of the whole range since 5a54f38 (storage-caps + events T1) was also granted and approved with 0 findings (review-09d266819ddc723d).
- `feat/storage-caps` fast-forwarded into local `main` (46b270d), not pushed; `feat/events` rebased onto it.
- T2 done (delegated writer).
  - Test-first exception: `web/` has no test runner; logic kept in pure helpers in `utils.js` (`eventTimesFromInputs`, `isEventEndValid`, `eventErrorKey`).
  - Checks: `npm run build` ok, no warnings. Browser smoke test against local backend + docker Postgres: "+" opens a Task/Event menu; Event keeps `?date=`; end-before-start shows a client error; create stored 10:00-12:00 with location; edit to all-day stored start at local midnight and `end_at` null; delete with confirm, then GET returned 404.
  - Known limits: `api()` drops the backend error text, so pages map status codes to i18n messages; `/events/[id]` opens straight into the edit form, like classes.
- Pre-existing, out of scope: tasks list shows `msgSaving` ("Guardando...") as its loading label (already on `main`).
- Open: `prisma/schema.prisma` has no Event model (Subscription is also absent, so it appears intentionally unsynced).

- T2 committed 9726e11; review approved with 0 findings (review-dc7ce294d86ee19f). A whole-range review since 5a54f38 was also approved (review-6832e2e5527eaf2c). The selectorless base stays at the remote `main` until local `main` is pushed.
- T3 done (delegated writer + one inline fix).
  - New `EventCard`; events sections on the tasks page (`?date=` day, or the next 7 days without a date), calendar month bars per day (multi-day events span every day), and a dashboard "Today's events" block. All are hidden when empty, and an events error never breaks tasks.
  - Test-first exception: there is no web test runner. Helpers in `utils.js` were checked ad hoc with node.
  - Browser smoke test (local backend + docker Postgres) with 3 seeded events: the thesis shows on `/tasks?date=2026-11-14` with 10:00-12:00 and its location; the calendar shows the 3-day congress on 11-13 Oct and dinner on the 9th; the dashboard shows dinner under "Eventos de hoy".
  - Bug found in the smoke test and fixed inline: `sortEvents` put all-day events first across days (11 Oct before 9 Oct). It now orders by local day, then all-day first, then start time. Re-verified with a node check and in the browser.
  - `npm run build` ok, no warnings.
  - Follow-ups: the events section ignores the tasks status filter and search; the "no tasks" empty state still shows under events.

## Next step
Feature complete. Delivery (push `main`, then stacked PRs) is the user's decision.
