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
- [x] M2b Repositories behind application ports: local-first mutations that write the row and enqueue the outbox entry in one transaction, reads that hide tombstones, `applyRemoteChanges` for pull that does not overwrite rows with pending outbox entries, ID generation.
- [x] M3a API client and session (uses the backend's own auth endpoints, no separate auth system): HTTP client port with a fetch adapter, auth gateway for register/login/refresh/logout, secure token storage in the Android Keystore, session use cases (register, login, logout, restore) and single-flight automatic refresh on 401, per-user container wiring. Verified against the real backend from the emulator.
- [ ] M3b Auth screens: minimal accessible login and register forms and session gating (signed out vs signed in); real visual design lands in M5.
- [ ] M4 Outbox and sync engine: pull with cursor, push with `change_id`, per-item results (402/409/conflict), retry with backoff, connectivity trigger.
- [ ] M5 Design seed (`DESIGN.md`) and core screens: auth, lists, tasks, task detail with subtasks and tags.
- [ ] M6 Timer (start/pause/complete with real timestamps) and local reminders (notifications).
- [ ] M7 Hardening: offline end-to-end scenarios on the emulator, accessibility pass, error and empty states. Also from the M1 review (non-blocking): the release build type is signed with the debug keystore (template default), so add a real release signing config read from untracked properties and make release fail without it; test dark mode in the App smoke test.
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

M2b done: application ports (repositories, outbox, sync state, id generator, clock, `ApplyRemoteChanges`), SQLite repositories where each mutation writes the row and its outbox entry in one transaction with coalescing (migration 002 adds `outbox.origin`: `create` = never pushed), `applyRemoteChanges` (one transaction, skips rows with pending entries, tolerant parser), `RandomIdGenerator` over `crypto.getRandomValues` (`react-native-get-random-values` imported once in `index.js`), composition root `createContainer` + `ContainerManager` (ref-counted, serialized open/close) with presentation receiving the container by prop/context and no infrastructure import. Deletes mirror the backend (task: no cascade; tag: links tombstoned locally; list: tasks detached, a deliberate deviation so tasks stay pushable).

M3a done: `react-native-keychain` 10.0.0 (autolinked), ports `HttpClient`/`SessionStore`/`AuthGateway`, session types in `domain/auth`, typed errors, use cases `register`/`login`/`logout`/`restoreSession`, `AuthenticatedHttp` (single-flight refresh, rotated token persisted before the retry), `SessionService`, `UserContainers` (per-user database, closes the old handle on switch or logout, FIFO acquire/release pairing), `FetchHttpClient`, `HttpAuthGateway`, `KeychainSessionStore`, `apiConfig` (dev `http://10.0.2.2:8080`, release URL must be set and HTTPS), `createAppServices`, dev-only `runAuthSmoke`. Cleartext HTTP was already debug-only through React Native's Gradle plugin placeholder (the merged release manifest shows `false`). The old `planner_local.db` from M2b is no longer opened. `index.js` repo smoke note (reserved `devsmoke` name) is still open.

## Verification evidence
- M1: `npm run typecheck` clean; `npm run lint` clean; `npm test` 1/1 pass (RED observed first: module missing). Gradle debug build + install OK; `mCurrentFocus` = app.planner.mobile/.MainActivity; no FATAL EXCEPTION; screenshot shows 'Planner' + tagline on light background. Needed `adb reverse tcp:8081 tcp:8081` and allowing a nearby-devices permission dialog.
- M2a: RED first (adapter, migration, schema, mapper, App tests failed on missing modules). `npm run typecheck` clean; `npm run lint` clean; `npm test` 6 suites, 37/37 pass. Gradle `app:installDebug` OK (op-sqlite built via autolinking); on emulator-5554 logcat shows `db ready (schema v1)` on first launch and again after force-stop relaunch, no FATAL EXCEPTION. The op-sqlite adapter itself is verified only through this migration run (BEGIN/COMMIT path); the shared contract suite runs against the Node adapter.
- M2b: RED first (14 suites failed on missing modules; boundary test failed on App importing infrastructure). `npm run typecheck` clean; `npm run lint` clean; `npm test` 20 suites, 169/169 pass. Gradle `app:installDebug` OK; on emulator-5554 logcat shows `db ready (schema v2)` (v1 database upgraded by migration 002) and `repo smoke ok (outbox=2)` on first launch and again after force-stop relaunch, device ids like `lst_e95256b539c37e51` / `tsk_46adca56c77ec037` match `<prefix>_<16 hex>`, no FATAL EXCEPTION, `mCurrentFocus` = app.planner.mobile/.MainActivity. Hermes has no `crypto.getRandomValues` in RN's JS sources, so `react-native-get-random-values` 2.0.0 (autolinked TurboModule) provides it.
- M3a: RED first (8 suites failed on missing modules). `npm run typecheck` clean; `npm run lint` clean; `npm test` 29 suites, 224/224 pass. Gradle `app:installDebug` OK (react-native-keychain autolinked); `processReleaseManifest` shows `usesCleartextTraffic="false"` for release, `true` for debug. Against the real backend (go run, port 8080, via 10.0.2.2) on emulator-5554, logcat shows `register ok`, `user database ok`, `authenticated call status=200`, `forced refresh ok status=200`, `session persisted in keychain`, `logout ok (local data kept)` and `auth smoke ok` on first launch and again after force-stop relaunch; the relaunch logs `restore at start: found relaunch-probe` (the Keychain entry survived the process restart); no FATAL EXCEPTION; `mCurrentFocus` = app.planner.mobile/.MainActivity. Smoke users and refresh tokens were deleted from the dev database and the backend, Metro and the Gradle daemon were stopped.

## Review follow-ups (non-blocking)
M2b was reviewed as three native candidates (one commit exceeded the reviewer budget and was split into four: `d40bdd2`, `bae6bd0`, `5cca6c0`, `62ed0c9`). All approved. Open advisories:
- `index.js`: the dev repo smoke deletes rows in the `devsmoke` database file; scope it so it can never collide with a real user id (reserve the name or use a path no user id can produce), and give it a test.
- Add a ContainerManager-backed test for a late-resolving acquire after unmount (React StrictMode double effect), so leak safety is proved at the integration level.
- Add direct unit tests for the `normalize*` validators in `src/domain/validation.ts`.
- Backend (planner repo): `DeleteTaskList` leaves tasks pointing at a tombstoned list and `pushUpsert` then rejects later edits of those tasks; the client detaches tasks locally as a workaround.

## Next step
M3b: auth screens and session gating.
