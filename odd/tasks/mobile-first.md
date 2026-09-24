# Mobile-first adaptation

## Objective
Make the web UI mobile-first: base styles target phones (~375px), larger screens are layered with `min-width` media queries, touch targets are at least 44x44px, no hover-only interactions.

## Problem (baseline at 375x812, measured with Playwright)
- Top nav does not fit: links are cramped and the language button (`ES`) is clipped off-screen.
- 3 `max-width` media queries (`+layout.svelte`, `calendar/+page.svelte`, `dashboard/+page.svelte`); zero `min-width` queries.
- Touch targets under 44px: nav links (33px), lang button (32px), back/edit/delete/add/month buttons (36px), filter chips (34px), task card actions (34px), subtask checkbox (18px), subtask delete (24x16), subtask input (39px), form selects/buttons (41px), config lang toggle (43px).
- No horizontal page overflow on any route.

## Scope
- `web/src/routes/**/*.svelte`, `web/src/lib/components/*.svelte`, `web/src/app.css`.
- Navigation on mobile becomes a fixed bottom tab bar (icon + label, Lucide icons); from `min-width: 640px` the current top nav is shown.
- Out of scope: backend, new features, visual redesign beyond what mobile-first requires.

## Constraints
- Icons only from `@lucide/svelte`, never text glyphs.
- Keep existing CSS variables and visual language.
- TDD: not applicable (CSS/layout only, no frontend test runner). Verification is Playwright measurement + screenshots.
- Repository is not a git repo: work-unit commits are not possible (pending `git init` by the user).

## Tasks
- [x] T1 Mobile-first nav: bottom tab bar on mobile, top nav from 640px; content padding clears the tab bar and safe-area inset. (route: delegated writer)
- [x] T2 Convert all `max-width` media queries to mobile-first `min-width` queries. (route: delegated writer)
- [x] T3 Raise every interactive element to >= 44x44px hit area. (route: delegated writer)
- [x] T4 Verify in browser at 375px and 1280px: no overflow, zero targets < 44px, screenshots. (route: parent)

## Acceptance criteria
- `rg '@media[^{]*max-width' web/src` returns nothing.
- At 375px on dashboard, tasks, task detail, calendar, config, tasks/new: no horizontal overflow and no visible interactive element smaller than 44x44.
- At 1280px the layout still looks like the current desktop version.
- `npm run build` passes.

## Progress / evidence
- Baseline captured: `.playwright-mcp/before-375-*.png`.
- T1-T3 done by delegated writer (10 files). Parent follow-up: logo link and desktop nav links raised to 44px (tablets are touch devices too).
- `npm run build`: passes.
- `rg '@media[^{]*max-width' web/src`: no matches.
- Playwright on dashboard, tasks, task detail, calendar, config, tasks/new at 375, 768 and 1280: no horizontal overflow, zero interactive elements < 44x44.
- Screenshots: `.playwright-mcp/after-{375,1280}-*.png`, `after-768-calendar.png`.
- Commits: not possible (no git repo).

## Next step
- `git init` and commit this work; login page (`/`) was not measured (needs logged-out session).
