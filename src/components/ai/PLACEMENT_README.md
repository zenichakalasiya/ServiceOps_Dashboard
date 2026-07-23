# AI-insights placement lab

A prototype to compare **three placements** of the AI-insights entry point over the real
Helpdesk Overview board, and decide which costs the least vertical space while still being
discoverable. Route: **`/ai-placement`**.

The number being optimised is on screen at all times, top-right: **px consumed above the
KPI row**, and whether **widget row 3 clears a 900px fold**.

## The shared panel — the thing that survives

`AiInsightsPanel.vue` is opened by **all three** variants. Whichever placement wins, this is
the component that ships. It renders the five mock insights (`data/aiInsights.mock.js`), each
a title + a one-line detail + the widget it relates to; selecting one expands it inline.
Header: title, pin toggle, close. Esc closes; focus is trapped while open and returns to the
trigger on close. It docks by being a flex **sibling** of the content column, so opening it
**pushes** the board narrower rather than overlaying it.

Open/pinned state persists per user via `store.ui.aiInsightsOpen` / `aiInsightsPinned` — the
app's own mechanism (there is no `localStorage` layer anywhere in this project).

## The three variants

| | Variant | What it is | Tradeoff | Watch for |
|---|---|---|---|---|
| **A** | Header chip + popover | `✨ 5` chip in the page header → popover (lead insight + "4 more" + two actions) → opens the panel | Near-zero vertical cost; discovery depends on noticing a small chip | Chip must survive a zero-insight state (stays, no count); popover and panel never both open |
| **B** | First KPI tile | The AI card takes KPI slot 1, matching tile height/radius/padding; the five metrics reflow | Zero extra chrome — it's already a tile row; but it spends a metric slot | Content must survive ~200px wide: glyph + "AI insights" + count + arrow, no sentence |
| **C** | Current banner (baseline) | Today's collapsible banner, minus "Add a new widget" | Most discoverable; costs the most height | This is the number the other two are trying to beat |

## Status

- ✅ **Increment 1** — lab frame, live readout, shared panel, **Variant C** (baseline).
- ⏳ Variant A (header chip + popover) — next.
- ⏳ Variant B (KPI tile) — after A.

## Constraints honoured

- Matches the AI banner's visual language via the `--ai*` tokens (no new AI colour).
- Reuses the real `WidgetCard` for every tile and the real `AiSummaryCard` for Variant C
  (a non-destructive `hideAddWidget` prop drops the one CTA). No new UI dependency.
- Mock data only — one file, five entries. No API, no backend, no schema change.
- Sentence case throughout. Works in light and dark theme (all colours are tokens).
- Keyboard: Esc closes; the panel traps focus and restores it to its trigger.

## Flagged (new local primitives, per Phase 0)

The project has **no generic Popover or Drawer component** — both are hand-rolled patterns.
So Variant A's popover and this panel are built **locally**, not as shared primitives, to
avoid introducing a dependency. If a `<Popover>`/`<Drawer>` is wanted app-wide later, these
are the reference implementations to extract from.
