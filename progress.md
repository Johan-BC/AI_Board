# AI Board — Progress

## What this is

A React-based AI initiative board for a Danish telecom/enterprise context. It renders a
Gantt-style timeline with BU swim lanes, technology/blocker/outcome filter strips, and a
CRUD drawer — a single-page app with no build step. Data lives in `data.json`, synced to
GitHub so the board is shared rather than per-browser.

- **Live:** https://johan-bc.github.io/AI_Board/
- **Local dev:** any static file server, e.g. `npx serve .` or `python -m http.server 8080`
  (see `.claude/launch.json`, gitignored/local-only) → `index.html`

---

## Architecture

### Entry point
[`index.html`](index.html) at the project root is the **single** entry point. It pulls React,
ReactDOM and Babel standalone from unpkg, then loads the app files in dependency order:

```
config.js → data.jsx → sync.jsx → ui.jsx → import.jsx → ideas.jsx → tech-view.jsx → board.jsx
```

They are **not** loaded via static `<script src>` tags — a small inline loader
`document.write`s each `<script type="text/babel" src="...?v=<timestamp>">` at parse time,
generating a fresh cache-busting query on every page load. This means the app JS is never
stale after a deploy — no manual version bump, no "clear your cache" instructions needed.
`index.html` itself still carries `no-cache` meta tags, but since GitHub Pages doesn't
support real no-cache headers, the HTML shell can still be served stale from a browser's
HTTP cache for up to its `max-age` (GitHub Pages default: 10 min) after a deploy — that
self-resolves without action once the cache entry expires.

> **If a browser shows a very old version even after a hard reload** (Ctrl+Shift+R) and a
> cache-busted URL, the HTTP cache isn't the cause — check DevTools → Application → Storage →
> **"Clear site data"**, and Application → Service Workers for a stray registration. This
> project has never shipped a service worker, but a leftover one (or Cache Storage entry)
> from an earlier experiment can survive normal cache-clearing and pin an old build
> indefinitely. Confirmed fix in practice 2026-09-30.

### Modules (`project/app/`)

| File | Lines | Responsibility |
|---|---|---|
| [`data.jsx`](project/app/data.jsx) | ~299 | Seed constants, `makeStore`, `parseJSON`, migrations, synergy map |
| [`sync.jsx`](project/app/sync.jsx) | ~180 | Repo config, GitHub Contents API, three-way merge, commit messages |
| [`ui.jsx`](project/app/ui.jsx) | ~1167 | Design tokens (`UI`), primitives, initiative drawer, catalogue drawer, portfolio view |
| [`import.jsx`](project/app/import.jsx) | ~767 | Excel import with a per-row review/validation UI |
| [`ideas.jsx`](project/app/ideas.jsx) | ~281 | "Idéer og boblere" view for `idea`-status initiatives, with click-to-multi-select tech/outcome trend filters |
| [`tech-view.jsx`](project/app/tech-view.jsx) | ~210 | "Teknologi" view — initiatives using one technology (dropdown, default Claude), with assessment columns, score sorting and manual priority (↑↓) |
| [`board.jsx`](project/app/board.jsx) | ~1793 | `BoardView`, filter strips, layout/synergy logic, drag handling, save/poll loop |

### Data persistence & multi-editor sync ([`sync.jsx`](project/app/sync.jsx))
- **Single store:** `data.json` in the GitHub repo. The browser never keeps a copy of the
  board (the old `aiboard:store:v4` localStorage cache is no longer read), so an edit can't
  end up saved in one browser only.
- **Viewers (no token):** read the published `data.json` next to `index.html`, view-only,
  re-read every 60 s. "Ny", Import, bar dragging and every save open the connect prompt.
- **Editors:** fine-grained PAT (Contents R/W on this repo) in localStorage under
  `aiboard:github-pat`. Each editor uses their own token, so every commit is authored by
  that person and git history is the audit log. Commit messages name the initiatives
  touched (`board: AI-Mail, + New initiative`).
