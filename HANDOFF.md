# Handoff — 2026-08-04 00:54

## Read first
See **CLAUDE.md → "The 12 chart types + Free Text (PMG-ACT-01)"** and the Key-files
rows for `records.js` / `chartOptions.js` — that's the architecture everything below
plugs into. Locking rules are still in `data/chartTypes.js`.

## What we worked on this session
Built **PMG-ACT-01**: eight additional chart types + a Free Text tile family into the
widget builder (create / edit / clone), each computing from a single deterministic
48-record dataset. Shipped in 5 verified, separately-published batches.

## Completed (all live)
- **Dataset** — `src/data/records.js` REQUEST_RECORDS solved so the engine reproduces
  **every** worked example in the reference *including resolution averages* (73/73).
- **Scaffolding** — `chartData(spec)` dispatch in records.js; `chartOptions.js`
  (`CHART_OPT` + `NEW_KINDS`); `ChartTile` renders new kinds from `chart.spec`;
  builder chart-type grid + per-kind config sections + `MeasureConditions.vue`;
  `Icon.vue` glyphs; `AddWidgetModal` gallery cards.
- **Batch A** Stacked/Grouped · Multi-line. **B** Combo · Histogram · Funnel.
  **C** Heatmap · Gauge. **D** Pie/Donut split · Free Text. **E** Map Bubble (India).
- All 12 chart types + Free Text verified in-browser (builder preview AND placed on
  the board) and pushed. Live at the GitHub Pages URL in CLAUDE.md → Deployment.

## In progress
Nothing mid-flight — PMG-ACT-01 is complete and published (last commit `92e7b68`).

## Next steps
- Optional: add the 12 new types to the improvement-tracker docs in `../docs/`
  (parent workspace — **not** this repo; keep planning docs out of the public repo).
- Optional polish: seed one or two of the new kinds onto a demo board so they show
  by default; give the AI summary bespoke phrasing for gauge/heatmap/map.
- If the India map ever needs to be lighter, dissolve districts → states (needs a
  geometry-union step; currently 651 district features simplified to ~175KB).

## Decisions made
- **Spec-driven kinds**: a new-kind tile stores `chart.spec`, and `ChartTile`
  recomputes display data via `chartData(spec)` so preview and placed tile always
  agree. Chosen over baking labels/series onto the tile.
- **Native legends** for the multi-series new kinds (they carry their own legend in
  the option); they sit out ChartTile's custom legend/rank machinery. Funnel/heatmap/
  gauge/map self-label or need no legend, so `sideLegend` also excludes new kinds.
- **Reused `kind:'funnel'`** for the engine-driven funnel — the legacy funnel path was
  unreachable in the prototype, so no collision. New kinds are `isFrozen` (no switch).
- **India map is code-split + lazy-registered** (35KB gzip chunk), not in the main
  bundle. Simplified from a 4MB GeoJSON.
- **Averages caveat**: the reconstructed dataset had to match the PDF's exact averages
  (per the teammate), not just the counts — solved with an annealing search.

## Gotchas & notes
- **`WidgetCard.tileState` must treat `chart.spec` as `'ok'`** — otherwise every
  placed new-kind tile falsely renders the "no data" empty state (this bit us; fixed).
- **Percentages/denominators**: funnel labels are "% of first stage" (not slice-of-
  total); histogram % uses the full pre-truncation total. Keep these.
- **Never `resize()` an ECharts instance on mount** (existing gotcha) — it snaps the
  entrance animation to its end state.
- Dev-server HMR can corrupt after long sessions; restart `npm run dev` (or use
  `npm run preview` on the built bundle) to isolate real bugs from HMR.
- chrome-devtools-mcp browser occasionally wedges ("browser is already running") —
  kill the `*chrome-devtools-mcp*` chrome processes via PowerShell, then reconnect.
