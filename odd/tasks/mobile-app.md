# Planner mobile app

## Objective
A bare React Native (no Expo) Android app for the Planner backend: fully usable offline, multi-user (register and login), syncing with the backend when a connection returns.

## Problem
The Planner web app needs a network. The user wants the same data on a phone, readable and editable offline, with offline changes uploaded later without loss or duplication. Calm, minimal, light personality (see `PRODUCT.md`).

## Scope
- Android only (the dev machine is Linux; iOS cannot be built here). Dev target: emulator `Pixel_10_Pro`.
- Backend contract (already implemented in `/home/kv/Projects/programming/planner`, branch `feat/offline-sync-schema`): `POST /api/auth/register|login|refresh|logout`, `GET /api/sync?since=`, `POST /api/sync/push` (batch, `change_id` for timer ops), client-generated IDs, timer transitions with client `at`.
- Out of scope: iOS, push notifications from the server, web changes.

## Constraints
- TypeScript strict. Hexagonal layout: `domain` (entities, rules), `application` (use cases, ports), `infrastructure` (SQLite, HTTP, secure storage, notifications), `presentation` (container/presentational components, atomic design).
- Local source of truth is SQLite; the UI never waits for the network.
- No secrets in the repo. Tokens in Android Keystore-backed storage.
- Artifacts (code, comments, UI copy) in English. Conventional Commits, no AI attribution.
- `src/domain` and `src/application` are framework-agnostic TypeScript (no React Native, no Android APIs) so they can be shared later with the Tauri desktop clients.
- Planning heuristic: about 400 authored changed lines per task.

## Delivery strategy
ask-on-risk. Branch per work unit group; push, PR and merge stay with the user.

## Tasks
- [x] M1 Scaffold bare RN 0.88 + TypeScript app, tooling (eslint, prettier, jest, tsc), hexagonal folders, runs on the emulator.
- [x] M2a Local database foundation: `op-sqlite`, a `SqlDatabase` port with an op-sqlite adapter and a `node:sqlite` adapter for Jest, versioned migrations (`PRAGMA user_version`), schema mirroring backend entities (tombstones, `updated_at`, sync state, outbox tables), domain entity types.
- [ ] M2b Repositories behind application ports: local-first mutations that write the row and enqueue the outbox entry in one transaction, reads that hide tombstones, `applyRemoteChanges` for pull that does not overwrite rows with pending outbox entries, ID generation.
- [ ] M3 API client and auth: register/login/refresh/logout, secure token storage, automatic refresh on 401.
- [ ] M4 Outbox and sync engine: pull with cursor, push with `change_id`, per-item results (402/409/conflict), retry with backoff, connectivity trigger.
- [ ] M5 Design seed (`DESIGN.md`) and core screens: auth, lists, tasks, task detail with subtasks and tags.
- [ ] M6 Timer (start/pause/complete with real timestamps) and local reminders (notifications).
- [ ] M7 Hardening: offline end-to-end scenarios on the emulator, accessibility pass, error and empty states. Also from the M1 review (non-blocking): the release build type is signed with the debug keystore (template default), so add a real release signing config read from untracked properties and make release fail without it; restrict cleartext HTTP in the manifest to debug builds; test dark mode in the App smoke test.
- [ ] M8 Plan (no code) the Linux and Windows desktop clients with Tauri after the mobile app: offline is mandatory, so decide local storage and sync engine, how much of `domain`/`application` is shared (shared package or monorepo), and where the project lives (likely the `planner/web` repo). Linux builds natively; Windows NSIS installers can be cross-built with `cargo-xwin` (needs `rustup` and the `x86_64-pc-windows-msvc` target; `.msi` only on Windows).

## Acceptance criteria
- App builds and launches on the emulator from a clean checkout.
- With airplane mode on, every screen works against local data; changes made offline appear on the server after reconnecting, exactly once.
- Register, login, token refresh and logout work against the real backend.

## Checks
- `tsc --noEmit`, eslint, jest per task. Android build via Gradle. Emulator verification for UI tasks.

## Progress
M1 done: bare RN 0.88.0 + TS scaffold at repo root, hexagonal `src/` layout, placeholder screen, runs on emulator-5554.
M2a done: `@op-engineering/op-sqlite` 18.2.5 (autolinked, no native edits), `SqlDatabase` port, op-sqlite and `node:sqlite` adapters sharing `BaseSqlDatabase` (FIFO queue, BEGIN/COMMIT, savepoints for nesting), `PRAGMA user_version` migration runner, schema v1 mirroring the backend sync schema (no `user_id`, no FKs, no server-only tables), domain types, row mappers, `initDatabase` called from App on mount.

## Verification evidence
- M1: `npm run typecheck` clean; `npm run lint` clean; `npm test` 1/1 pass (RED observed first: module missing). Gradle debug build + install OK; `mCurrentFocus` = app.planner.mobile/.MainActivity; no FATAL EXCEPTION; screenshot shows 'Planner' + tagline on light background. Needed `adb reverse tcp:8081 tcp:8081` and allowing a nearby-devices permission dialog.
- M2a: RED first (adapter, migration, schema, mapper, App tests failed on missing modules). `npm run typecheck` clean; `npm run lint` clean; `npm test` 6 suites, 37/37 pass. Gradle `app:installDebug` OK (op-sqlite built via autolinking); on emulator-5554 logcat shows `db ready (schema v1)` on first launch and again after force-stop relaunch, no FATAL EXCEPTION. The op-sqlite adapter itself is verified only through this migration run (BEGIN/COMMIT path); the shared contract suite runs against the Node adapter.

## Next step
M2b.
