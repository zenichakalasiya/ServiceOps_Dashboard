<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/ui/Icon.vue'
import WidgetCard from '../components/dashboard/WidgetCard.vue'
import TimeFilter from '../components/dashboard/TimeFilter.vue'
import AutoRefresh from '../components/dashboard/AutoRefresh.vue'
import DashboardMenu from '../components/dashboard/DashboardMenu.vue'
import AddWidgetModal from '../components/dashboard/AddWidgetModal.vue'
import WidgetBuilderModal from '../components/dashboard/WidgetBuilderModal.vue'
import PresentMode from '../components/dashboard/PresentMode.vue'
import HistoryDialog from '../components/dashboard/HistoryDialog.vue'
import DownloadDialog from '../components/dashboard/DownloadDialog.vue'
import SharePopover from '../components/dashboard/SharePopover.vue'
import ShareDialog from '../components/dashboard/ShareDialog.vue'
import ScheduleDialog from '../components/dashboard/ScheduleDialog.vue'
import { store, byId, recordView, toggleFavorite, removeTile, toast } from '../store/index.js'
import { uid } from '../data/mock.js'
const route = useRoute()
const router = useRouter()

const d = computed(() => byId(route.params.id))
const edit = ref(route.query.edit === '1')
const dirty = ref(false)
const showAdd = ref(false)
const showShare = ref(false)
const showSchedule = ref(false)
const showHistory = ref(false)
const showDownload = ref(false)
const sharePop = ref(false)
const restrictOpen = ref(false)
const descHover = ref(false)
const presenting = ref(false)
const loadingBoard = ref(true)
const revealing = ref(false)   // brief window after load → staggered widget reveal animation
const highlightId = ref(null)
const editTile = ref(null)   // tile currently open in the builder (edit mode)
const dupTile = ref(null)    // tile being duplicated (builder opens pre-filled, saves a copy)
const fabMenu = ref(false)   // FAB slide-up: Create Dashboard / Create Widget
const gridEl = ref(null)

// ---- drag-to-reorder / drag-into-group (armed from each card's 6-dot handle) ----
const dragArmed = ref(null)      // tile id currently draggable
const dragId = ref(null)         // tile id being dragged
const dropGroup = ref(undefined) // group id currently hovered (undefined=none, null=ungrouped)
function armDrag(t) { dragArmed.value = t.id; window.addEventListener('mouseup', disarmOnce, { once: true }) }
function disarmOnce() { if (dragId.value == null) dragArmed.value = null }
function onDragStart(t) { dragId.value = t.id }
function onDragEnd() { dragArmed.value = null; dragId.value = null; dropGroup.value = undefined }
function onDropTile(target) {     // dropped onto another tile → reorder + adopt its group
  const arr = d.value.tiles
  const from = arr.findIndex((x) => x.id === dragId.value)
  if (from < 0 || arr[from].id === target.id) return
  const [m] = arr.splice(from, 1)
  m.group = target.group ?? null
  arr.splice(arr.findIndex((x) => x.id === target.id), 0, m)
  d.value.updated = new Date().toISOString(); dirty.value = true
}
function onDropGroup(gid) {        // dropped onto a section → move into that group (end)
  const arr = d.value.tiles
  const from = arr.findIndex((x) => x.id === dragId.value)
  if (from < 0) return
  const [m] = arr.splice(from, 1)
  m.group = gid
  arr.push(m)
  dropGroup.value = undefined
  d.value.updated = new Date().toISOString(); dirty.value = true
}

// ---- widget groups (Grafana-style collapsible rows) + pin ----
function tilesIn(gid) {
  const ids = new Set((d.value.groups || []).map((g) => g.id))
  return d.value.tiles
    .filter((t) => ((t.group && ids.has(t.group)) ? t.group : null) === gid)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))   // pinned float to top
}
const addToGroup = ref(null)   // group id a newly-added widget should land in
function addGroup(absorb = true) {
  if (!d.value.groups) d.value.groups = []
  const g = { id: uid('g'), name: `New group ${d.value.groups.length + 1}`, collapsed: false }
  const first = d.value.groups.length === 0
  d.value.groups.push(g)
  // The very first group absorbs all currently-ungrouped widgets (canvas "New group").
  // An Empty Group created from the Add-Widget flow (absorb=false) stays empty.
  if (first && absorb === true) d.value.tiles.forEach((t) => { if (!t.group) t.group = g.id })
  dirty.value = true
  return g.id
}
// "Empty Group" card in the Add-Widget flow → make a genuinely empty group, then close.
function onNewGroup() {
  addGroup(false)
  showAdd.value = false; addToGroup.value = null
  toast('Empty group added — use its “Add widget” button to fill it', 'success')
}

// ---- Grouping-style DEMO switcher: compare the 5 designs live ----
const GSTYLES = [
  { id: 1, n: '①', label: 'Select', desc: 'Marquee-drag or Shift-click widgets, then Create group' },
  { id: 2, n: '②', label: 'Container', desc: 'Add an empty group from the toolbar, drag widgets in' },
  { id: 3, n: '③', label: 'Inline', desc: 'Hover a row gap for a "+ New group here" inserter' },
  { id: 4, n: '④', label: 'Add menu', desc: 'Create an Empty Group from the + (FAB) menu' },
  { id: 5, n: '⑤', label: 'Hybrid', desc: 'All of the above combined (recommended)' },
  { id: 6, n: '⑥', label: 'Right-click', desc: 'B — Right-click a widget → New group / Add to group ▸' },
  { id: 7, n: '⑦', label: 'Hover icon', desc: 'E — A group chip on each widget → New group / Add to group ▸' },
  { id: 8, n: '⑧', label: 'Sections', desc: 'F — Typed section headings; drag widgets under them' },
  { id: 9, n: '⑨', label: 'Auto-group', desc: 'G — Group automatically by Type or Source' },
]
const showGroupDemo = true    // demo switcher visible; default grouping is ① Select
const gs = computed(() => store.ui.groupStyle)

// ---- Legend-strategy DEMO switcher: compare the 5 answers to a 63-category chart.
// Only charts above the high-cardinality threshold react; the rest render normally.
// See docs/legend-and-topn-design.md
const LSTYLES = [
  { id: 1, n: '①', label: 'Re-encode', desc: 'Ranked bar — names on the axis, so no legend and no colour are needed. Drag the rail to reach any rank.' },
  { id: 2, n: '②', label: 'Top-N + Other', desc: 'Bound the set, roll the tail into an explicit “Other”, and state the truncation on the tile. Percentages still use the full total.' },
  { id: 3, n: '③', label: 'Series manager', desc: 'The legend becomes a searchable panel: click to isolate, Ctrl-click to toggle, or bulk-hide 50 series in two clicks.' },
  { id: 4, n: '④', label: 'Overflow chip', desc: 'Show 8 swatches inline, collapse the rest into “+N more”. The cheapest option that still doesn’t lie.' },
  { id: 5, n: '⑤', label: 'Cardinality gate', desc: 'Refuse to render an unreadable chart. Make the author choose before it reaches a dashboard.' },
]
const showLegendDemo = true
const ls = computed(() => store.ui.legendStyle)
const gUseMarquee = computed(() => gs.value === 1 || gs.value === 5)      // select-to-group
const gShowAddGroupBtn = computed(() => gs.value === 2 || gs.value === 5)  // big toolbar button (not inline)
const gShowInserters = computed(() => gs.value === 3 || gs.value === 5)   // hover "+ New group here" between groups
const gShowRowInserters = computed(() => gs.value === 3)                  // inline: hover inserters between ungrouped widget ROWS

