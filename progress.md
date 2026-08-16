# AI Board — Progress

## What this is

A React-based AI initiative board for a Danish telecom/enterprise context. It renders a
Gantt-style timeline with BU swim lanes, technology/blocker/outcome filter strips, and a
CRUD drawer — a single-page app with no build step. Data lives in `data.json`, synced to
GitHub so the board is shared rather than per-browser.

- **Live:** https://johan-bc.github.io/AI_Board/
- **Local dev:** `python -m http.server 8082` (see `.claude/launch.json`) → `index.html`

---

## Architecture

### Entry point
[`index.html`](index.html) at the project root is the **single** entry point. It pulls React,
ReactDOM and Babel standalone from unpkg, then loads the app files in dependency order:

```
data.jsx → ui.jsx → import.jsx → ideas.jsx → board.jsx
```

Each is tagged with a `?v=N` cache-buster; `index.html` itself carries `no-cache` meta tags
so a bumped `?v=` actually takes effect on the next load. **Bump `?v=N` on every JS change.**

### Modules (`project/app/`)

| File | Lines | Responsibility |
|---|---|---|
| [`data.jsx`](project/app/data.jsx) | ~266 | Seed constants, `makeStore`, `parseJSON`, migrations, synergy map |
| [`ui.jsx`](project/app/ui.jsx) | ~1149 | Design tokens (`UI`), primitives, initiative drawer, catalogue drawer, portfolio view |
| [`import.jsx`](project/app/import.jsx) | ~766 | Excel import with a per-row review/validation UI |
| [`ideas.jsx`](project/app/ideas.jsx) | ~236 | "Idéer og boblere" view for `idea`-status initiatives |
| [`board.jsx`](project/app/board.jsx) | ~1670 | `BoardView`, filter strips, layout/synergy logic, drag handling, GitHub sync |

### Data persistence
- **Source of truth:** `data.json` in the GitHub repo, read/written via the GitHub API
- **Load order:** localStorage (`aiboard:store:v4`) → `data.json` → built-in seed
- **Auto-save:** localStorage after 200 ms, GitHub commit after a 3 s debounce
- **Auth:** fine-grained PAT (Contents R/W) in localStorage under `aiboard:github-pat`
- Without a PAT the board still runs read-only from `data.json` / seed ("Brug lokalt")

### Migrations
`migrateStore()` (localStorage path) and `parseJSON()` (data.json path) both normalise
older stores:
- `platformId` (string) → `platformIds: []`
- adds `departmentIds: []` when missing
- **`migrateLiveToProd()`** — renames the legacy `live` status → `prod` in both the statuses
  catalogue and on initiatives

---

## Data model

```js
// Initiative
{
  id, buId, platformIds: [], departmentIds: [],
  name, status, owner, description, tags: [],
  techIds: [], blockerIds: [], outcomeIds: [],
  start, end, milestones: [{ date, label }]
}
```

- **Platforms** are global (no `buId`) — shared across BUs
- **Departments** are BU-scoped (`buId`) — filtered to the selected BU in the drawer
- **Statuses:** `idea` · `poc` · `pilot` · `prod` (`prod` was formerly `live`)

Current `data.json`: 1 business unit, 13 departments, 8 platforms, 9 technologies,
9 blockers, 13 outcomes, 14 initiatives.

### Board layout (swim-lane hierarchy)
```
BU (swim lane)
  ├─ Ungrouped (0 depts + 0/2+ platforms, OR 2+ depts)
  ├─ Department headers (1 dept → grouped here, platform chips on the bar)
  └─ Platform headers (0 depts + 1 platform → grouped here)
```
Row kinds: `'bu'` · `'department'` · `'platform'` · `'init'`

---

## Features

### Views
- **Gantt** — swim lanes, draggable bars (move + resize), milestone diamonds, today line,
  BAU bars for initiatives with no end date
