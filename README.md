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
- `presentation`: screens and atomic components, talks to application only.

## Backend

Talks to the Planner backend (separate repository, `planner`) through `/api/auth/*` and `/api/sync*`. See `PRODUCT.md` for product context.
