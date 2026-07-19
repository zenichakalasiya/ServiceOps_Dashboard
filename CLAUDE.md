# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A runnable **Vue 3 + Vite** prototype of the revamped **ServiceOps Dashboards** experience — the
working demo shown to management. **Front-end only: mock data, no backend, no persistence** (state
resets on every page refresh). Every action fires a toast so the behavior is observable in a demo.

This repo is **published publicly** and auto-deploys to GitHub Pages. It is the *only* part of the
larger analysis workspace that is public — the planning docs, the limitations register, and
credentials live in the parent workspace **outside this folder** and must never be copied in here.

## Commands

```bash
npm install
npm run dev        # http://localhost:5180 (Vite; host:true so it's reachable on the LAN)
npm run build      # → dist/
npm run preview    # serve the built bundle on :5180
npx playwright test               # e2e (chromium only, configured in playwright.config.js)
npx playwright test tests/foo.spec.js         # a single file
npx playwright test -g "some title"           # a single test by title
npx playwright test --ui                      # interactive runner
```

There is **no lint step and no unit-test suite** — don't invent one. Playwright was added for e2e
only; the app itself has no in-repo assertions.

**Deploy:** commit + push to `main` → GitHub Actions rebuilds → live at
`https://zenichakalasiya.github.io/ServiceOps_Dashboard/`. Vite `base` is `/ServiceOps_Dashboard/`,
so all asset paths assume that prefix — never hardcode a root-absolute `/foo` URL.

## Architecture — the big picture

**One reactive store is the whole backend.** `src/store/index.js` exports a single `reactive()`
`store` object (dashboards, folders, tile `library`, modules, `ui` flags, global `timeFilter` /
`autoRefresh`) plus *all* mutations as plain exported functions (`createDashboard`, `cloneDashboard`,
`archiveDashboard`, `addTilesToDashboard`, `rearrangeTiles`, …) and computed getters (`live`,
`manageable`, `archived`, `favorites`, `recents`). Components import these directly — there is no
Vuex/Pinia and no action dispatch layer. Seed data comes from `src/data/mock.js` via `seed()`, with
tile factory helpers `kpi()`, `chart()`, `shortcut()` reused both for seeding and for
runtime-created tiles.

**Routing** (`src/router/index.js`) is **hash mode** (`createWebHashHistory`) — required for GitHub
Pages. Routes: `/dashboard/:id` (a board), `/dashboards` (the Manage listing), `/archive`; `/`
redirects to the user's default board. Note the mismatch between the mock URLs here and the live
product's `/dashboard` singular route.

**Three tile types**, each carrying a **provenance** tag that drives locking:
- `kpi` (headline number) · `chart` (ECharts widget) · `shortcut` (record table).
- `tile.prov` ∈ `predefined | user | shared`; `tile.seeded` marks a tile shipped *with* a
  predefined board. These flags are enforced **in the store** (`removeTile`, `archiveDashboard`,
  `archiveMany` all guard and *say so* rather than silently doing less than asked), not just hidden
  in the UI.

**Chart type-switching + locking rules live in exactly one file:** `src/data/chartTypes.js`. Only
`bar`/`hbar`/`line` are interchangeable (same category-vs-value shape); pie/donut/funnel/pyramid are
part-of-whole (`slice:true`) and can't be switched into; a predefined pie/KPI/shortcut is frozen.
Both the tile ⋯ menu and the builder call `typesFor()` / `isFrozen()` / `whyDisabled()` — don't
re-derive these rules anywhere else.

**Filterability heuristic:** `src/data/filters.js` decides which columns are worth offering as
filter fields — a field whose values never repeat is a *list*, not a filter, so it's excluded.

**Rendering choices (and why):** ServiceOps ships **on-prem**, so an embedded commercial chart lib
would be redistributed and trigger OEM licensing — hence **Apache ECharts** (`vue-echarts`), with
only the components actually used registered to keep the bundle small. Tables use **TanStack Table**
(headless) so `tokens.css` keeps owning the markup instead of fighting a vendor theme.

**Styling** is plain CSS with design tokens in `src/styles/tokens.css` (full **light + dark**
themes; the topbar toggles `store.ui.theme`). No CSS framework. Icons are Material Symbols routed
through `src/components/ui/Icon.vue` (name → ligature map).

**Popovers/menus** that a card's `overflow:hidden` would clip are **teleported to `<body>`** and
positioned in viewport coordinates — follow that pattern for any new floating UI.

> Note: `README.md`'s "Stack" section is **stale** — it describes hand-rolled SVG charts with "zero
> chart dependency." The app has since moved to ECharts + TanStack (see `package.json`). Trust this
> file over the README on the rendering stack.

## Key files

| File | Role |
|---|---|
| `store/index.js` | The single source of state + every mutation and getter. |
| `data/mock.js` | Seed data + `kpi`/`chart`/`shortcut` tile factories. |
| `data/chartTypes.js` | **Authoritative** chart type-switch / freeze rules. |
| `data/filters.js` | Which columns qualify as filter fields. |
| `views/DashboardView.vue` | The board: grid, grouping, undo/redo, skeleton + reveal, rearrange. |
| `views/ManageDashboards.vue` | The "All Dashboards" data grid — sort, filter, bulk actions. |
| `components/dashboard/ChartTile.vue` | ECharts wrapper — kinds, semantic colors, legend + rank-window, per-type entrance animation. |
| `components/dashboard/DataTable.vue` | TanStack table for Shortcut tiles — sort, search, per-column filters. |
| `components/dashboard/WidgetBuilderModal.vue` | Create/edit a tile. |
| `components/dashboard/AddWidgetModal.vue` | The tile library — tabs, module/type filters, usage badge. |
| `components/ui/FilterMenu.vue` | Shared two-level filter: OR within a field, AND across fields. |

## Locking rules (predefined content)

`data/chartTypes.js` and the store guards are authoritative — don't re-implement these:
- A **predefined dashboard**: can gain widgets and change category/layout, but not its Name,
  Description, or Visibility, and can't be archived/deleted.
- A **seeded tile** (`tile.seeded`) can't be removed. A predefined widget the *user* added can.
- A predefined **Bar/Column/Line** widget may switch among those three (Highlights editable only);
  a predefined **Pie/KPI/Shortcut** is fully frozen.
- Anything not predefined is fully editable.

## Gotchas that bite repeatedly

- A `<td>` set to `display:flex` **leaves the table layout** — it stops matching the row height and
  its `border-bottom` misaligns, breaking the row rule. Put flex on an **inner wrapper**, never the
  cell.
- Percentages on a truncated ("Top 10 of 63") chart must use the **pre-truncation denominator** —
  reporting "% of the shown 10" is a correctness bug, not polish.
- **Never `resize()` an ECharts instance on mount.** A resize re-lays-out the series and snaps a
  running entrance animation to its end state — the chart looks static with nothing in the build or
  DOM to explain why.
- **Verify UI changes in a real browser.** Several bugs here (a self-deleting chip, a card-clipped
  popover, a broken row rule) were invisible to DOM inspection and to the build.