- **Portfolio** — outcome/value pillar view
- **Idéer og boblere** — `idea`-status initiatives, kept out of the Gantt
- **Import** — drag-and-drop or file-pick *any* `.xlsx`/`.xls`, parsed client-side via SheetJS
  (loaded from CDN in `index.html`), with per-row validation before committing. There is no
  checked-in spreadsheet — the file always comes from the user.

### BAU / ongoing initiatives
An initiative with **no end date** is "løbende / BAU" — it runs indefinitely rather than
finishing on a date. Both `end: null` and `end: ''` count as BAU (the code tests `!i.end`).

How it renders on the Gantt:
- the bar runs to the **end of the timeline** and fades out via a CSS mask, so it never
  appears to stop on a particular date
- the right corner is squared (no border-radius) so the edge doesn't read as an ending
- a `BAU ▶` badge is `position: sticky` against the right edge of the scroller, so the cue
  stays visible at any horizontal scroll position
- the **right resize handle is removed** — dragging it would silently convert BAU into a
  fixed end date
- `paddingRight` tracks the fade width (`fadeW + 14`) to keep the tech/outcome chips clear
  of both the fade and the badge

Setting it: leave End empty in the drawer, or write `BAU` (also `løbende` / `ongoing` /
`N/A` / `-`) in the end-date column of an imported spreadsheet.

### Board
- Status filter chips (POC / Pilot / Prod; `idea` lives in the Ideas view)
- BU filter dropdown + per-lane filter
- Zoom S / M / L (0.75× / 1× / 1.5×)
- Technology, blocker and outcome filter strips with counts and synergy dots
- Synergy band + dashed SVG connectors when a selection spans 2+ BUs
- Blocker mode dimming non-blocked initiatives

### Editing
- **Initiative drawer** — Name → BU → Afdelinger → Platforme → Status → Owner →
  Start/End → Description → Tags → Technologies → Blockers → Outcomes → Milepæle
- **Catalogue drawer** — full CRUD across tabs: BUs · Afdelinger · Platforme ·
  Technologies · Blockers · Outcomes, with auto colour assignment and a hue picker
- **Download JSON** — export the board as `data.json`
- **Reset** — restore seed data

---

## Conventions / gotchas

- **Status lookup:** always `resolveStatus(status, store.statuses)`. Never
  `STATUSES.find(...) || STATUSES[0]` — that silently relabels unknown statuses as "Idea".
- **React closures:** never call `patch()` twice in one event; use a functional update:
  ```js
  setD(prev => ({ ...prev, buId: v, platformId: null }));
  ```
- `saveInit` clears `statusFilter`/`buFilter` when `d._new === true`, so new initiatives are
  always visible after saving
- `delBU` clears attached departments and resets `departmentIds: []` on initiatives
- `platformSpans` and `buBands` must include `'department'` in their kind filters
- **`range` excludes BAU end dates** — the timeline range is computed from real start/end
  values only, so a BAU bar's visual end follows `timelineW`, not a date
- **Date parsing is deliberately strict:** `xlDate` accepts a known set of "no date" words
  (blank, `N/A`, `-`, `BAU`, `løbende`, `ongoing`) and still flags anything else it can't
  parse. Don't widen it to a catch-all — that would swallow genuine typos in imports.

---

## Deployment

1. Change code → bump `?v=N` in `index.html` → commit → push to `main`
2. GitHub Pages updates automatically (~1 min)
3. Clients with a PAT sync board data through `data.json`

---

## Known gaps / next steps

1. **No dark mode** — design tokens support it architecturally, but no toggle is wired up.
2. **Desktop only** — no responsive layout for narrow viewports.
3. **Babel standalone** — fine for prototyping; a build step (Vite/esbuild) would remove the
   runtime compile cost and enable TypeScript.
4. **Outcome tracking** (planned, not implemented) — per-initiative
   `outcome: { metric, unit, baseline, target, targetDate, measurements: [] }`, progress
   calculation with on-track / at-risk / achieved colouring, a `UiProgressRing` on the Gantt
   bar, and a drawer section after Milepæle.
