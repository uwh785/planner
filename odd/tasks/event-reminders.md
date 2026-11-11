# Event reminders

## Objective
Let the user flag a calendar event as a reminder so the home panel shows it with a days-remaining countdown ("Recharge: 29 days left"), and make "in 30 / 60 / 90 days" a one-tap date choice.

## Problem
The home panel only lists today's events. An event 60 days away is invisible until its day arrives, and picking a date N days ahead means counting on the calendar by hand.

## Why
The user (2026-11-11) wants to record things like "I recharged today, remind me in 60 days" and keep an eye on how many days are left from the home panel. They chose to build this on calendar events instead of a separate reminder entity, to try it.

## Scope
- New boolean `remind` on events (JSON `remind`, default false): "show on the home panel with a countdown".
- Event form: a "Remind me on the home panel" switch and three shortcuts, "In 30 days", "In 60 days", "In 90 days". A shortcut sets the date to today plus N local days and turns the switch on.
- Home panel: a "Reminders" block listing flagged events whose start day is today or later, soonest first, each with "N days left" ("Tomorrow", "Today" for 1 and 0). The block is absent when there are none. Past reminders drop off.
- Backend, native client and web.

## Out of scope
- Push or local notifications, recurring reminders ("every 60 days"), a separate reminders screen.

## Constraints
- Branch `feat/event-reminders`, based on `feat/native-calendar` (0a8dcc7).
- An older client that omits `remind` on update must not reset it: the backend takes `remind` as optional (`*bool`) and keeps the stored value when it is absent.
- Day counts use whole local days (`startOfLocalDay` difference, rounded), never elapsed milliseconds, so DST days do not shift the number.
- Native local schema changes go in a new append-only migration `003`.
- Artifacts (code, comments, UI copy keys) in English; Spanish strings through the i18n catalogs (Spanish is the master catalog natively).
- Test-first where a deterministic runner exists: `go test ./...` in `backend/` (integration tests need `TEST_DATABASE_URL`), `npm run typecheck && npm run lint && npm test` in `native-client/`. `web/` has no test runner: `npm run build` only, logic kept in pure helpers.

## Tasks
- [x] T1 Backend: `remind` column (idempotent `ALTER TABLE`), model field, store column lists (eventColumns, scanEvent, INSERT, UPDATE with keep-when-absent), sync pull scan, tests - route: delegated writer (4+ non-trivial files)
- [ ] T2 Native client: migration 003, domain/row/mappers/payload/pull parsing, `daysUntil` helper and reminders model, form switch and shortcuts, Panel "Reminders" block, i18n, tests - route: delegated writer
- [ ] T3 Web: form checkbox and shortcuts, dashboard "Reminders" block, i18n with a count, `daysUntil` helper - route: delegated writer

## Acceptance criteria
- POST/PUT `/api/events` round-trips `remind`; a PUT or sync push without `remind` leaves the stored value unchanged; pull returns it.
- Natively, an event created offline with the switch on appears under "Reminders" on the Panel with the right day count, survives restart, and syncs.
- "In 60 days" on 2026-11-11 sets the date to 2027-01-10 and the Panel reads "60 days left".
- A flagged event for today reads "Today"; one from yesterday is not listed.
- `go test ./...`, native `typecheck`, `lint`, `test`, and web `npm run build` pass.

## Delivery
- Strategy: ask-on-risk. Forecast ~700 authored lines (T1 ~130, T2 ~420, T3 ~150), over ~400.
- Chain strategy: pending the user's answer (the events feature used `stacked-to-main`).
- Slices: one per task.

## Progress
- 2026-11-11: mapped the events vertical (read-only explorer); feature document created; branch created.
- T1 done (delegated writer), commit 75ef964 (8 files, +184/-10).
  - RED: `go test ./pkg/model/` and `go vet ./pkg/store/` failed to build on the undefined `Remind` field.
  - GREEN: `gofmt -l .` empty, `go vet ./...` clean, `go test ./...` ok; with the local compose Postgres (port 5434, migrated) `go test -count=1 ./...` 304 passed, `TestEventRemindIntegration`, `TestSyncChangesIntegration` and `TestSyncPushIntegration` ran, not skipped. Parent spot check: gofmt, vet and `go test ./...` ok.
  - Decisions: `Remind *bool`; `UpdateEvent` uses `COALESCE($10, remind)` and covers PUT and sync push; `CreateEvent` defaults nil to false in Go because the POST handler returns the struct without re-reading the row.
  - Not covered: no HTTP-level test of the POST/PUT JSON response (covered at model, store and sync-push level).
- Next: T2.