// Detect the vertical gaps between ungrouped widget rows so an inline "+ New group here"
// inserter can appear on hover in each gap (no permanent CTA, zero upfront space).
const ugGridEl = ref(null)
const rowGaps = ref([])
function computeRowGaps() {
  rowGaps.value = []
  if (gs.value !== 3) return
  const grid = ugGridEl.value
  if (!grid) return
  const cells = [...grid.children].filter((c) => c.classList?.contains('cell'))
  if (!cells.length) return
  const rows = []
  cells.forEach((c) => {
    const top = c.offsetTop
    const row = rows.find((r) => Math.abs(r.top - top) < 8)
    if (row) row.bottom = Math.max(row.bottom, top + c.offsetHeight)
    else rows.push({ top, bottom: top + c.offsetHeight })
  })
  rows.sort((a, b) => a.top - b.top)
  const gaps = []
  for (let i = 0; i < rows.length - 1; i++) gaps.push(Math.round((rows[i].bottom + rows[i + 1].top) / 2))
  // guarantee a first-group entry point (bottom gap) when no groups exist yet
  if (!(d.value?.groups || []).length) gaps.push(Math.round(rows[rows.length - 1].bottom + 6))
  rowGaps.value = gaps
}
let ugRO
onMounted(() => {
  nextTick(computeRowGaps)
  ugRO = new ResizeObserver(() => computeRowGaps())
})
watch([gs, () => d.value?.tiles?.length, () => (d.value?.groups || []).length], () => nextTick(computeRowGaps))
watch(ugGridEl, (el) => { ugRO?.disconnect(); if (el) ugRO?.observe(el); nextTick(computeRowGaps) })
onBeforeUnmount(() => ugRO?.disconnect())
const gShowFabGroup = computed(() => gs.value === 4 || gs.value === 5)    // Empty Group in the FAB menu
const gShowTip = computed(() => gs.value === 1 || gs.value === 5)         // "drag a box" hint
const gShowEmptyGroupCta = computed(() => [2, 3, 5, 8].includes(gs.value)) // empty-state "or create a group"
const gRightClick = computed(() => gs.value === 6)   // B — right-click context menu
const gHoverIcon = computed(() => gs.value === 7)    // E — per-widget hover chip
const gSections = computed(() => gs.value === 8)     // F — section headings
const gAutoBy = computed(() => gs.value === 9)       // G — auto-group by attribute

// ---- B & E: a per-tile group menu (New group / Add to group ▸ / Remove) ----
const tileMenu = ref({ open: false, tile: null, top: 0, left: 0 })
function openTileMenu(t, e) {
  e.preventDefault(); e.stopPropagation()
  tileMenu.value = { open: true, tile: t, top: Math.min(e.clientY, window.innerHeight - 240), left: Math.min(e.clientX, window.innerWidth - 220) }
}
function closeTileMenu() { tileMenu.value = { ...tileMenu.value, open: false } }
function onCellContext(t, e) { if (gRightClick.value) openTileMenu(t, e) }
function tileNewGroup(t) {
  if (!d.value.groups) d.value.groups = []
  const g = { id: uid('g'), name: `New group ${d.value.groups.length + 1}`, collapsed: false }
  d.value.groups.push(g); t.group = g.id
  editingGroup.value = g.id
  d.value.updated = new Date().toISOString(); dirty.value = true; closeTileMenu()
  toast(`Grouped “${t.title}”`, 'success')
}
function tileToGroup(t, gid) { t.group = gid; d.value.updated = new Date().toISOString(); dirty.value = true; closeTileMenu(); toast(`Moved “${t.title}”`, 'success') }
function tileUngroup(t) { t.group = null; d.value.updated = new Date().toISOString(); dirty.value = true; closeTileMenu() }

// ---- G: auto-group by attribute (read-only derived view) ----
const AUTO_ATTRS = {
  type: (t) => ({ kpi: 'KPIs', chart: 'Widgets', shortcut: 'Shortcuts' }[t.type] || 'Other'),
  source: (t) => ({ predefined: 'Predefined', user: 'User-defined', shared: 'Shared with me' }[t.prov || 'user']),
}
const autoBy = ref('none')
const AUTO_OPTS = [{ value: 'none', label: 'None' }, { value: 'type', label: 'Type' }, { value: 'source', label: 'Source' }]
const derivedGroups = computed(() => {
  if (!gAutoBy.value || autoBy.value === 'none') return null
  const fn = AUTO_ATTRS[autoBy.value], map = new Map()
  d.value.tiles.forEach((t) => { const k = fn(t); if (!map.has(k)) map.set(k, []); map.get(k).push(t) })
  return [...map.entries()].map(([name, tiles]) => ({ name, tiles }))
})

