# AI Board — Progress

## What this is

A React-based AI initiative board for a Danish telecom/enterprise context. It renders a Gantt-style timeline with BU swim lanes, technology/blocker filter strips, and a CRUD drawer — all in a single-page HTML app with no build step.

---

## What has been accomplished

### Architecture
- **Refactored** from a single monolithic `project/board.html` (minified, everything inline) into a clean three-file module structure under `project/app/`:
  - [`app/data.jsx`](project/app/data.jsx) — seed data, Excel parsing, store helpers
  - [`app/ui.jsx`](project/app/ui.jsx) — shared design tokens (`UI`) and primitive components (`UiTopBar`, `UiButton`, `UiStatusPill`, `UiInitiativeDrawer`, etc.)
  - [`app/board.jsx`](project/app/board.jsx) — main `BoardView` component, `FilterStrip`, layout/synergy logic, drag handling
- [`index.html`](index.html) at the project root loads the three files in order via Babel standalone (no build tool needed)
- The original [`project/board.html`](project/board.html) still exists as a self-contained minified single-file version (used as reference / standalone fallback)

### Features implemented (both versions)
- **BU swim lanes** — Marketing, Cust. Ops, Digital & Data, each with color-coded accent stripes
- **Gantt bars** — draggable (move + resize left/right), with milestone diamonds overlaid
- **Status filtering** — Idea / POC / Pilot / Live chip buttons in top bar
- **BU filtering** — dropdown + per-lane filter button
- **Zoom levels** — S / M / L (0.75×, 1×, 1.5×)
- **Today line** — prominent vertical marker with "I dag" label
- **Technology filter strip** — clickable chips with synergy dot indicators (2+ BUs sharing a tech)
- **Blocker filter strip** — red-styled chips for cross-BU blocker visibility
- **Synergy band** — when one tech/blocker is selected and spans 2+ BUs, a highlighted band + dashed SVG connector lines appear
- **Blocker mode** — toggle that dims all non-blocked initiatives
- **Initiative drawer** — slide-in panel to create/edit/delete initiatives (name, BU, status, owner, dates, description, tags, technologies, blockers, milestones)
- **Excel import** — drag-and-drop or file picker for `.xlsx`; parses `Business_Units`, `Technologies`, `Blockers`, `Initiatives`, `Milestones` sheets
- **Auto-fallback chain** — tries `./data.xlsx` → `../data.xlsx` → built-in seed data
- **localStorage persistence** — edits survive page reload; source indicator in top bar
- **Data source indicator** — color-coded dot showing whether data came from Excel, session, or seed

### Data model
- 3 business units, 8 technologies (4 categories), 8 blockers (3 categories), 12 seed initiatives
- Initiatives carry: `techIds[]`, `blockerIds[]`, `milestones[]`, status, owner, tags, description

---

## Current state

| Item | Status |
|------|--------|
| `index.html` (modular entry point) | Done |
| `app/data.jsx` | Done |
| `app/ui.jsx` | Done |
| `app/board.jsx` | Done |
| `project/board.html` (monolithic standalone) | Done (kept as reference) |
| `data.xlsx` (seed Excel file) | Present |
| `create_excel.py` (script to regenerate xlsx) | Present |

The app is fully functional. Both entry points (`index.html` and `project/board.html`) render the same board.

---

## Known gaps / next steps

1. **`today` is hardcoded** to `new Date(2026, 4, 26)` — should use `new Date()` for production use.
2. **No export** — there is no way to export edits back to Excel; edits live only in localStorage.
3. **No dark mode** — design tokens support it architecturally but the toggle is not wired up.
4. **Mobile / responsive** — the board is desktop-only; no responsive layout for narrow viewports.
5. **No BU/Tech/Blocker CRUD** — users can edit initiatives but cannot add/rename/remove business units, technologies, or blockers in-app.
6. **`create_excel.py`** — unclear if this is kept in sync with the current seed data in `data.jsx`.
7. **Babel standalone** — fine for prototyping; a build step (Vite/esbuild) would remove the runtime compile cost and enable TypeScript if desired.
