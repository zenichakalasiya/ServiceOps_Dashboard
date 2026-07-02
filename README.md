# ServiceOps Dashboards — UI/UX Revamp (Vue 3 prototype)

A working, runnable prototype of the **revamped ServiceOps Dashboards experience**, built to the
**33-point UI/UX improvement plan** (P1–P4) in
`../ServiceOps-Dashboards-UIUX-Improvements-by-Priority Final.pdf` and
`../docs/ServiceOps-Dashboards-UIUX-Improvements-by-Effort.pdf`.

It is a **front-end prototype with mock data** — no backend. The aesthetic is a clean, modern,
ClickUp-style light theme.

**ClickUp reference (browsed 2026-06-27, captures in `../docs/screenshots/clickup/`).** ClickUp's
own Dashboards hub **validates this prototype's information architecture**: a left panel with
**All Dashboards / My Dashboards / Shared with me / Private**, then **Favorites** and **Recents**
sections; a primary **New Dashboard** button; a **Templates** row; **Sort + Search**; and a
metadata table (Name / Location / Date viewed / Date updated / Owner / Sharing / ⋯). New-board
opens to a **template gallery** ("Start from scratch"), and the board header carries
**Schedule report · Share · ⋯ · Download · Fullscreen**. Possible follow-on refinements from this
reference: a **list/table view** toggle on the listing, a **Private** tab, a real **template
gallery** empty state, a **dark theme**, and **Schedule report** in the board header.

## Run it

```bash
cd serviceops-dashboard-revamp
npm install      # once
npm run dev      # http://localhost:5180
```

`npm run build` produces a static bundle in `dist/`.

## Stack

- **Vue 3** (`<script setup>`) + **Vite 6** + **vue-router** (hash mode)
- Plain **CSS design tokens** (`src/styles/tokens.css`) — no UI framework, no churn
- Hand-rolled **SVG charts** (`MiniChart.vue`) — zero chart dependency
- Reactive **mock store** (`src/store/index.js`) + seed data (`src/data/mock.js`)

## Where things live

```
src/
  views/        DashboardListing (Discover) · AllDashboards · ArchivePage · DashboardView
  components/
    shell/      AppSidebar · AppTopbar
    dashboard/  CreateDashboardPanel · DashboardCard · DashboardMenu · MiniPreview
                WidgetCard · MiniChart · TimeFilter · AutoRefresh
                AddWidgetModal · ShareDialog
    ui/         Icon · Toasts
  store/  data/  router/  styles/
```

## How the 33 improvements map to the prototype

Legend: ✅ implemented · ◑ representative / partial · ○ scaffolded direction only

### P1 · Critical (14)
| # | Change | Status | Where |
|---|--------|:--:|------|
| 1 | Create Dashboard as the primary action | ✅ | Topbar + Discover header → `CreateDashboardPanel` |
| 2 | Search dashboards by name | ✅ | Topbar global search + Discover search bar |
| 3 | Folders for dashboards | ✅ | Sidebar folders + folder filter + create-panel field |
| 4 | Categories & favorites — dashboards and tiles | ✅ | Card star + category filter; tile favorites in Add-Widget |
| 5 | "All Dashboards" page | ✅ | `AllDashboards.vue` — gallery grouped by folder w/ previews |
| 6 | Soft delete / archive — dashboards and tiles | ◑ | Dashboards: archive/restore; tiles: remove |
| 7 | Live preview while authoring | ✅ | Add-Widget "Live preview" pane |
| 8 | Archive page | ✅ | `ArchivePage.vue` — restore / delete-forever |
| 9 | Differentiate the two date filters | ◑ | Board header "Windowed on **Created date**" cue |
| 10 | Bulk-add guardrail (cap) | ✅ | `MAX_BULK_ADD` in Add-Widget; cap message |
| 11 | Share Dashboard | ✅ | `ShareDialog` — recipients + governed link + audience |
| 12 | Standardized widget header | ✅ | `WidgetCard` — title+info / refresh·fullscreen·edit·⋯ |
| 13 | Rebuild the time-filter UI/UX | ✅ | `TimeFilter` — presets + Quarter/YTD/Last-N-hrs + absolute |
| 14 | New Add-Widget flow | ✅ | `AddWidgetModal` — tabs, filters, preview, favorites |