- **Save:** 3 s debounce (flushed immediately when the tab is hidden; closing the tab with
  unsaved edits warns). On a SHA conflict (someone else saved first) the board re-reads
  GitHub and does a **three-way merge** (`merge3(base, local, remote)`), then retries:
  field-level per initiative/catalogue item (matched by `id`), id-lists (`techIds` …)
  merged as sets, an edit beats a concurrent delete, and only a true same-field clash
  resolves to "last saver wins".
- **Drawer saves** apply only the fields changed in the drawer (merged against the
  initiative as it was when opened), so a colleague's change to another field isn't reverted.
- **Polling:** editors re-read GitHub every 30 s (and on tab focus) and merge others'
  changes into their view.
- **Failures:** a failed save keeps the edits in memory and shows "Ikke gemt · ↺ Prøv igen";
  a failed load shows the published copy view-only with retry / change token.
- **Reset to seed** was removed — on a shared board it wiped everyone's work in one click.

### Link mode — editors without GitHub accounts
Set `dataRepo` in [`config.js`](config.js) to a private repo holding `data.json`. Then:
- The board repo holds only code; with no link the board shows "Du skal bruge dit link"
  (no seed/demo data).
- **View link** `…/#view=<read-only token>` — reads through the API, polls every 30 s, can't edit.
- **Edit link** `…/#edit=<read/write token>` — full editing; the first visit asks for a name
  (`aiboard:editor-name`), which goes into every commit message: `board (Mette): AI-Mail`.
- The token in the fragment is never sent to a server; `takeLinkToken()` stores it
  (`aiboard:github-pat` + `aiboard:access-mode`) and strips it from the address bar.
- Expired/revoked link → "Dit link virker ikke længere"; `contact` in config names who to ask.
- Both tokens are fine-grained, scoped to the data repo only, so a leaked link can at worst
  change data (recoverable from history), never the board code.

