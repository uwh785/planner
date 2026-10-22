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

Checks: `npm run typecheck`, `npm run lint`, `npm test`.

## Architecture

Source lives in `src/`; the `@/*` alias maps to `src/*`.

- `domain`: entities and rules, no framework imports.
- `application`: use cases and ports, depends only on domain.
- `infrastructure`: implements ports (SQLite, HTTP, secure storage, notifications).
  - `infrastructure/db`: op-sqlite adapter, ordered migrations (`PRAGMA user_version`; never edit a shipped one, add the next number), one database file per user (`planner_<userId>.db`). `NodeSqliteDatabase` (`node:sqlite`) is for Jest only.
  - `infrastructure/db/repositories`: SQLite implementations of the repository ports. Every mutation writes the row and its `outbox` entry in one transaction. `infrastructure/system` holds the id generator (needs `crypto.getRandomValues`, installed by `react-native-get-random-values` in `index.js`) and the clock.
  - `infrastructure/composition`: builds the container (database + repositories). Only `index.js` calls it.
- `presentation`: screens and atomic components, talks to application only; it never imports `infrastructure` (enforced by a Jest test). It receives the container through the `containers` prop of `App`.

### Local-first writes and the outbox

The UI only talks to the repositories. A create, update or delete changes the local row (deletes are tombstones: `deleted = 1`) and queues one `outbox` entry `{entity, op, entity_id, payload, change_id, origin}` in the same transaction; the sync engine (M4) drains it through `POST /api/sync/push`.

- `payload` is the snake_case `data` the backend decodes (full current body for upserts; `{task_id}` for a subtask delete; `{task_id, tag_id}` for task/tag links). Server-managed fields are never sent.
- A task/tag link has no id: its outbox `entity_id` is `<task_id>:<tag_id>`.
- Coalescing: at most one pending upsert per entity (updated in place, so its `id` ordering key and `change_id` stay). Deleting an entity created offline and never pushed (`origin = 'create'`) drops its entries and hard-deletes the row; deleting a known entity keeps a tombstone and one delete entry.
- Deletes mirror the backend: deleting a task leaves subtasks and links alone, deleting a tag tombstones its links locally (the server cascades). Deleting a list moves its tasks to "no list" (the backend would leave them pointing at a deleted list, which then fails to push).
- `applyRemoteChanges(pullResponse)` applies a `GET /api/sync` payload in one transaction and skips rows that have a pending outbox entry.

## Backend

Talks to the Planner backend (separate repository, `planner`) through `/api/auth/*` and `/api/sync*`. See `PRODUCT.md` for product context.