### P2 · Important (10)
| # | Change | Status | Where |
|---|--------|:--:|------|
| 1 | System vs predefined dashboards | ✅ | "Predefined" badge + "Certified" chip |
| 2 | Dashboard description field | ✅ | Create panel + card + hover tooltip |
| 3 | Auto-arrange layout | ○ | Edit mode + drag handles (auto-arrange not built) |
| 4 | Unsaved-changes warning | ✅ | Edit banner "Unsaved changes" + discard confirm |
| 5 | Bulk retag & archive | ◑ | Archive via menu (bulk multi-select not built) |
| 6 | Show predefined tiles visually | ✅ | Predefined badge on Add-Widget library cards |
| 7 | Widget customization / styling | ○ | Not built (Hard) — charts render fixed |
| 8 | Align Pagination and "Add to Dashboard" | ✅ | Add-Widget footer — one row |
| 9 | Loading skeletons & empty states | ✅ | Board skeleton + empty-board + tile loading/no-data |
| 10 | Standardize Export vs Download | ◑ | Tile ⋯ → PDF/Image/CSV; Share replaces auto-email |

### P3 · Nice to have (6)
| # | Change | Status | Where |
|---|--------|:--:|------|
| 1 | Click-to-expand in charts | ◑ | Per-tile fullscreen / present |
| 2 | Recently used | ✅ | "Recently used" section on Discover |
| 3 | Tour guide for new users | ○ | Not built |
| 4 | Present mode — board and tiles | ◑ | Per-tile present mode (`WidgetCard`) |
| 5 | Refresh customization | ◑ | `AutoRefresh` board-level intervals |
| 6 | Remove the extra white strip | ✅ | Clean edge-to-edge layout |

### P4 · Later (3)
| # | Change | Status | Where |
|---|--------|:--:|------|
| 1 | Tags / categories for dashboards | ◑ | Categories implemented (free-form tags not) |
| 2 | Mobile design | ◑ | Responsive grid breakpoints |
| 3 | Accessibility | ◑ | Native buttons, focus states, **non-color-only RAG** (text+glyph), `aria-hidden` icons |

## AIOps + ServiceOps-.185 alignment (added 2026-06-27, after browsing both servers)
- **Leftmost ServiceOps module rail** (`ModuleRail.vue`) — narrow icon nav mirroring the live .185
  module list: Dashboard · Requests · Problems · Changes · Releases · CMDB · Projects · Knowledge ·
  Reports · My Approvals · My Tasks · My Team (Dashboard active; others are out-of-scope stubs).
- **Dashboard listing as a left flyout** (`ListingFlyout.vue`), modelled on the AIOps dashboard
  flyout — toggled by the chevron next to the board title (and the topbar search). Tabs
  **All / Created by me / Shared with me**, a search box, and **category accordions** ordered
  **Recently used → My Favourite → by category** (each with a count). The old full-page listing,
  the grid/list toggle, and the metadata table are removed.
- **Predefined pill** rendered as a small gradient tag with **4px** radius.
- Listing rows show **only** a favourite star (on hover) + a delete button (on hover, **custom
  user dashboards only**); all dashboard-management actions live in the opened board's **⋯** menu.
- Reference screenshots: `../docs/screenshots/aiops/` and `../docs/screenshots/serviceops-185/`.
- **Create Dashboard** opens as a **right-side drawer** (not a centre modal).
- **Predefined tag** restyled minimal (no gradient, 4px radius) and only shown under category groups in the flyout (not under Recently used / My Favourite).
- **Technician Access Level + Technician Group Access Level** (from the .185 Manage list) are surfaced via a **"who can access" popover** opened from the board-header access chip — replacing the columns that no longer exist now that listing is a flyout.

## ClickUp-aligned refinements (added 2026-06-27, after browsing ClickUp)
- **Dark theme toggle** (topbar sun/moon) — full token-level dark mode.
- **List / table view** on the listing — ClickUp-style metadata table (Name · Location · Access · Updated · Owner · ⋯), toggled against the card gallery.
- **Private tab** on the listing (All · My · Shared · **Private**).
- **Template-gallery empty state** — a new/empty board offers starter templates (Helpdesk · SLA · Asset · Executive · Start from scratch) that seed sample tiles.
- **Schedule report** in the board header (cadence · format · audience-validated recipients).
- **ClickUp-style tiles** — KPI cards render a big **centered** number + label with delta + RAG; tile controls reveal on hover; Add-Widget library cards show preview thumbnails (number / bars / rows).

## Try these flows
1. **Discover** → toggle **dark mode** + **list view**; star a board, switch tabs (All / My / Shared / **Private**), search, open a folder.
2. **Create Dashboard** (topbar) → set Category + Folder → land on the empty-state → **Add your first widget**.
3. On a board → **Add Widget** → "New widget" (pick a type, watch the live preview; pick the **Asset** module to see the H/W asset-type dropdown open by default) or a **reuse** tab (multi-select up to the cap; note Predefined badges; pagination + Add on one row).
4. Board header → **Time Filter** (Quarter / YTD / absolute range), **Auto-Refresh**, **Share**, **⋯** (Clone / Mark default / Copy link / Archive).
5. **Archive** (sidebar) → restore or delete-forever.

> Mock-only: data resets on refresh. All actions show a toast so the behavior is visible.
