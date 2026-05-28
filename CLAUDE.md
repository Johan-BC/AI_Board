# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

The app is a zero-build static site — no compilation step. Serve it with any HTTP server from the repo root:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

`file://` won't work because the app fetches `data.xlsx` via HTTP on startup.

For Playwright/automated testing, vendor copies of the CDN scripts are in `vendor/` (React, ReactDOM, Babel, SheetJS). Patch `index.html` to use `vendor/` paths before running headless:

```bash
sed -i 's|https://unpkg.com/react@.*\.js"[^>]*>|vendor/react.development.js">|g' index.html
# etc. for react-dom, babel, xlsx
```

Restore CDN URLs before committing (or regenerate `index.html` from source — see below).

## Architecture

**No build tool, no bundler.** React 18, Babel Standalone, and SheetJS are loaded from CDN at runtime. JSX is compiled in-browser by Babel.

### Two entry points

| File | Purpose |
|---|---|
| `index.html` | **Deployable single file** — all four source files inlined as one `<script type="text/babel">` block. Regenerate this whenever a source file changes (see below). |
| `project/AI Board.html` | Development entry — loads the four source files as separate `<script type="text/babel" src="...">` tags. Easier to edit; must be served from `project/`. |

### Source files (in `project/`)

```
design-canvas.jsx     Figma-like pan/zoom canvas wrapper (DesignCanvas, DCSection, DCArtboard)
app/data.jsx          Data constants + Excel parsing (parseWorkbook, parseExcelBuffer)
app/ui.jsx            Shared design tokens (UI object) + primitive components (UiTopBar, UiButton, UiDrawer…)
app/roadmap-tech.jsx  Main view: RoadmapTechView — Gantt roadmap + tech filter panel
```

Load order matters (globals only, no module imports): `design-canvas.jsx` → `data.jsx` → `ui.jsx` → `roadmap-tech.jsx`.

### Data flow

```
data.xlsx (server)
    └─ parseExcelBuffer()  →  store object
          │
          ├─ localStorage (STORE_KEY = 'aiboard:store:v3')  ← CRUD edits persisted here
          │
          └─ RoadmapTechView state  →  renders roadmap + tech panel
```

Priority on load: **localStorage → fetch data.xlsx → built-in seed constants** (defined in `data.jsx`).

The store shape: `{ platforms, statuses, technologies, initiatives, businessUnits }`. All arrays; `_byId(arr)` converts to id-keyed maps.

### Excel schema (`data.xlsx`)

Five sheets: **Business Units**, **Platforms**, **Technologies**, **Initiatives**, **Milestones**.

In the Initiatives sheet, the `Technologies` column holds comma-separated technology *names* (not IDs). The parser resolves them to IDs via a name→id lookup built from the Technologies sheet. Dates are stored as text strings (`YYYY-MM-DD`).

Regenerate `data.xlsx` from the seed data:

```bash
python3 create_excel.py
```

### Regenerating `index.html`

After editing any source file, regenerate the deployable bundle:

```python
python3 - <<'EOF'
with open('project/design-canvas.jsx') as f: dc = f.read()
with open('project/app/data.jsx') as f: data = f.read()
with open('project/app/ui.jsx') as f: ui = f.read()
with open('project/app/roadmap-tech.jsx') as f: rt = f.read()
# ... concatenate into index.html (see existing index.html structure)
EOF
```

## React hooks constraint

`RoadmapTechView` initialises `store` as `null` (loading state) and populates it asynchronously. **All hooks (`useState`, `useRef`, `useMemo`, `useEffect`) must be declared before any early return**, with null guards where needed:

```js
const range = React.useMemo(() => {
  if (!store) return { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) };
  // ...
}, [store]);

// Only after ALL hooks:
if (!store) return <LoadingScreen />;
```

Placing a hook after the early return causes a hooks-count mismatch between renders and crashes the app.

## Deployment

GitHub Pages: push to `main` and enable Pages (source: `main` / root). The live URL is `https://johan-bc.github.io/AI_Board/`. Place `data.xlsx` in the repo root for live Excel data; the app falls back to built-in seed data if the file is absent.