// ---- New group by direct MARQUEE drag (no CTA needed to start) ----
// Press-drag anywhere on the board (past a small threshold) to rubber-band a box over
// the placed widgets; on release a "Create group" CTA appears bottom-right to confirm.
const selecting = ref(false)          // marquee drag in progress
const groupPicks = ref(new Set())     // currently-boxed tile ids
const showGroupCta = ref(false)       // post-release confirm CTA
const marquee = ref({ active: false, l: 0, t: 0, w: 0, h: 0 })  // viewport coords (fixed overlay)
let mqPending = null, mqStart = null
// container-first: a labeled "Add group" makes an empty, collapsible group you fill later
function insertEmptyGroup(i) {
  if (!d.value.groups) d.value.groups = []
  const g = { id: uid('g'), name: `New group ${d.value.groups.length + 1}`, collapsed: false }
  d.value.groups.splice(i, 0, g)
  d.value.updated = new Date().toISOString(); dirty.value = true
  editingGroup.value = g.id            // drop straight into rename
  return g.id
}
function addEmptyGroup() { insertEmptyGroup((d.value.groups || []).length); toast('Empty group added — drag widgets in, or use its “Add widget” button', 'success') }
function togglePick(id) {
  const s = new Set(groupPicks.value); s.has(id) ? s.delete(id) : s.add(id); groupPicks.value = s
  showGroupCta.value = groupPicks.value.size > 0
}
function boardMouseDown(e) {
  if (!gUseMarquee.value) return   // select-to-group only in styles ① and ⑤
  if (e.button !== 0) return
  if (e.target.closest('button, a, input, textarea, select, .draghandle, .resize, .grp-head')) return
  // Shift / Ctrl / ⌘ + click on an ungrouped tile toggles it into the selection
  const cell = e.target.closest('.cell[data-tile]')
  if ((e.shiftKey || e.ctrlKey || e.metaKey) && cell && !cell.closest('.group')) {
    togglePick(cell.getAttribute('data-tile')); e.preventDefault(); return
  }
  mqPending = { x: e.clientX, y: e.clientY }
  window.addEventListener('mousemove', mqPendingMove)
  window.addEventListener('mouseup', mqPendingUp)
}
function mqPendingMove(e) {
  if (!mqPending) return
  if (Math.abs(e.clientX - mqPending.x) < 5 && Math.abs(e.clientY - mqPending.y) < 5) return
  mqStart = mqPending; mqPending = null
  window.removeEventListener('mousemove', mqPendingMove)
  window.removeEventListener('mouseup', mqPendingUp)
  selecting.value = true; showGroupCta.value = false; groupPicks.value = new Set()
  marquee.value = { active: true, l: mqStart.x, t: mqStart.y, w: 0, h: 0 }
  window.addEventListener('mousemove', mqMove)
  window.addEventListener('mouseup', mqUp)
  mqMove(e)
}
function mqPendingUp() {
  window.removeEventListener('mousemove', mqPendingMove)
  window.removeEventListener('mouseup', mqPendingUp)
  mqPending = null
}
function mqMove(e) {
  const l = Math.min(mqStart.x, e.clientX), t = Math.min(mqStart.y, e.clientY)
  const w = Math.abs(e.clientX - mqStart.x), h = Math.abs(e.clientY - mqStart.y)
  marquee.value = { active: true, l, t, w, h }
  const box = { left: l, top: t, right: l + w, bottom: t + h }
  const s = new Set()
  gridEl.value?.querySelectorAll('.ug-wrap [data-tile]').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (!(r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom)) s.add(el.getAttribute('data-tile'))
  })
  groupPicks.value = s
}
function mqUp() {
  window.removeEventListener('mousemove', mqMove)
  window.removeEventListener('mouseup', mqUp)
  selecting.value = false
  marquee.value = { ...marquee.value, active: false }
  if (groupPicks.value.size) showGroupCta.value = true
  else clearPicks()
}
function clearPicks() { groupPicks.value = new Set(); showGroupCta.value = false }
function createGroupFromPicks() {
  if (!groupPicks.value.size) { clearPicks(); return }
  if (!d.value.groups) d.value.groups = []
  const g = { id: uid('g'), name: `New group ${d.value.groups.length + 1}`, collapsed: false }
  d.value.groups.push(g)
  const n = groupPicks.value.size
  // remember each tile's previous group so the action can be undone cleanly
  const prev = d.value.tiles.filter((t) => groupPicks.value.has(t.id)).map((t) => ({ id: t.id, group: t.group ?? null }))
  prev.forEach((p) => { const t = d.value.tiles.find((x) => x.id === p.id); if (t) t.group = g.id })
  d.value.updated = new Date().toISOString(); dirty.value = true
  toast(`Grouped ${n} widget${n > 1 ? 's' : ''} — the rest stay on the dashboard`, 'success', {
    label: 'Undo',
    fn: () => {
      prev.forEach((p) => { const t = d.value.tiles.find((x) => x.id === p.id); if (t) t.group = p.group })
      d.value.groups = d.value.groups.filter((x) => x.id !== g.id)
      dirty.value = true
    },
  })
  clearPicks()
}
function addWidgetToGroup(gid) { addToGroup.value = gid; showAdd.value = true }
function ungroup(g) {
  d.value.tiles.forEach((t) => { if (t.group === g.id) t.group = null })
  d.value.groups = d.value.groups.filter((x) => x.id !== g.id)
  dirty.value = true
}
const editingGroup = ref(null)
function onPin(t) { t.pinned = !t.pinned; d.value.updated = new Date().toISOString(); dirty.value = true; toast(t.pinned ? `Pinned “${t.title}”` : `Unpinned “${t.title}”`) }

// ---- per-dashboard layout (from the create/clone panel) ----
const FONT_PX = { S: 12.5, M: 13.5, L: 15 }
const boardVars = computed(() => ({ '--tile-title': (FONT_PX[d.value?.headerFont] || 13.5) + 'px' }))
const gridStyle = computed(() => ({ columnGap: (d.value?.hGap ?? 14) + 'px', rowGap: (d.value?.vGap ?? 14) + 'px' }))

// ---- per-tile size (default span/height) + drag-to-resize from bottom-right ----
function cellStyle(t) {
  const w = Math.min(12, Math.max(2, t.w || 3))
  const h = Math.max(1, t.h || 1)
  const base = d.value?.rowHeight ?? 140
  return { gridColumn: `span ${w}`, minHeight: (base + (h - 1) * 110) + 'px' }
}
let resizeCtx = null
function startResize(e, t) {
  const grid = gridEl.value; if (!grid) return
  const gap = 14, col = (grid.getBoundingClientRect().width - gap * 11) / 12
  resizeCtx = { t, startX: e.clientX, startY: e.clientY, w0: t.w || 3, h0: t.h || 1, col, gap }
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeUp)
}
function onResizeMove(e) {
  if (!resizeCtx) return
  const { t, startX, startY, w0, h0, col, gap } = resizeCtx
  t.w = Math.min(12, Math.max(2, w0 + Math.round((e.clientX - startX) / (col + gap))))
  t.h = Math.min(4, Math.max(1, h0 + Math.round((e.clientY - startY) / 110)))
}
function onResizeUp() {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeUp)
  if (resizeCtx) { d.value.updated = new Date().toISOString(); dirty.value = true; resizeCtx = null }
}

// derive the builder's `type` descriptor from an existing tile
function typeForTile(t) {
  if (t.type === 'kpi') return { id: 'kpi', label: 'KPI', type: 'kpi', kind: null }
  if (t.type === 'shortcut') return { id: 'shortcut', label: 'Shortcut', type: 'shortcut', kind: null }
  const kind = t.chart?.kind || 'bar'
  const label = kind === 'line' ? 'Line' : kind === 'donut' ? 'Pie' : 'Bar'
  return { id: kind, label, type: 'chart', kind }
}