### Admin overview ([`overblik.html`](overblik.html))
Not linked from the board; for the admin only. Builds the view/edit links from tokens
pasted in (kept in that browser's localStorage, never in the repo), checks each token and
shows its expiry, lists the last 10 changes, links to history/data/repos/Pages/token
settings with a description of each, and holds the setup and recovery guides.

### Repo config ([`config.js`](config.js))
`repo` (board repo), `dataRepo` (link mode), `branch`, `file`, `contact`, `apiBase`,
optional `pollMs`. A blank `repo` is auto-detected from an `<owner>.github.io/<repo>/` URL;
set it explicitly for private Pages (`*.pages.github.io`), custom domains, or GitHub
Enterprise Server (`apiBase: 'https://github.company.com/api/v3'`).

Without `dataRepo`, `data.json` sits next to the board (public), and editors paste their own
fine-grained PAT. That needs org membership — see the earlier notes on token approval/SSO.

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

Current `data.json`: 4 business units, 17 departments, 11 platforms, 12 technologies,
11 blockers, 15 outcomes, 38 initiatives (16 of them `idea`-status).

### Board layout (swim-lane hierarchy)
```
BU (swim lane)
  ├─ Ungrouped (0 depts + 0/2+ platforms, OR 2+ depts)
  ├─ Department headers (1 dept → grouped here, platform chips on the bar)
  └─ Platform headers (0 depts + 1 platform → grouped here)
```
Row kinds: `'bu'` · `'department'` · `'platform'` · `'init'`

### Collapsing a BU lane
The chevron on a BU header folds the whole lane away. `layout` pushes the `'bu'` row and
then `continue`s, so a collapsed lane contributes **only** its header — every downstream
memo (`buBands`, `platformSpans`, `connectorBars`, synergy bands, the bar renderer) reads
`layout.rows`, so nothing else needs to know about collapsing.

- State lives in `collapsedBUs` (a `Set` of BU ids), persisted to
  `localStorage['aiboard:collapsed-bus']` — it's a **view preference**, deliberately kept
  out of the store so it never travels to `data.json` / GitHub
- The collapsed lane still renders a hatched **roll-up bar** spanning min(start) →
  max(end) of its initiatives (BAU fade when any of them is ongoing), labelled
  `N initiativer`; clicking it expands the lane
- When a tech/blocker/outcome filter is active, a collapsed header shows a `⌕N` badge
  counting the matches hidden inside — otherwise a filter hit inside a folded lane would
  silently vanish. `highlightSet` mirrors `getBarStyle`'s precedence
  (blockers → outcomes → techs); keep the two in step

---

## Features

### Views
- **Gantt** — swim lanes, draggable bars (move + resize), milestone diamonds, today line,
  BAU bars for initiatives with no end date
- **Portfolio** — outcome/value pillar view
- **Teknologi** — all initiatives (any status) that use a chosen technology (dropdown, default
  Claude). Columns for the five assessment criteria; click 01 Værdi or 05 TTV to sort (desc
  first, unscored last). Priority is manual: ↑↓ moves an initiative within the technology's
  list, only active in priority order. Clicking a name opens the drawer. The assessment columns
  are edited inline: click score dots, click a note to edit (saves on blur, Esc cancels), click
  the governance mark to toggle it.
- **Idéer og boblere** — `idea`-status initiatives, kept out of the Gantt. Sidebar lists
  technology and outcome trends with counts; click one or more to toggle them into a filter
  (OR within a group — e.g. two technologies — AND across groups — tech + outcome combined),
  with a "Ryd" control to clear. Replaced an earlier hover-to-highlight-one interaction.
- **Import** — drag-and-drop or file-pick *any* `.xlsx`/`.xls`, parsed client-side via SheetJS
  (loaded from CDN in `index.html`), with per-row validation before committing. There is no
  checked-in spreadsheet — the file always comes from the user.

### Initiative assessment (`assessment`)
Optional object on each initiative, edited in the drawer's "Vurdering" section. Missing fields
read as unscored/empty, so no migration is needed.

```js
assessment: {
  value:     { score: 1-5 | null, comments: [] },  // 01 Værdipotentiale — gevinst + rækkevidde
  ownership: { comments: [] },                      // 02 Navngiven ejer + proces-/rolleændringer
  strategy:  { comments: [] },                      // 03 Strategisk betydning
  readiness: { ready: bool, comments: [] },         // 04 Data/tech/governance (ready = governance-klar)
  ttv:       { score: 1-5 | null, comments: [] },   // 05 Time-to-value + skalerbarhed
  // comment = { id, text, at: 'YYYY-MM-DD' }. A legacy single `note` string reads as one comment.
  rank: number | null                       // global priority, 1 = highest
}
```

`rank` is global across all initiatives, so an initiative keeps one position regardless of which
technology view shows it. Reordering in a view swaps the global positions of the two neighbours.
The first reorder writes `rank` to every initiative (1..N), so that save touches the whole list.

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
- Collapsible BU lanes (chevron on the BU header) with a roll-up bar per collapsed lane
- Status filter chips (POC / Pilot / Prod; `idea` lives in the Ideas view)
- BU filter dropdown + per-lane filter
- Zoom S / M / L (0.75× / 1× / 1.5×)
- Technology, blocker and outcome filter strips with counts and synergy dots
- Synergy band + dashed SVG connectors when a selection spans 2+ BUs
- Blocker mode dimming non-blocked initiatives

### Editing
- **Initiative drawer** — Name → BU → Afdelinger → Platforme → Status → Owner →
  Start/End → Description → Technologies → Blockers → Outcomes → Milepæle → Vurdering (folded
  by default). The Tags field was removed from the UI; the `tags` key remains in the data.
  BU, Afdelinger and Platforme show only the selected value(s) as chips; "Skift ▾" / "+ Tilføj ▾"
  folds out the full option list (single select for BU, multi for the other two).
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

1. Change code → commit → push to `main`
2. GitHub Pages updates automatically (~1 min) — no manual cache-buster bump needed;
   see the loader note under **Entry point** above
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
