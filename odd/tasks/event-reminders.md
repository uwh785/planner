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
- Home panel: a "Reminders" block listing flagged events whose start day is tomorrow or later, soonest first, each with "N days left" ("Tomorrow" for 1). On its own day the event is only under "Today's events" (user, 2026-11-13, after review). The block is absent when there are none. Past reminders drop off.
- Backend, native client and web.

## Out of scope
- Push or local notifications, recurring reminders ("every 60 days"), a separate reminders screen.

## Constraints
- Branch `feat/event-reminders`, based on `feat/native-calendar` (0a8dcc7); both are now in `main` and deleted (see Delivery).
- An older client that omits `remind` on update must not reset it: the backend takes `remind` as optional (`*bool`) and keeps the stored value when it is absent.
- Day counts use whole local days (`startOfLocalDay` difference, rounded), never elapsed milliseconds, so DST days do not shift the number.
- Native local schema changes go in a new append-only migration `003`.
- Artifacts (code, comments, UI copy keys) in English; Spanish strings through the i18n catalogs (Spanish is the master catalog natively).
- Test-first where a deterministic runner exists: `go test ./...` in `backend/` (integration tests need `TEST_DATABASE_URL`), `npm run typecheck && npm run lint && npm test` in `native-client/`. `web/` has no test runner: `npm run build` only, logic kept in pure helpers.

## Tasks
- [x] T1 Backend: `remind` column (idempotent `ALTER TABLE`), model field, store column lists (eventColumns, scanEvent, INSERT, UPDATE with keep-when-absent), sync pull scan, tests - route: delegated writer (4+ non-trivial files)
- [x] T2 Native client: migration 003, domain/row/mappers/payload/pull parsing, `daysUntil` helper and reminders model, form switch and shortcuts, Panel "Reminders" block, i18n, tests - route: delegated writer
- [x] T3 Web: form checkbox and shortcuts, dashboard "Reminders" block, i18n with a count, `daysUntil` helper - route: delegated writer

## Acceptance criteria
- POST/PUT `/api/events` round-trips `remind`; a PUT or sync push without `remind` leaves the stored value unchanged; pull returns it.
- Natively, an event created offline with the switch on appears under "Reminders" on the Panel with the right day count, survives restart, and syncs.
- "In 60 days" on 2026-11-11 sets the date to 2027-01-10 and the Panel reads "60 days left".
- A flagged event for tomorrow reads "Tomorrow"; one for today shows only under "Today's events"; one from yesterday is not listed.
- `go test ./...`, native `typecheck`, `lint`, `test`, and web `npm run build` pass.

## Delivery
- Strategy: ask-on-risk. Forecast ~700 authored lines (T1 ~130, T2 ~420, T3 ~150), over ~400.
- Planned (2026-11-11): `stacked-to-main`, three PRs (backend, native client, web) on top of `feat/native-calendar`. Superseded.
- Delivered (user, 2026-11-13): no PRs. `main` fast-forwarded to `1b94cb6` (`feat/native-calendar` and `feat/event-reminders`, no merge commit) and pushed to `origin`. Every other branch, local and remote, was checked to be contained in that commit and then deleted; `main` is the only branch left. Nothing went through GitHub review; the review on record is the medium local review of `0a8dcc7..HEAD` (see Progress).
- Review: T1 range from `0a8dcc7` assessed medium, `under_budget` (247 lines), pending in the slice. A whole-branch review against `main` (58 files, 3050 lines, consent granted) stopped with `lens_context_budget_exceeded`; no authority was created.

## Progress
- 2026-11-11: mapped the events vertical (read-only explorer); feature document created; branch created.
- T1 done (delegated writer), commit 75ef964 (8 files, +184/-10).
  - RED: `go test ./pkg/model/` and `go vet ./pkg/store/` failed to build on the undefined `Remind` field.
  - GREEN: `gofmt -l .` empty, `go vet ./...` clean, `go test ./...` ok; with the local compose Postgres (port 5434, migrated) `go test -count=1 ./...` 304 passed, `TestEventRemindIntegration`, `TestSyncChangesIntegration` and `TestSyncPushIntegration` ran, not skipped. Parent spot check: gofmt, vet and `go test ./...` ok.
  - Decisions: `Remind *bool`; `UpdateEvent` uses `COALESCE($10, remind)` and covers PUT and sync push; `CreateEvent` defaults nil to false in Go because the POST handler returns the struct without re-reading the row.
  - Not covered: no HTTP-level test of the POST/PUT JSON response (covered at model, store and sync-push level).