// After a widget is created, smooth-scroll to it (it's appended last) + briefly highlight.
function onWidgetCreated(id) {
  showAdd.value = false
  nextTick(() => {
    const el = document.querySelector(`[data-tile="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightId.value = id
    setTimeout(() => { if (highlightId.value === id) highlightId.value = null }, 1800)
  })
}

// Loading + reveal + (for a brand-new empty board) auto-open Add-Widget.
// Runs on mount AND on every dashboard switch — the route component is reused across
// param changes, so onMounted alone wouldn't fire for a freshly-created board.
function loadBoard() {
  loadingBoard.value = true
  selTileId.value = null
  recordView(d.value)
  setTimeout(() => {
    loadingBoard.value = false
    revealing.value = true                              // widgets fade/slide in with staggered data
    setTimeout(() => (revealing.value = false), 1100)
    if (store.ui.pendingAddWidget) {                    // new empty board → slide Add-Widget in smoothly
      store.ui.pendingAddWidget = false; addToGroup.value = null
      setTimeout(() => (showAdd.value = true), 260)
    }
  }, 600)
}
onMounted(loadBoard)
watch(() => route.params.id, loadBoard)

// ---- Undo / Redo (dashboard tiles + groups history) ----
const undoStack = ref([])
const redoStack = ref([])
let applyingHistory = false, lastBoardId = null
const boardSnap = () => JSON.stringify({ tiles: d.value?.tiles || [], groups: d.value?.groups || [] })
watch(boardSnap, (val, oldVal) => {
  if (applyingHistory) return
  // immediate:true → first call (setup) and any dashboard switch just (re)binds this board's history
  if (d.value?.id !== lastBoardId) { lastBoardId = d.value?.id; undoStack.value = []; redoStack.value = []; return }
  undoStack.value.push(oldVal)
  if (undoStack.value.length > 60) undoStack.value.shift()
  redoStack.value = []
}, { immediate: true })
const canUndo = computed(() => undoStack.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)
function applySnap(json) {
  const s = JSON.parse(json)
  applyingHistory = true
  d.value.tiles = s.tiles; d.value.groups = s.groups
  d.value.updated = new Date().toISOString(); dirty.value = true
  nextTick(() => { applyingHistory = false })
}
function undo() { if (!canUndo.value) return; redoStack.value.push(boardSnap()); applySnap(undoStack.value.pop()); toast('Undo') }
function redo() { if (!canRedo.value) return; undoStack.value.push(boardSnap()); applySnap(redoStack.value.pop()); toast('Redo') }
function onKey(e) {
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo() }
  else if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ---- selectable tiles: click to select → floating action toolbar; click-away deselects ----
const selTileId = ref(null)
function onSelectTile(t) { selTileId.value = t.id }
function onDocDown(e) {
  if (e.target.closest('.cell.selected') || e.target.closest('.sel-bar') || e.target.closest('.tile-menu')) return
  selTileId.value = null
}
watch(selTileId, (id) => {
  if (id) setTimeout(() => document.addEventListener('mousedown', onDocDown), 0)
  else document.removeEventListener('mousedown', onDocDown)
})
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown))

function onRemove(t) { removeTile(d.value, t); dirty.value = true }
// Open the builder pre-filled with this tile, in edit mode (with live preview).
function onEditTile(t) { editTile.value = t }
function onTileSaved({ id, place }) {
  editTile.value = null
  toast('Widget updated', 'success')
  nextTick(() => {
    if (place) document.querySelector(`[data-tile="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightId.value = id
    setTimeout(() => { if (highlightId.value === id) highlightId.value = null }, 1500)
  })
}
// Duplicate → open the builder pre-filled with the tile so the user can reconfigure
// the copy's data, then clone it in place (inserted right after the original).
function onDuplicate(t) { dupTile.value = t }
function onTileDuplicated({ tile, afterId }) {
  const i = d.value.tiles.findIndex((x) => x.id === afterId)
  d.value.tiles.splice(i < 0 ? d.value.tiles.length : i + 1, 0, tile)
  d.value.updated = new Date().toISOString()
  dupTile.value = null
  dirty.value = true
  nextTick(() => {
    document.querySelector(`[data-tile="${tile.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightId.value = tile.id
    setTimeout(() => { if (highlightId.value === tile.id) highlightId.value = null }, 1500)
  })
  toast(`Duplicated “${tile.title}”`, 'success')
}
function saveEdit() { dirty.value = false; edit.value = false; toast('Layout saved', 'success') }
function discard() { if (dirty.value && !confirm('Discard unsaved changes?')) return; dirty.value = false; edit.value = false }
</script>

<template>
  <div v-if="d" class="board" :style="boardVars">
    <!-- Header -->
    <header class="bhead">
      <div class="bh-left">
        <button class="star" :class="{ on: d.favorite }" @click="toggleFavorite(d)"><Icon :name="d.favorite ? 'star-fill' : 'star'" :size="17" /></button>
        <div class="titles">
          <div class="t-row">
            <h1>{{ d.name }}</h1>
            <span v-if="d.description || d.default" class="dinfo" @mouseenter="descHover = true" @mouseleave="descHover = false">
              <Icon name="info" :size="15" />
              <transition name="fade">
                <span v-if="descHover" class="tt dinfo-tt">
                  <span v-if="d.default" class="def-tag"><Icon name="default-home" :size="12" /> Default dashboard</span>
                  <span v-if="d.description" class="dinfo-desc">{{ d.description }}</span>
                </span>
              </transition>
            </span>
            <!-- Only Restricted dashboards show an access indicator; click it for the technician fields -->
            <div v-if="d.access === 'restricted'" class="acc-wrap">
              <button class="restrict-ic" @click.stop="restrictOpen = !restrictOpen" title="Restricted access"><Icon name="users" :size="15" /></button>
              <div v-if="restrictOpen" class="backdrop" @click="restrictOpen = false" />
              <transition name="pop">
                <div v-if="restrictOpen" class="restrict-pop card" @click.stop>
                  <div class="ap-h"><Icon name="users" :size="14" /> Restricted — who can access</div>
                  <div class="ap-sec">
                    <label>Technician Access Level</label>
                    <div class="ap-chips"><span v-for="t in d.techAccess" :key="t" class="chip sm"><Icon name="user" :size="11" /> {{ t }}</span><span v-if="!d.techAccess.length" class="muted small">None</span></div>
                  </div>
                  <div class="ap-sec">
                    <label>Technician Group Access Level</label>
                    <div class="ap-chips"><span v-for="g in d.groupAccess" :key="g" class="chip sm"><Icon name="users" :size="11" /> {{ g }}</span><span v-if="!d.groupAccess.length" class="muted small">None</span></div>
                  </div>
                  <button class="ap-edit" @click="restrictOpen = false; showShare = true"><Icon name="edit" :size="13" /> Manage access &amp; sharing</button>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </div>
      <div class="bh-right">
        <div class="udr">
          <button class="udr-b" :disabled="!canUndo" @click="undo"><Icon name="undo" :size="17" /><span class="udr-tip">Undo <kbd>Ctrl + Z</kbd></span></button>
          <button class="udr-b" :disabled="!canRedo" @click="redo"><Icon name="redo" :size="17" /><span class="udr-tip">Redo <kbd>Ctrl + Y</kbd></span></button>
        </div>
        <span class="vsep" />
        <TimeFilter />
        <AutoRefresh />
        <span class="vsep" />
        <div class="pop-wrap">
          <button class="btn ico-only" :class="{ on: sharePop }" @click.stop="sharePop = !sharePop" title="Share / Export"><Icon name="share" :size="17" /></button>
          <SharePopover v-if="sharePop" :d="d" @close="sharePop = false" />
        </div>
        <div class="pop-wrap">
          <button class="btn ico-only" :class="{ on: showDownload }" @click.stop="showDownload = !showDownload" title="Download"><Icon name="download" :size="17" /></button>
          <DownloadDialog v-if="showDownload" :d="d" @close="showDownload = false" />
        </div>
        <DashboardMenu :d="d" align="right" @present="presenting = true" @schedule="showSchedule = true" @history="showHistory = true" />
      </div>
    </header>

    <!-- Edit banner (unsaved-changes guard, P2·4) -->
    <transition name="fade">
      <div v-if="edit" class="editbar">
        <Icon name="edit" :size="15" /> <b>Editing</b> — drag, add or remove tiles.
        <span v-if="dirty" class="unsaved">● Unsaved changes</span>
        <div class="grow" />
        <button class="btn btn-sm" @click="discard">Discard</button>
        <button class="btn btn-sm btn-primary" @click="saveEdit"><Icon name="check" :size="14" /> Save</button>
      </div>
    </transition>

    <!-- Body -->
    <div class="bbody">
      <!-- DEMO: switch between the 5 grouping designs to compare them live (hidden — default is ① Select) -->
      <div v-if="showGroupDemo && !loadingBoard" class="gstyle-bar">
        <span class="gsb-label"><Icon name="template" :size="14" /> Grouping demo</span>
        <div class="gsb-seg">
          <button v-for="s in GSTYLES" :key="s.id" class="gsb-b" :class="{ on: gs === s.id }" :title="s.desc" @click="store.ui.groupStyle = s.id">
            <span class="gsb-n">{{ s.n }}</span> {{ s.label }}
          </button>
        </div>
        <span class="gsb-desc">{{ GSTYLES.find(s => s.id === gs)?.desc }}</span>
      </div>

      <!-- DEMO: the 5 ways to handle a high-cardinality legend. Affects "Tickets by Technician" (63 values). -->
      <div v-if="showLegendDemo && !loadingBoard" class="gstyle-bar legend-bar">
        <span class="gsb-label"><Icon name="chart-pie" :size="14" /> Legend demo <em>63-category chart</em></span>
        <div class="gsb-seg">
          <button v-for="s in LSTYLES" :key="s.id" class="gsb-b" :class="{ on: ls === s.id }" :title="s.desc" @click="store.ui.legendStyle = s.id">
            <span class="gsb-n">{{ s.n }}</span> {{ s.label }}
          </button>
        </div>
        <span class="gsb-desc">{{ LSTYLES.find(s => s.id === ls)?.desc }}</span>
      </div>

      <!-- loading skeleton (P2·9) -->
      <div v-if="loadingBoard" class="grid">
        <div v-for="n in 6" :key="n" class="card sk" :class="n <= 4 ? 'span-3' : 'span-6'"><div class="skeleton" style="height:100%" /></div>
      </div>

      <!-- empty state → template gallery (P2·9, P3·tour, ClickUp pattern) -->
      <div v-else-if="!d.tiles.length && !(d.groups && d.groups.length)" class="empty">
        <div class="empty-ill">
          <span class="ei ei-chart"><Icon name="chart-bar" :size="26" /></span>
          <span class="ei ei-kpi"><Icon name="kpi" :size="22" /></span>
          <span class="ei ei-tbl"><Icon name="table" :size="22" /></span>
        </div>
        <h3>Your dashboard is empty</h3>
        <p>Add a <b>Widget</b>, <b>KPI</b> or <b>Shortcut</b> to start visualizing your data.</p>
        <div class="empty-cta">
          <button class="btn btn-primary big-cta" @click="showAdd = true"><Icon name="plus" :size="17" /> Add Widget</button>
          <button v-if="gShowEmptyGroupCta" class="btn big-cta ghost" @click="addEmptyGroup"><Icon name="new-group" :size="16" /> or create a group</button>
        </div>
      </div>

      <!-- tiles (ungrouped + collapsible groups) — drag a box anywhere to marquee-select -->
      <div v-else class="board-groups" ref="gridEl" :class="{ selecting, revealing }" @mousedown="boardMouseDown">
        <div v-if="gShowTip || gShowAddGroupBtn || gRightClick || gHoverIcon || gAutoBy" class="bg-toolbar">
          <span v-if="gShowTip && tilesIn(null).length" class="bg-hint">Tip: drag a box (or Shift-click) across widgets to group them</span>
          <span v-if="gRightClick" class="bg-hint">Right-click any widget → New group / Add to group</span>
          <span v-if="gHoverIcon" class="bg-hint">Hover a widget and click its ⊞ chip → New group / Add to group</span>
          <template v-if="gAutoBy">
            <span class="bg-hint">Auto-group by</span>
            <div class="auto-seg">
              <button v-for="o in AUTO_OPTS" :key="o.value" class="auto-b" :class="{ on: autoBy === o.value }" @click="autoBy = o.value">{{ o.label }}</button>
            </div>
          </template>
          <button v-if="gShowAddGroupBtn" class="add-group" @click="addEmptyGroup"><Icon name="new-group" :size="15" /> Add group</button>
        </div>

        <!-- G: auto-grouped, read-only derived sections -->
        <template v-if="gAutoBy && derivedGroups">
          <section v-for="grp in derivedGroups" :key="grp.name" class="group as-section">
            <header class="grp-head"><Icon name="template" :size="15" class="sec-ic" /><b class="grp-name">{{ grp.name }}</b><span class="grp-count">{{ grp.tiles.length }}</span></header>
            <div class="grid" :style="gridStyle">
              <div v-for="t in grp.tiles" :key="t.id" :data-tile="t.id" class="cell" :style="cellStyle(t)">
                <WidgetCard :tile="t" :edit="edit" @remove="onRemove" @edit="onEditTile" @duplicate="onDuplicate" @pin="onPin" @armdrag="armDrag" />
              </div>
            </div>
          </section>
        </template>

        <template v-else>
        <!-- ungrouped (inline style overlays a hover "+ New group here" inserter in each row gap) -->
        <div v-if="tilesIn(null).length" class="ug-wrap">
          <div class="grid" ref="ugGridEl" :style="gridStyle" :class="{ 'drop-into': dropGroup === null }"
            @dragover.prevent="dropGroup = null" @drop="onDropGroup(null)">
            <div v-for="t in tilesIn(null)" :key="t.id" :data-tile="t.id" class="cell"
              :class="{ flash: highlightId === t.id, dragging: dragId === t.id, 'pick-on': groupPicks.has(t.id), selected: selTileId === t.id }" :style="cellStyle(t)" :draggable="dragArmed === t.id && !selecting"
              @dragstart="onDragStart(t)" @dragend="onDragEnd" @dragover.prevent @drop.stop.prevent="onDropTile(t)" @contextmenu="onCellContext(t, $event)">
              <WidgetCard :tile="t" :edit="edit" :selected="selTileId === t.id" @select="onSelectTile" @remove="onRemove" @edit="onEditTile" @duplicate="onDuplicate" @pin="onPin" @armdrag="armDrag" />
              <span class="resize" title="Drag to resize" @mousedown.stop.prevent="startResize($event, t)" />
              <button v-if="gHoverIcon" class="cell-grp-chip" title="Group this widget" @click.stop="openTileMenu(t, $event)"><Icon name="new-group" :size="13" /> Group</button>
            </div>
          </div>
          <!-- inline: hover a row gap to reveal a "+ New group here" inserter -->
          <template v-if="gShowRowInserters">
            <div v-for="(y, i) in rowGaps" :key="'rg' + i" class="row-insert" :style="{ top: y + 'px' }" @click.stop="addEmptyGroup">
              <span class="gi-line" /><span class="gi-btn"><Icon name="new-group" :size="13" /> New group here</span><span class="gi-line" />
            </div>
          </template>
        </div>

        <!-- groups (each preceded by a hover-reveal "+ New group here" inserter) -->
        <template v-for="(g, gi) in (d.groups || [])" :key="g.id">
        <div v-if="gShowInserters" class="grp-insert" @click.stop="insertEmptyGroup(gi)"><span class="gi-line" /><span class="gi-btn"><Icon name="new-group" :size="13" /> New group here</span><span class="gi-line" /></div>
        <section class="group" :class="{ 'drop-into': dropGroup === g.id, 'as-section': gSections }"
          @dragover.prevent="dropGroup = g.id" @drop="onDropGroup(g.id)">
          <header class="grp-head">
            <button class="grp-toggle" @click="g.collapsed = !g.collapsed"><Icon :name="g.collapsed ? 'chevron-right' : 'chevron-down'" :size="16" /></button>
            <input v-if="editingGroup === g.id" class="grp-name-input" v-model="g.name" @blur="editingGroup = null" @keyup.enter="editingGroup = null" />
            <b v-else class="grp-name" @click="editingGroup = g.id">{{ g.name }}</b>
            <span class="grp-count">{{ tilesIn(g.id).length }}</span>
            <div class="grow" />
            <button v-if="tilesIn(g.id).length" class="grp-add" title="Add widget to this group" @click="addWidgetToGroup(g.id)"><Icon name="plus" :size="14" /> Add widget</button>
            <button class="grp-act" title="Ungroup" @click="ungroup(g)"><Icon name="ungroup" :size="15" /></button>
          </header>
          <div v-if="!g.collapsed" class="grid" :style="gridStyle">
            <div v-for="t in tilesIn(g.id)" :key="t.id" :data-tile="t.id" class="cell"
              :class="{ flash: highlightId === t.id, dragging: dragId === t.id, selected: selTileId === t.id }" :style="cellStyle(t)" :draggable="dragArmed === t.id"
              @dragstart="onDragStart(t)" @dragend="onDragEnd" @dragover.prevent @drop.stop.prevent="onDropTile(t)" @contextmenu="onCellContext(t, $event)">
              <WidgetCard :tile="t" :edit="edit" :selected="selTileId === t.id" @select="onSelectTile" @remove="onRemove" @edit="onEditTile" @duplicate="onDuplicate" @pin="onPin" @armdrag="armDrag" />
              <span class="resize" title="Drag to resize" @mousedown.stop.prevent="startResize($event, t)" />
              <button v-if="gHoverIcon" class="cell-grp-chip" title="Group this widget" @click.stop="openTileMenu(t, $event)"><Icon name="new-group" :size="13" /> Group</button>
            </div>
            <div v-if="!tilesIn(g.id).length" class="grp-empty">
              <p>No widgets yet — drag one here, or</p>
              <button class="btn btn-sm btn-primary" @click="addWidgetToGroup(g.id)"><Icon name="plus" :size="14" /> Add widget</button>
            </div>
          </div>
        </section>
        </template>
        <div v-if="gShowInserters && (d.groups || []).length" class="grp-insert" @click.stop="insertEmptyGroup((d.groups || []).length)"><span class="gi-line" /><span class="gi-btn"><Icon name="new-group" :size="13" /> New group here</span><span class="gi-line" /></div>
        <!-- F: a slim full-width "+ New section" bar (sections are typed headings) -->
        <button v-if="gSections" class="new-section-bar" @click="addEmptyGroup"><Icon name="new-group" :size="15" /> New section</button>
        </template>
      </div>
    </div>

    <!-- per-tile group menu (B: right-click · E: hover chip) -->
    <teleport to="body">
      <div v-if="tileMenu.open" class="backdrop" @click="closeTileMenu" />
      <transition name="pop">
        <div v-if="tileMenu.open" class="menu tile-grp-menu" :style="{ top: tileMenu.top + 'px', left: tileMenu.left + 'px' }" @click.stop>
          <button class="menu-item" @click="tileNewGroup(tileMenu.tile)"><Icon name="new-group" :size="15" /> New group with this</button>
          <template v-if="(d.groups || []).length">
            <div class="menu-sep" />
            <div class="menu-label">Add to group</div>
            <button v-for="g in d.groups" :key="g.id" class="menu-item" @click="tileToGroup(tileMenu.tile, g.id)"><Icon name="folder" :size="15" /> {{ g.name }}</button>
          </template>
          <template v-if="tileMenu.tile && tileMenu.tile.group">
            <div class="menu-sep" />
            <button class="menu-item danger" @click="tileUngroup(tileMenu.tile)"><Icon name="ungroup" :size="15" /> Remove from group</button>
          </template>
        </div>
      </transition>
    </teleport>

    <!-- rubber-band selection rectangle (fixed to viewport) -->
    <teleport to="body">
      <div v-if="marquee.active" class="marquee" :style="{ left: marquee.l + 'px', top: marquee.t + 'px', width: marquee.w + 'px', height: marquee.h + 'px' }" />
    </teleport>

    <!-- post-release confirm CTA (bottom-right) → convert the selected widgets into a group -->
    <teleport to="body">
      <transition name="fabpop">
        <div v-if="showGroupCta && groupPicks.size" class="group-cta">
          <span class="gc-count"><Icon name="new-group" :size="16" /> {{ groupPicks.size }} widget{{ groupPicks.size > 1 ? 's' : '' }} selected</span>
          <button class="btn btn-sm" @click="clearPicks">Cancel</button>
          <button class="btn btn-sm btn-primary" @click="createGroupFromPicks"><Icon name="check" :size="14" /> Create group</button>
        </div>
      </transition>
    </teleport>

    <!-- Floating Add FAB (bottom-right) → slide-up: Create Dashboard / Create Widget -->
    <div class="fab-wrap">
      <div v-if="fabMenu" class="fab-backdrop" @click="fabMenu = false" />
      <transition name="fabpop">
        <div v-if="fabMenu" class="fab-menu">
          <button class="fab-opt" @click="fabMenu = false; store.ui.cloneTarget = null; store.ui.editTarget = null; store.ui.createOpen = true">
            <span class="fo-ic dash"><Icon name="layout" :size="18" /></span> Create Dashboard
          </button>
          <button class="fab-opt" @click="fabMenu = false; addToGroup = null; showAdd = true">
            <span class="fo-ic wid"><Icon name="chart-bar" :size="18" /></span> Create Widget
          </button>
          <button v-if="gShowFabGroup" class="fab-opt" @click="fabMenu = false; addEmptyGroup()">
            <span class="fo-ic grp"><Icon name="new-group" :size="18" /></span> Empty Group
          </button>
        </div>
      </transition>
      <button class="fab" :class="{ on: fabMenu }" @click="fabMenu = !fabMenu" title="Add"><Icon name="plus" :size="26" /></button>
    </div>

    <AddWidgetModal v-if="showAdd" :d="d" :group="addToGroup" @close="showAdd = false; addToGroup = null" @created="onWidgetCreated" @newgroup="onNewGroup" />
    <WidgetBuilderModal v-if="editTile" :d="d" :type="typeForTile(editTile)" :existing="editTile" @close="editTile = null" @saved="onTileSaved" />
    <!-- Duplicate: builder pre-filled with the tile; save creates a new copy in place -->
    <WidgetBuilderModal v-if="dupTile" :d="d" :type="typeForTile(dupTile)" :existing="dupTile" :duplicate="true" @close="dupTile = null" @duplicated="onTileDuplicated" />
    <ShareDialog v-if="showShare" :d="d" @close="showShare = false" />
    <ScheduleDialog v-if="showSchedule" :d="d" @close="showSchedule = false" />
    <HistoryDialog v-if="showHistory" :d="d" @close="showHistory = false" />
    <PresentMode v-if="presenting" :start-id="d.id" @close="presenting = false" />
  </div>

  <div v-else class="missing">
    <Icon name="search" :size="28" class="muted" />
    <p>Dashboard not found.</p>
    <button class="btn" @click="router.push('/dashboards')">Back to Discover</button>
  </div>
</template>

<style scoped>
.board { display: flex; flex-direction: column; min-height: 100%; }
.bhead { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 24px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: nowrap; }
.bh-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.star { width: 34px; height: 34px; border-radius: 9px; border: none; background: transparent; color: var(--muted); display: grid; place-items: center; }
.star:hover, .star.on { color: #f5a623; }
.titles { min-width: 0; }
.t-row { display: flex; align-items: center; gap: 9px; }
.t-row h1 { margin: 0; font-size: 19px; letter-spacing: -.3px; }
.acc-wrap { position: relative; }
.dinfo { position: relative; color: var(--muted-2); display: inline-grid; place-items: center; cursor: help; }
.dinfo:hover { color: var(--primary); }
.dinfo-tt { top: 26px; left: -8px; width: 260px; }
.def-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #cfc6ff; background: rgba(255,255,255,.1); border-radius: 5px; padding: 2px 7px; margin-bottom: 6px; }
.dinfo-desc { display: block; }
/* restricted → click the icon to see technician + group access */
.restrict-ic { display: inline-grid; place-items: center; width: 28px; height: 26px; border: 1px solid var(--border-strong); background: var(--surface); border-radius: 7px; color: var(--amber); cursor: pointer; }
.restrict-ic:hover { background: var(--amber-soft); border-color: transparent; }
.restrict-pop { position: absolute; top: 34px; left: 0; z-index: 60; width: 300px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.backdrop { position: fixed; inset: 0; z-index: 55; }
.ap-h { display: flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13px; }
.ap-sec label { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted-2); font-weight: 600; margin-bottom: 7px; }
.ap-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ap-chips .chip.sm { height: 22px; font-size: 11.5px; padding: 0 8px; }
.small { font-size: 12px; }
.ap-desc { margin: 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.5; }
.ap-edit { display: flex; align-items: center; gap: 7px; justify-content: center; border: 1px solid var(--border-strong); background: var(--surface); border-radius: 8px; padding: 7px; font-weight: 500; font-size: 12.5px; color: var(--ink-2); }
.ap-edit:hover { background: var(--surface-2); }
.bh-right { display: flex; align-items: center; gap: 8px; flex: none; }
.titles { min-width: 0; }
.t-row h1 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 360px; }
.vsep { width: 1px; height: 24px; background: var(--border); margin: 0 2px; }
/* undo / redo with instant hover tooltip */
.udr { display: inline-flex; gap: 2px; }
.udr-b { position: relative; width: 34px; height: 34px; border: 1px solid var(--border); background: var(--surface); color: var(--ink-2); border-radius: 8px; display: grid; place-items: center; }
.udr-b:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
.udr-b:disabled { color: var(--muted); opacity: .85; cursor: not-allowed; }
.udr-tip { position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); background: #20223a; color: #fff; font-size: 11.5px; white-space: nowrap; padding: 5px 9px; border-radius: 7px; display: none; align-items: center; gap: 6px; z-index: 60; box-shadow: var(--sh-pop); }
.udr-b:hover .udr-tip { display: inline-flex; }
.udr-tip kbd { font-family: inherit; font-size: 10.5px; background: rgba(255,255,255,.16); border-radius: 4px; padding: 1px 5px; }
.btn.ico-only { width: 38px; padding: 0; justify-content: center; }
.btn.ico-only.on { background: var(--primary-soft); color: var(--primary-700); border-color: transparent; }
.pop-wrap { position: relative; }
.editbar { display: flex; align-items: center; gap: 9px; padding: 9px 24px; background: var(--primary-softer); border-bottom: 1px solid var(--primary-soft); color: var(--primary-700); font-size: 13px; }
.unsaved { color: var(--amber); font-weight: 600; font-size: 12px; }
.bbody { flex: 1; padding: 16px 24px 28px; }
.grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 14px; align-items: start; }
.cell { position: relative; border-radius: var(--r-lg); display: flex; flex-direction: column; }
/* minimal highlight on a just-added widget */
.cell.flash { animation: flash 1.8s ease-out; }
.cell.flash :deep(.tile) { border-color: var(--primary); }
@keyframes flash {
  0% { box-shadow: 0 0 0 3px var(--primary-soft), 0 0 0 1px var(--primary); }
  60% { box-shadow: 0 0 0 3px var(--primary-soft), 0 0 0 1px var(--primary); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.span-3 { grid-column: span 3; } .span-6 { grid-column: span 6; } .span-4 { grid-column: span 4; } .span-12 { grid-column: span 12; }
.cell > :deep(.tile) { flex: 1; min-height: 0; }
.sk { min-height: 140px; padding: 10px; } .sk.span-6 { min-height: 248px; }
/* drag-reorder states */
.cell.dragging { opacity: .4; }
.cell.dropzone { outline: 2px dashed var(--primary); outline-offset: 2px; border-radius: var(--r-lg); }
/* bottom-right resize grip (two diagonal lines), revealed on hover */
.resize { position: absolute; right: 3px; bottom: 3px; width: 17px; height: 17px; z-index: 6; cursor: nwse-resize; opacity: 0; transition: opacity .14s; border-radius: 0 0 6px 0;
  background: linear-gradient(135deg, transparent 0 42%, var(--muted) 42% 52%, transparent 52% 66%, var(--muted) 66% 76%, transparent 76%); }
.cell:hover .resize, .cell.selected .resize { opacity: .9; }
.resize:hover { opacity: 1; }
.cell.selected { overflow: visible; }
/* staggered widget reveal after the loading skeleton */
.revealing .cell { animation: cellReveal .5s cubic-bezier(.2,.8,.2,1) backwards; }
.revealing .cell:nth-child(2) { animation-delay: .05s; }
.revealing .cell:nth-child(3) { animation-delay: .1s; }
.revealing .cell:nth-child(4) { animation-delay: .15s; }
.revealing .cell:nth-child(5) { animation-delay: .2s; }
.revealing .cell:nth-child(6) { animation-delay: .25s; }
.revealing .cell:nth-child(7) { animation-delay: .3s; }
.revealing .cell:nth-child(n+8) { animation-delay: .35s; }
@keyframes cellReveal { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
/* widget groups (collapsible rows) */
.board-groups { display: flex; flex-direction: column; gap: 16px; }
.group { border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface-2); padding: 6px 12px 14px; transition: box-shadow .15s, border-color .15s; }
.group.drop-into, .grid.drop-into { border: 1px solid var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); border-radius: var(--r-lg); }
.grid.drop-into { padding: 4px; }
.grp-head { display: flex; align-items: center; gap: 8px; padding: 6px 2px 12px; }
.grp-toggle { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; }
.grp-toggle:hover { background: var(--surface); }
.grp-name { font-weight: 600; font-size: 14px; cursor: text; }
.grp-name-input { font-weight: 600; font-size: 14px; border: 1px solid var(--primary); border-radius: 6px; padding: 2px 8px; outline: none; box-shadow: 0 0 0 3px var(--primary-soft); }
.grp-count { font-size: 11.5px; font-weight: 600; color: var(--muted); background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 1px 8px; }
.grp-act { width: 28px; height: 28px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.grp-act:hover { background: var(--surface); color: var(--ink); }
.grp-act[title="Ungroup"]:hover { background: var(--red-soft); color: var(--red); }
.grp-add { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--primary-700); border-radius: 7px; font-weight: 500; font-size: 12px; }
.grp-add:hover { background: var(--primary-soft); border-color: transparent; }
.grp-empty { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px; color: var(--muted-2); font-size: 12.5px; border: 1px dashed var(--border-strong); border-radius: 10px; }
.grp-empty p { margin: 0; }
/* grouping-style demo switcher */
.gstyle-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 8px 12px; margin-bottom: 14px; background: var(--surface); border: 1px dashed var(--border-strong); border-radius: 10px; }
.legend-bar .gsb-label em { font-style: normal; font-weight: 500; color: var(--muted); font-size: 11px; margin-left: 4px; }
.gsb-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--muted); }
.gsb-seg { display: inline-flex; gap: 3px; background: var(--surface-2); padding: 3px; border-radius: 9px; border: 1px solid var(--border); }
.gsb-b { border: none; background: transparent; padding: 5px 11px; border-radius: 7px; font-size: 12.5px; font-weight: 500; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; }
.gsb-b:hover { color: var(--ink); }
.gsb-b.on { background: var(--surface); color: var(--primary-700); box-shadow: var(--sh-sm); font-weight: 600; }
.gsb-n { font-size: 13px; }
.gsb-desc { font-size: 12px; color: var(--muted-2); margin-left: auto; }
@media (max-width: 720px) { .gsb-desc { display: none; } }
.bg-toolbar { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
/* ⑨ auto-group: segmented "Group by" control */
.auto-seg { display: inline-flex; gap: 3px; background: var(--surface-2); padding: 3px; border-radius: 8px; border: 1px solid var(--border); }
.auto-b { border: none; background: transparent; padding: 4px 12px; border-radius: 6px; font-size: 12.5px; font-weight: 500; color: var(--muted); }
.auto-b.on { background: var(--surface); color: var(--primary-700); box-shadow: var(--sh-sm); font-weight: 600; }
/* ⑧ sections / ⑨ auto: render groups as borderless headings instead of boxed containers */
.group.as-section { border: none; background: transparent; padding: 0; box-shadow: none; margin-bottom: 6px; }
.group.as-section > .grp-head { border-bottom: 1.5px solid var(--border); border-radius: 0; padding: 4px 2px 8px; background: transparent; }
.group.as-section .sec-ic { color: var(--primary); }
.group.as-section > .grid { padding: 12px 0 4px; }
.new-section-bar { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 12px; padding: 9px; border: 1px dashed var(--border-strong); background: transparent; border-radius: 9px; color: var(--primary-700); font-weight: 600; font-size: 12.5px; }
.new-section-bar:hover { background: var(--primary-softer); border-color: var(--primary); }
/* ⑦ per-widget group chip (hover-reveal, bottom-left, out of the header actions' way) */
.cell-grp-chip { position: absolute; left: 10px; bottom: 8px; z-index: 7; display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 11px; border: 1px solid var(--primary-soft); background: var(--surface); color: var(--primary-700); border-radius: 999px; font-size: 11.5px; font-weight: 600; box-shadow: var(--sh-sm); opacity: 0; transition: opacity .14s; }
.cell:hover .cell-grp-chip { opacity: 1; }
.cell-grp-chip:hover { background: var(--primary-softer); border-color: var(--primary); }
/* ⑥/⑦ tile group menu */
.tile-grp-menu { position: fixed; z-index: 140; min-width: 200px; max-height: 320px; overflow: auto; }
.menu-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted-2); font-weight: 600; padding: 4px 10px 2px; }
/* inline (③): hover-reveal "+ New group here" inserter in each ungrouped row gap */
.ug-wrap { position: relative; }
.row-insert { position: absolute; left: 0; right: 0; height: 16px; transform: translateY(-50%); display: flex; align-items: center; gap: 10px; cursor: pointer; opacity: 0; transition: opacity .14s; z-index: 8; }
.row-insert:hover { opacity: 1; }
.bg-hint { margin-right: auto; font-size: 12px; color: var(--muted-2); }
/* hover-reveal "+ New group here" between group sections */
.grp-insert { display: flex; align-items: center; gap: 10px; height: 14px; margin: 2px 0; cursor: pointer; opacity: 0; transition: opacity .14s; }
.grp-insert:hover { opacity: 1; }
.gi-line { flex: 1; height: 1px; background: var(--primary-soft); }
.gi-btn { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; color: var(--primary-700); background: var(--primary-softer); border: 1px solid var(--primary-soft); border-radius: 999px; padding: 2px 10px; }
.empty-cta { display: flex; gap: 10px; align-items: center; }
.big-cta.ghost { background: transparent; color: var(--primary-700); border: 1px solid var(--border-strong); }
.big-cta.ghost:hover { background: var(--primary-softer); border-color: var(--primary); }
/* marquee (rubber-band) group selection */
.board-groups.selecting { cursor: crosshair; user-select: none; }
.board-groups.selecting :deep(.tile), .board-groups.selecting .resize { pointer-events: none; }
.cell.pick-on { outline: 2px dashed var(--primary); outline-offset: 2px; box-shadow: 0 0 0 4px var(--primary-soft); border-radius: var(--r-lg); }
.marquee { position: fixed; z-index: 300; border: 1.5px dashed var(--primary); background: rgba(61,139,208,.12); border-radius: 4px; pointer-events: none; }
/* bottom-right confirm CTA */
.group-cta { position: fixed; right: 26px; bottom: 96px; z-index: 60; display: flex; align-items: center; gap: 10px; padding: 9px 12px 9px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--sh-lg); }
.gc-count { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13px; color: var(--primary-700); }
.add-group { display: inline-flex; align-items: center; gap: 7px; border: none; background: transparent; border-radius: 9px; padding: 8px 12px; font-weight: 600; font-size: 13px; color: var(--primary-700); }
.add-group:hover { background: var(--primary-softer); }
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 64px 20px; text-align: center; }
/* illustration — a small cluster of the three tile types */
.empty-ill { display: flex; align-items: flex-end; gap: 10px; margin-bottom: 10px; }
.ei { display: grid; place-items: center; border-radius: 14px; box-shadow: var(--sh-sm); }
.ei-chart { width: 64px; height: 64px; background: var(--blue-soft); color: var(--blue); }
.ei-kpi { width: 54px; height: 54px; background: var(--primary-soft); color: var(--primary); }
.ei-tbl { width: 54px; height: 54px; background: var(--green-soft); color: var(--green); }
.empty h3 { margin: 0; font-size: 18px; } .empty p { margin: 0 0 6px; color: var(--muted); }
.empty p b { color: var(--ink-2); font-weight: 600; }
.big-cta { height: 40px; padding: 0 20px; font-size: 14px; }
.missing { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 90px; color: var(--muted); }
.fab-wrap { position: fixed; right: 26px; bottom: 26px; z-index: 40; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
.fab-backdrop { position: fixed; inset: 0; z-index: -1; }
.fab { position: relative; width: 56px; height: 56px; border-radius: 50%; border: none; background: var(--primary); color: #fff; display: grid; place-items: center; box-shadow: 0 8px 22px rgba(61,139,208,.42); transition: transform .18s, box-shadow .15s, background .15s; }
.fab:hover { background: var(--primary-600); transform: translateY(-2px) scale(1.04); box-shadow: 0 12px 28px rgba(61,139,208,.5); }
.fab:active { transform: translateY(0) scale(.98); }
.fab.on { transform: rotate(45deg); }
.fab.on:hover { transform: rotate(45deg) translateY(-2px) scale(1.04); }
/* slide-up menu above the FAB */
.fab-menu { display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
.fab-opt { display: inline-flex; align-items: center; gap: 11px; height: 46px; padding: 0 18px 0 14px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); border-radius: 999px; font-weight: 600; font-size: 13.5px; box-shadow: var(--sh-md); white-space: nowrap; }
.fab-opt:hover { background: var(--surface-2); border-color: var(--primary); color: var(--primary-700); transform: translateY(-1px); }
.fo-ic { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: #fff; flex: none; }
.fo-ic.dash { background: var(--primary); }
.fo-ic.wid { background: var(--green); }
.fo-ic.grp { background: var(--amber); }
.fabpop-enter-active { transition: opacity .2s ease, transform .22s cubic-bezier(.2,.8,.2,1); }
.fabpop-leave-active { transition: opacity .14s ease, transform .14s ease; }
.fabpop-enter-from, .fabpop-leave-to { opacity: 0; transform: translateY(16px); }
@media (max-width: 1100px) { .span-3 { grid-column: span 6; } .span-6 { grid-column: span 12; } }
</style>
