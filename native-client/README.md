# Planner mobile

Offline-first Android app (bare React Native, TypeScript) for the Planner backend. Local SQLite is the source of truth; changes sync with the backend when a connection returns.

## Setup

Prerequisites: Node >= 22.11, JDK 17+ (21 works), Android SDK with an emulator or device.

```sh
export ANDROID_HOME=$HOME/.local/android-sdk   # your SDK path
npm install
npm start            # Metro bundler
npm run android      # build, install and launch (second terminal)
```

On an emulator, if the app cannot reach Metro, run `adb reverse tcp:8081 tcp:8081`.

Auth screens (sign in, create account) gate the app: signed out shows them, a stored session restores offline straight into the signed-in home. The look lives in one module, `src/presentation/theme.ts`.

Checks: `npm run typecheck`, `npm run lint`, `npm test`.

## Architecture

Source lives in `src/`; the `@/*` alias maps to `src/*`.

- `domain`: entities and rules, no framework imports.
- `application`: use cases and ports, depends only on domain.
- `infrastructure`: implements ports (SQLite, HTTP, secure storage, notifications).
  - `infrastructure/db`: op-sqlite adapter, ordered migrations (`PRAGMA user_version`; never edit a shipped one, add the next number), one database file per user (`planner_<userId>.db`). `NodeSqliteDatabase` (`node:sqlite`) is for Jest only.
  - `infrastructure/db/repositories`: SQLite implementations of the repository ports. Every mutation writes the row and its `outbox` entry in one transaction. `infrastructure/system` holds the id generator (needs `crypto.getRandomValues`, installed by `react-native-get-random-values` in `index.js`) and the clock.
  - `infrastructure/composition`: `createAppServices` wires HTTP, the Keychain session and the per-user database; `createContainer` builds one user's repositories. Only `index.js` calls them.
  - `infrastructure/http`: `FetchHttpClient` (global `fetch`, JSON, timeout) and `HttpAuthGateway` (the backend's own `/api/auth/*`). `infrastructure/security`: `KeychainSessionStore` (`react-native-keychain`, Android Keystore-backed).
- `presentation`: screens and atomic components, talks to application only; it never imports `infrastructure` (enforced by a Jest test). `index.js` hands `App` the `SessionService` and the container source.

### Local-first writes and the outbox

The UI only talks to the repositories. A create, update or delete changes the local row (deletes are tombstones: `deleted = 1`) and queues one `outbox` entry `{entity, op, entity_id, payload, change_id, origin}` in the same transaction; the sync engine drains it through `POST /api/sync/push` (see Sync below).

- `payload` is the snake_case `data` the backend decodes (full current body for upserts; `{task_id}` for a subtask delete; `{task_id, tag_id}` for task/tag links). Server-managed fields are never sent.
- A task/tag link has no id: its outbox `entity_id` is `<task_id>:<tag_id>`.
- Coalescing: at most one pending upsert per entity (updated in place, so its `id` ordering key and `change_id` stay). Deleting an entity created offline and never pushed (`origin = 'create'`) drops its entries and hard-deletes the row; deleting a known entity keeps a tombstone and one delete entry.
- Deletes mirror the backend: deleting a task leaves subtasks and links alone, deleting a tag tombstones its links locally (the server cascades). Deleting a list moves its tasks to "no list" (the backend would leave them pointing at a deleted list, which then fails to push).
- `applyRemoteChanges(pullResponse)` applies a `GET /api/sync` payload in one transaction and skips rows that have an outbox entry (pending or parked).

## Sync

`application/sync` is framework-free; platform pieces sit behind ports (`Connectivity`, `AppLifecycle`, `Timer`, `ChangeNotifier`) with adapters in `infrastructure/sync` (NetInfo, AppState, setTimeout).

- `SyncEngine.sync()` is single flight (a call during a run shares it and asks for at most one follow-up). It pushes first, then pulls. Push sends pending outbox entries in id order, at most 200 per request, with their `change_id`; entries are removed only after the response, so a crash re-sends the same ids and the server answers `exists`. Per-item results: `applied`/`exists` clear the entry (so does a delete's `not_found`); an upsert's `not_found` (missing parent) is retried and parked as `blocked` after 5 attempts; `limit` parks as `blocked`; `conflict`/`invalid` park as `rejected` (message kept, local row kept); `error` or an unknown status retries with backoff. A network failure leaves the outbox untouched; a whole-batch 400 parks that batch as `rejected` once; a lost session pauses without backoff.
- Parked entries are never pushed automatically. Editing the entity revives its parked upsert as pending; deleting it drops a parked create or replaces a parked update with one delete; `retryParked()` is for a future attention screen. A pull never overwrites a row that has any outbox entry.
- Backoff is a pure function (2 s, 5 s, 15 s, 60 s, 5 min, then 15 min, +/-20% jitter). The engine exposes `nextRetryAt`; it owns no timers.
- `SyncStatus` (`getSnapshot`/`subscribe`): `idle | syncing | offline | error | paused` plus pending/blocked/rejected counts, `lastSyncAt`, `lastError`, `nextRetryAt`.
- `SyncScheduler` runs the engine on start, when connectivity returns, on foreground, 2 s after the last local change, every 5 min while on screen and when `nextRetryAt` arrives; never while offline or paused. `SyncCoordinator` builds one engine and scheduler per signed-in user from the session state, tears them down on sign-out, expiry or user switch, and is the status source for the UI (`useSyncStatus`, one polite status line on the home). `index.js` calls `services.sync.start()`.
- Local writes notify the scheduler after commit: the repositories write through `NotifyingDatabase`, which fires `ChangeNotifier` after each top-level transaction.
- Dev only: `runSyncSmoke` registers a throwaway user, works offline, syncs, checks the server through the real API and pulls server-side changes, logging `sync smoke ok`; the home shows an "Add sample task (dev)" button.
- Backend note: sync push needs the planner backend at commit `b93f832` or later on `feat/offline-sync-schema`; earlier commits had the handler but never mounted `POST /api/sync/push` (it answered 404).

## Auth and session

Auth is the backend's own: `register`, `login`, `refresh`, `logout` under `/api/auth/*`. The device keeps one session (user identity, access token, refresh token) as a single JSON entry in the Android Keystore-backed Keychain.

- `restoreSession` reads it with no network, so the app opens offline, on that user's own database `planner_<userId>.db`.
- `AuthenticatedHttp` adds the bearer token. On a 401 it refreshes once (concurrent 401s share one refresh), saves the rotated refresh token before retrying, then retries the request once. If the server refuses the refresh, the tokens are cleared, the identity is kept and `SessionExpiredError` is raised; the local database and outbox stay. A network failure during refresh keeps the session.
- `logout` calls the server best-effort (short timeout) and always clears the Keychain; it never deletes the local database or the outbox.
- Switching user or logging out closes the previous database handle (`UserContainers`).
- A refresh that finishes after logout (or after another user signed in) is discarded: `SessionEpoch` is bumped by logout and sign-in, a refresh checks it before persisting, and the original request fails with `SignedOutError`.
- `KeychainSessionStore.get()` returns `null` only when nothing usable is stored. A Keystore failure throws `SessionStoreUnreadableError`; the session state becomes `unreadable` and the UI offers a retry instead of a sign-in form (a corrupt entry is logged by reason code and left in place).
- `SessionService.state()` / `subscribe()` expose the UI state: `restoring`, `unreadable`, `signedOut`, `expired` (identity kept, tokens refused) and `signedIn`. `bootstrapApp` builds the services without throwing; a misconfigured build (e.g. release without `RELEASE_API_BASE_URL`) shows a plain startup error screen.
- In development, `runAuthSmoke` (`devAuthSmoke.ts`, started from `index.js`) runs register, authenticated call, forced refresh and logout against the real backend using its own Keychain entry and throwaway database, and logs `auth smoke ok`.

## Design

The visual system is written up in [`DESIGN.md`](DESIGN.md) (Stitch format; `DESIGN.json` is its sidecar). It reuses the web app's iOS system palette, with a few darker light-mode values so every text pairing meets WCAG AA. The tokens (colors per scheme, spacing, radii, type scale, 48dp touch size) live in `src/presentation/theme.ts`, and `__tests__/presentation/theme.test.ts` asserts the contrast of every pairing. Components read tokens only from that module.

## Configuration

The API origin is chosen in `src/infrastructure/config/apiConfig.ts`:

- Debug (`__DEV__`): `http://10.0.2.2:8080`, the Android emulator's alias for the host. Start the backend with `JWT_SECRET=... go run ./cmd/server` from the repository's `backend/` directory. On a physical device use `adb reverse tcp:8080 tcp:8080` and change `DEV_API_BASE_URL`.
- Release: set `RELEASE_API_BASE_URL` (an `https://` origin) before building. It is `null` by default and a release build refuses to start without it; it never falls back to the dev URL.
- Cleartext HTTP is allowed in debug builds only: React Native's Gradle plugin sets the `usesCleartextTraffic` manifest placeholder to `true` for debug and `false` for release (checked in the merged release manifest).

## Backend

Talks to the Planner backend (the sibling `backend/` directory of this repository) through `/api/auth/*` and `/api/sync*`. See `PRODUCT.md` for product context.
