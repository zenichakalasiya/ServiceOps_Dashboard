# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A runnable **Vue 3 + Vite** prototype of the revamped **ServiceOps Dashboards** experience — the
working demo shown to management. **Front-end only: mock data, no backend, no persistence** (state
resets on every page refresh). Every action fires a toast so the behavior is observable in a demo.

This repo is **published publicly** and auto-deploys to GitHub Pages. It is the *only* part of the
larger analysis workspace that is public — the planning docs, the limitations register, and
credentials live in the parent workspace **outside this folder** and must never be copied in here.

## Deployment
Repo: https://github.com/zenichakalasiya/ServiceOps_Dashboard
Live URL: https://zenichakalasiya.github.io/ServiceOps_Dashboard/

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
themes; the topbar toggles `store.ui.theme`). No CSS framework. The typeface is **Inter**
(loaded in `index.html`, exposed as `--font`). Icons are Material Symbols routed through
`src/components/ui/Icon.vue` (name → ligature map).

**The AI gradient is tokenised — use the tokens, never hand-rolled gradients:**
- `--ai-grad` — the vivid identity gradient (blue → purple → pink, `0 / 24.52 / 100%`). Used
  **only** for icon glyphs (`background-clip: text`) and solid primary buttons.
- `--ai-grad-line` — the same ramp at 80% alpha, for **gradient borders** on primary CTAs
  (`linear-gradient(var(--surface),var(--surface)) padding-box, var(--ai-grad-line) border-box`
  over a `1.5px solid transparent` border).
- `--ai-grad-soft` — an 8%-over-white wash, for **secondary** CTAs, suggested items and AI
  summary surfaces.
- Follow-up pills are deliberately **monochrome** (`--surface-2`) — colour there competes with
  the answer above it.

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
| `components/ai/AiAssistant.vue` | The whole AI side panel — composer, thread, creation flows. |
| `components/ai/AiSummaryCard.vue` | The upfront AI Summary banner + its 3 CTAs. |
| `views/AiPlacementLab.vue` | Internal `/ai-placement` lab comparing 3 entry placements (header chip · KPI-row card · banner). All three open the **real `AiAssistant` overlay** — each CTA fires its own intent (`analyzing` / `widgets` / `suggestwidget`). `AiInsightsPanel.vue` (the old mock push-panel) is no longer referenced. |
| `data/aiEngine.js` | **Deterministic, no-LLM** engine: facts, anomalies, explanations, briefings. |
| `data/aiAssistant.js` | Intent routing, tile/fact resolution, and `resolveWidget` (description → configured widget). |

## The AI assistant (`components/ai/AiAssistant.vue`)

**Grounded, no LLM.** `data/aiEngine.js` computes *every* number deterministically (z-score
anomalies, breach counts, deltas, chart breakdowns). Nothing is invented, so the panel degrades
cleanly with no model attached — a language model would only rephrase.

**The composer** has no inline form fields. There is one input at the bottom; everything types
there:
- The `+` button (or typing `/`) opens a compact **command palette** — icon + name only.
- Picking a command drops it in as a **chip**, swaps the placeholder to that command's, and
  opens its suggestions. Those suggestions **fade out the moment the user types their own
  prompt**. The palette and the suggestion list share **one** transitioned element so they stay
  mutually exclusive (two sibling `<transition>`s raced and could hang).
- An `awaiting` ref routes the next submitted message into a live creation step, and the
  placeholder speaks for that step.

**Every answer thinks, then streams.** `runThinking()` steps through grounded reasoning lines
(pending → spinner → check), then `streamText()` reveals prose word-by-word and `revealItems()`
staggers lists. All of it honours `prefers-reduced-motion` (skips straight to the result).

**Creation is intent-led, and it BUILDS before it administrates.** Describe what a dashboard is
*for*; the AI drafts a widget plan and **names it if you didn't**. Approving the draft creates the
board immediately (with defaults) and moves to filling it — a small palette shows the vocabulary
(Column · Bar · Line · Doughnut · KPI · Shortcut; tap one to hint a form), then you describe
widgets in the composer. **"That's everything"** navigates the canvas to the new board with the
panel still open and recaps what was built. Only *then* come the two things it can't infer —
category, then visibility — applied to the existing board.

**One message can build many widgets.** `splitWidgetRequests` splits on newlines, semicolons,
bullets and numbered markers always; commas and "and" **only** when a count was stated, because a
bare "and" is usually part of one phrase ("SLA breaches and overdue work"), not a list boundary.
Each widget is placed in sequence, labelled "n of m", with the add/finish pills only after the
last one.

**Form precedence is `item wording → batch preamble → palette hint → inferred`** (`formFor()`).
This matters because the splitter *strips the preamble* — so "add 4 KPIs: a; b; c; d" states the
form once, in the very text that gets removed. `explicitForm()` is read from the whole message and
carried across the batch; anything an item names itself still wins.

**`resolveWidget` (in `data/aiAssistant.js`) is what makes the output match the prompt.** It reads
the module, the conditions, the grouping dimension (with that dimension's *real* labels), the time
window and the form, then generates data shaped like the dimension — a priority split descends, a
month series trends, a team split is uneven — seeded from the text so the same sentence always
builds the same widget. Anything it genuinely can't infer comes back in `spec.missing`; the flow
**pauses and asks** (grouping is the usual one) rather than guessing, then resumes the queue.

**The panel reads the board you're actually on** (`aiBoard` in `DashboardView.vue` is a computed
over the live dashboard, not a fixed demo board). A newly created or empty board is summarised
honestly — "no widgets yet" — rather than borrowing another board's story.

**KPI values come from the condition, not a constant.** `KPI_SHAPE` in `data/aiAssistant.js` gives
overdue / SLA-breaching / unassigned / urgent / open / resolved their own plausible range, delta
direction and status, seeded from the text. Without this, four counters built in one batch all
read the same number.

**Numbered next steps** appear only after a task that leaves a real decision (dashboard created,
widget added). Contextual **follow-ups** appear only on answers that invite a next question
(`FOLLOWUP_KINDS`). **Rate / copy** (`hasFeedback`) sit under every finished answer but never under
a question card or anything still awaiting input. Don't stack all three on one block.

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
- **Two sibling `<transition>` elements toggled in the same tick can race** — both mount at once
  and a leave animation hangs with `enter-from` still applied, so the node never unmounts. If two
  popovers are mutually exclusive, render them through **one** transitioned element.
- **Legend click-to-toggle is universal.** `legendClickable` in `ChartTile.vue` is `true` for
  every chart; the `hidden`/`plotted` machinery already handles side (pie/donut) and bottom
  (cartesian) legends. Don't re-gate it by cardinality.
- **`tileFromText` must prefer the LONGEST title match.** With a plain `.find()`, "Open Requests
  By Priority" resolved to the *"Open Requests"* KPI and silently explained the wrong widget.
- **A fact passed to the drill needs a real `tileId`** — without it there's no widget to
  spotlight and the block renders empty.
- **Watch for CSS class collisions in `AiAssistant.vue`** — it's one large scoped stylesheet. A new
  `.fb` (feedback button) silently inherited the existing `.fb` (summary fact body, `flex: 1`) and
  stretched each icon to 147px. Grep the file for a class name before introducing it.
- **The batch preamble is stripped before items are resolved** — any instruction stated once for
  the whole message ("4 KPIs", "as shortcuts") must be captured from the *original* text, not from
  the split fragments.