- T2 done (delegated writer; parent added two names to the components README).
  - RED: first jest run over the touched suites, 10 suites and 19 tests failed (missing modules, missing `remind`, missing Panel block and form controls).
  - GREEN: `npm run typecheck` clean, `npm run lint` clean. `npm test` does not finish: `__tests__/presentation/syncStatus.test.tsx` hangs, also with the changes stashed (pre-existing). Without that suite: 93 of 94 suites, 1060 of 1061 tests passed; the one failure, `taskDetailComponents > SubtaskAddField > has a visible label`, is a 5000 ms timeout that passed alone (36/36) and in the first full run, no clean-checkout evidence. Parent spot check: typecheck clean, the four new suites pass (18 tests).
  - Decisions: shortcuts reuse `FilterChips` under the date field and count from today; a shortcut sets the date and turns the reminder on; the Panel block is one grouped surface of `ReminderRow`s above "Today's events"; "Today"/"Tomorrow" reuse `dateToday`/`dateTomorrow`; new keys `eventRemind`, `eventInDays`, `eventShortcuts`, `dashboardReminders`, `reminderDaysLeft`.
  - Known limit: a shortcut on a multi-day event trips the existing end-before-start validation, as picking a date by hand does.
  - Pending: emulator check of the form and the Panel.
- T3 done (delegated writer), commit 5544422 (5 files, +250/-6).
  - Test-first exception: `web/` has no test runner; logic kept in pure helpers in `utils.js`.
  - Checks: `npm run build` ok (only the existing `ClassForm.svelte:155` a11y warning); throwaway node script confirmed 2026-11-11 + 60 days = 2027-01-10, today 0, yesterday excluded, ordering. No browser check; `t()` with params was not exercised outside the build.
  - Decisions: `t(key, params)` with `{count}` and `{ one, other }`; future events fetched with `from` only; shortcut chips copy the `.filter-btn` rules.
- Review: range from `0a8dcc7` assessed medium, `under_budget` after T2. Whole-branch review against `main` consented twice (2026-11-11); the first stopped with `lens_context_budget_exceeded`, the second was not started because T3 landed after its target was frozen and the session ran out of usage.
- 2026-11-13: parent spot check of T3: `npm run build` ok; `remind` reaches POST/PUT bodies unchanged; `ListEvents` with `from` only returns events with `COALESCE(end_at, start_at) >= from`, and `upcomingReminders` drops the ones that started before today, as scoped.
- 2026-11-13: fixed the hanging `syncStatus.test.tsx`. Cause: "keeps its relative time fresh" faked every timer, `setImmediate` included, which React's scheduler uses in Node, so `act()` never settled (a Node report showed an idle event loop, not a busy one). Toggling `doNotFake` one at a time isolated `setImmediate`; the test now keeps it real. Limit: the test also passes with `SyncStatusLine`'s own interval broken, because the Panel re-renders on `useNow`; it covers the visible behavior, not that interval.
  - Checks: native `typecheck` clean, `lint` clean, `npm test` 95 of 95 suites, 1092 of 1092 tests passed (the `SubtaskAddField` timeout did not recur).
- 2026-11-13: review of `0a8dcc7..HEAD` (medium, 9 findings, unverified by the recipe; parent confirmed the pull and shortcut ones in code). User chose to fix 1, 4, 5, 6 and 9:
  - Pull keeps the stored `remind` when the server omits it (`PulledEvent`, `pulledEventToRow` drops the column; a new row takes the column default 0), matching the backend rule.
  - Reminders start tomorrow (native and web), so a reminder on its day is not shown twice.
  - Web shortcuts read today at the tap; the dashboard derives reminders from a ticking `nowMs` and reloads today's events and reminders when the day changes.
  - `dueText` reuses `daysUntil`.
  - Left as is: server-side `remind` filter and the two overlapping web requests (2, 3), shortcut keeping the end time on multi-day events (7, known limit), chip staying active with the switch off (8).
  - Checks: native typecheck and lint clean, `npm test` 95 of 95 suites, 1093 tests; RED first for the pull and tomorrow-on tests (2 and 3 failures). Web `npm run build` ok; throwaway node script: today excluded, tomorrow 1, 2026-11-11 + 60 = 2027-01-10.
- 2026-11-13: browser check (headless Chromium via Playwright against `npm run dev` + local backend and compose Postgres, seeded through the API). Dashboard: "Renovar seguro, Mañana", "Recarga, Faltan 29 días"; the flagged event due today shows only under "Eventos de hoy"; a non-flagged event is not listed. Form: "En 60 días" on 2026-11-13 set 2027-01-12, ticked "Recordar en inicio" and marked the chip pressed; after saving, the dashboard read "Recarga celular, 12 ene, Faltan 60 días". No console errors. Not exercised: the overnight refresh.
- 2026-11-13: delivered to `main` (`1b94cb6`, fast-forward, pushed); all other branches deleted, see Delivery.
- Pending: emulator check, now against `main`.
