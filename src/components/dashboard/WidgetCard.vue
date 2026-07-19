<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import Icon from '../ui/Icon.vue'
import ChartTile from './ChartTile.vue'
import DataTable from './DataTable.vue'
import ShareWidgetModal from './ShareWidgetModal.vue'
import FilterMenu from '../ui/FilterMenu.vue'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import { typesFor, isFrozen, frozenReason, whyDisabled } from '../../data/chartTypes.js'
import { fieldsFrom } from '../../data/filters.js'
import { store, toast } from '../../store/index.js'
const props = defineProps({ tile: Object, edit: Boolean })
// Per-widget AI (catalog section B): a hover sparkle opens a small menu of widget-scoped
// actions; each routes into the shared assistant panel via store.ui.aiAsk. Forecast/alert
// map to explain in this prototype (the panel has no dedicated forecast block yet).
const aiBtn = ref(null)
const aiMenu = ref(false)
const aiMenuPos = ref({ top: 0, left: 0 })
const WIDGET_AI = [
  { label: 'Explain this', intent: 'explain', icon: 'bulb', t: (n) => `Explain ${n}` },
  { label: 'Why did it change?', intent: 'explain', icon: 'trend', t: (n) => `Why did ${n} change?` },
  { label: 'Show the records behind it', intent: 'drill', icon: 'table', t: (n) => `Show the records behind ${n}` },
  { label: 'Break down by team / priority', intent: 'drill', icon: 'sitemap', t: (n) => `Break down ${n} by team` },
  { label: 'Forecast the trend', intent: 'explain', icon: 'chart-line', t: (n) => `Forecast ${n}` },
  { label: 'Alert me when this crosses X', intent: 'explain', icon: 'bell', t: (n) => `Alert me when ${n} crosses a threshold` },
]
function toggleAiMenu() {
  if (aiMenu.value) { aiMenu.value = false; return }
  const r = aiBtn.value?.getBoundingClientRect()
  const W = 236
  if (r) aiMenuPos.value = { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - W - 8)) }
  aiMenu.value = true
}
function askAiWidget(chip) {
  store.ui.aiAsk = { intent: chip.intent, text: chip.t(props.tile.title) }
  aiMenu.value = false
}
const emit = defineEmits(['remove', 'edit', 'duplicate', 'armdrag', 'pin'])

// classify a table cell into a soft status/priority pill
function pillClass(v) {
  const s = String(v).toLowerCase().trim()
  if (['open', 'pending', 'to do', 'new', 'assigned'].includes(s)) return 'pill pill-blue'
  if (['in progress', 'active', 'running', 'on hold', 'watch'].includes(s)) return 'pill pill-amber'
  if (['resolved', 'closed', 'done', 'completed', 'compliant'].includes(s)) return 'pill pill-green'
  if (['expired', 'breached', 'overdue', 'failed', 'critical'].includes(s)) return 'pill pill-red'
  const m = s.match(/^p([1-4])$/)
  if (m) return 'pill pill-p' + m[1]
  return ''
}

const loading = ref(false)
const menu = ref(false)
const menuBtn = ref(null)
const menuEl = ref(null)
const menuPos = ref({ top: 0, left: 0 })
/* Submenus fly out away from the nearer screen edge, so they can't run off it. */
const subLeft = ref(true)

const MENU_W = 190   // .tile-menu min-width
const SUB_W = 178    // widest submenu (chart types)
const MENU_H = 260   // first-paint estimate; refined from the real rect below
const GAP = 6, EDGE = 8

/* The menu opens clear of the WIDGET, off the card's right edge — not just off
 * the button, or it still clips the corner of the chart it is acting on. When the
 * card sits too close to the right of the screen for that, it flips to the LEFT of
 * the ⋯ button instead. It used to be right-aligned *under* the button, which
 * dropped it straight on top of the chart. */
function placeMenu() {
  const r = menuBtn.value?.getBoundingClientRect()
  if (!r) return
  const card = cardEl.value?.getBoundingClientRect()
  const m = menuEl.value?.getBoundingClientRect()
  const w = m?.width || MENU_W
  const h = m?.height || MENU_H

  const rightAnchor = (card?.right ?? r.right) + GAP
  const fitsRight = rightAnchor + w + EDGE <= window.innerWidth
  const left = fitsRight ? rightAnchor : Math.max(EDGE, r.left - GAP - w)

  // top-align with the button, but never let a long menu run off the bottom
  const top = Math.max(EDGE, Math.min(r.top, window.innerHeight - h - EDGE))

  menuPos.value = { top, left }
  subLeft.value = window.innerWidth - (left + w) < SUB_W + GAP
}

function toggleMenu() {
  if (menu.value) { menu.value = false; exportOpen.value = false; typeOpen.value = false; return }
  menu.value = true
  placeMenu()               // estimate, so it never paints at 0,0
  nextTick(placeMenu)       // then correct it against the rendered size
}
const exportOpen = ref(false)
/* Legend visibility is a property of the WIDGET now, set in its configuration —
 * not a transient view toggle in the ⋯ menu. Undefined means on, so existing
 * tiles keep their legend without a migration. */
const showLegend = computed(() => props.tile.legend !== false)

/* Switch the chart type in place, from the tile, without reopening the builder.
 * Only Column / Bar / Line are offered — see chartTypes.js. A predefined pie is
 * frozen, so the submenu is disabled rather than empty: a disabled item with a
 * reason answers the question, an absent one just poses it.
 * The dashboard's {tiles, groups} snapshot watcher picks it up, so Ctrl+Z reverts. */
const typeOpen = ref(false)
const chartTypes = computed(() => typesFor(props.tile))
const typeFrozen = computed(() => isFrozen(props.tile))
const typeFrozenWhy = computed(() => frozenReason(props.tile))
const disabledFor = (ct) => whyDisabled(ct, props.tile.chart)
function setKind(ct) {
  if (disabledFor(ct)) return
  if (props.tile.chart.kind === ct.id) { menu.value = false; return }
  props.tile.chart.kind = ct.id
  menu.value = false; typeOpen.value = false
  toast(`“${props.tile.title}” → ${ct.label}`)
}
const EXPORTS = ['PDF', 'PNG', 'JPEG', 'SVG', 'CSV']
const searchOpen = ref(false)
const tableSearch = ref('')
/* Shortcut tables filter through the same two-level FilterMenu as the Manage-all
 * list: one icon → the columns worth filtering on → their values, multi-select.
 * The old per-column input row is gone — it made every column look filterable,
 * including the ones (ID, Subject) where every value is unique. */
const tableFilters = ref({})
const filterFields = computed(() => fieldsFrom(props.tile.columns || [], props.tile.rows || []))
const searchInput = ref(null)
watch(searchOpen, (v) => { if (v) nextTick(() => searchInput.value?.focus()) })
// row filtering + sorting now live in DataTable (TanStack); we only own the query
const present = ref(false)
const infoHover = ref(false)
const infoEl = ref(null)
const infoPos = ref({ top: 0, left: 0 })
function showInfo() {
  const r = infoEl.value?.getBoundingClientRect()
  if (r) infoPos.value = { top: r.bottom + 7, left: Math.min(r.left - 6, window.innerWidth - 256) }
  infoHover.value = true
}
// Measure the real rendered width so actions collapse as the tile is resized smaller,
// not just by column count. compact → Full screen into ⋯; tiny → Refresh + Edit + Full screen all into ⋯.
const cardEl = ref(null)
const bodyEl = ref(null)
const cardW = ref(9999)
// The chart is given the body's real height (not a fixed px band) so it tracks the
// widget size and the side legend paginates to whatever vertical space is available.
// Seed from tile.h so ECharts inits with a sane height; the observer refines it.
const chartH = ref(props.tile.h > 2 ? 340 : props.tile.h > 1 ? 168 : 120)
let ro
onMounted(() => {
  ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      if (e.target === cardEl.value) cardW.value = e.contentRect.width
      else if (e.target === bodyEl.value) { const h = Math.round(e.contentRect.height); if (h > 0) chartH.value = h }
    }
  })
  if (cardEl.value) ro.observe(cardEl.value)
  if (bodyEl.value) ro.observe(bodyEl.value)
})
onBeforeUnmount(() => ro?.disconnect())
const compact = computed(() => cardW.value < 340)
const tiny = computed(() => cardW.value < 258)
function refresh() { loading.value = true; setTimeout(() => { loading.value = false }, 750) }

// provenance: predefined tiles can't be edited or deleted (only "other" actions)
const prov = computed(() => props.tile.prov || 'user')
const PROV = {
  predefined: { label: 'Predefined' },
  user: { label: 'User-defined' },
  shared: { label: 'Shared with me' },
}
const provMeta = computed(() => PROV[prov.value] || PROV.user)
// Predefined widgets are editable (limited to Highlights + chart type in the builder)
// but can't be deleted from the dashboard.
const canEdit = computed(() => true)
/* Deletability follows WHO PUT THE TILE HERE, not who owns its definition.
 * Only a `seeded` tile — one that shipped with a predefined dashboard — is
 * undeletable. A predefined widget the user *added* to that board is theirs to
 * remove again; so is a custom one. */
const canDelete = computed(() => !props.tile.seeded)

// Empty-widget states: unconfigured vs error vs no-data vs ok (distinct copy each)
const tileState = computed(() => {
  if (props.tile.state === 'error') return 'error'
  if (props.tile.state === 'unconfigured') return 'unconfigured'
  if (props.tile.type === 'kpi') return (props.tile.value == null || props.tile.value === '') ? 'nodata' : 'ok'
  if (props.tile.type === 'chart') {
    const s = props.tile.chart?.series || []
    const total = s.flatMap((x) => x.values || []).reduce((a, b) => a + b, 0)
    return (!s.length || total === 0) ? 'nodata' : 'ok'
  }
  return (props.tile.rows || []).length ? 'ok' : 'nodata'
})
const WS = {
  nodata: { icon: 'chart-bar', title: 'No data in this range', sub: 'Try a wider time filter or different conditions.' },
  error: { icon: 'alert', title: 'Couldn’t load data', sub: 'Something went wrong fetching this tile.' },
  unconfigured: { icon: 'settings', title: 'Not configured yet', sub: 'Pick a data source to start showing data.' },
}
function retry() { loading.value = true; setTimeout(() => { props.tile.state = undefined; loading.value = false }, 800) }

function download(fmt) { menu.value = false; exportOpen.value = false; toast(`Exporting “${props.tile.title}” as ${fmt}`) }
function duplicate() { menu.value = false; emit('duplicate', props.tile) }
// deleting a widget is destructive and one click away — confirm it by name
const confirmDel = ref(false)
const shareOpen = ref(false)
// task 12: record IDs in a shortcut table are explorable → jump to their module record
const ID_MODULE = { INC: 'Requests', REC: 'Records', CNT: 'Contracts', PRB: 'Problems', CHG: 'Changes', AST: 'Assets' }
function isId(v) { return /^[A-Z]{2,4}-\d/.test(String(v).trim()) }
function exploreId(id) { const m = ID_MODULE[String(id).split('-')[0]] || 'its module'; toast(`Opening ${id} in ${m}`) }
</script>

<template>
  <div ref="cardEl" class="tile card" :class="{ ['span-' + (tile.w || 3)]: true, ['rows-' + (tile.h || 1)]: true, searching: searchOpen }">
    <!-- Standardized header: title + info (left) · refresh · fullscreen · edit · ⋯ (right).
         EVERY tile uses this. The click-to-select floating toolbar three tiles used to
         have is gone — one board should not have two different ways to reach the same
         actions, and the odd tiles out were the ones that looked broken. -->
    <header class="thead">
      <div class="left">
        <span class="draghandle" title="Drag to move" @mousedown="emit('armdrag', tile)"><Icon name="drag" :size="16" /></span>
        <span v-if="tile.pinned" class="pinbadge" title="Pinned"><Icon name="pin" :size="12" /></span>
        <span class="title ellip">{{ tile.title }}</span>
        <span ref="infoEl" class="info" @mouseenter="showInfo" @mouseleave="infoHover = false">
          <Icon name="info" :size="14" />
        </span>
      </div>
      <div class="right">
        <button v-if="!tiny" ref="aiBtn" class="ti ai" :class="{ on: aiMenu }" @click.stop="toggleAiMenu" title="Ask AI about this widget"><Icon name="sparkles" :size="15" /></button>
        <button v-if="tile.type === 'shortcut'" class="ti" :class="{ on: searchOpen }" @click="searchOpen = !searchOpen" title="Search records"><Icon name="search" :size="15" /></button>
        <FilterMenu v-if="tile.type === 'shortcut' && filterFields.length" v-model="tableFilters" :fields="filterFields" label="Filter records" class="ti-fm" />
        <button v-if="!tiny" class="ti" @click="refresh" title="Refresh"><Icon name="refresh" :size="15" :class="{ spin: loading }" /></button>
        <button v-if="!compact" class="ti" @click="present = true" title="Full screen"><Icon name="maximize-tile" :size="15" /></button>
        <button v-if="!tiny && canEdit" class="ti" @click="emit('edit', tile)" title="Edit"><Icon name="edit" :size="15" /></button>
        <div class="mwrap">
          <button ref="menuBtn" class="ti" @click.stop="toggleMenu" title="More"><Icon name="dots-v" :size="15" /></button>
        </div>
      </div>
    </header>

    <!-- per-widget AI menu (catalog section B) — teleported so it overlays the card -->
    <teleport to="body">
      <div v-if="aiMenu" class="backdrop" @click="aiMenu = false" />
      <transition name="pop">
        <div v-if="aiMenu" class="menu tile-menu ai-menu" :style="{ top: aiMenuPos.top + 'px', left: aiMenuPos.left + 'px' }" @click.stop>
          <div class="menu-label ai-lbl"><Icon name="sparkles" :size="13" /> Ask AI · {{ tile.title }}</div>
          <button v-for="c in WIDGET_AI" :key="c.label" class="menu-item" @click="askAiWidget(c)">
            <Icon :name="c.icon" :size="15" /> {{ c.label }}
          </button>
        </div>
      </transition>
    </teleport>

    <!-- info tooltip: teleported so it isn't clipped by the card's overflow -->
    <teleport to="body">
      <transition name="fade">
        <span v-if="infoHover" class="tt info-tt" :style="{ top: infoPos.top + 'px', left: infoPos.left + 'px' }">
          <b class="tt-prov">{{ provMeta.label }}</b>
          <span v-if="tile.info" class="tt-desc">{{ tile.info }}</span>
        </span>
      </transition>
    </teleport>

    <!-- ⋯ menu: teleported so it overlays the card instead of being clipped by overflow -->
    <teleport to="body">
      <div v-if="menu" class="backdrop" @click="menu = false; exportOpen = false; typeOpen = false" />
      <transition name="pop">
        <div v-if="menu" ref="menuEl" class="menu tile-menu" :class="{ 'sub-right': !subLeft }" :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }" @click.stop>
          <button v-if="tiny" class="menu-item" @click="menu = false; refresh()"><Icon name="refresh" :size="15" /> Refresh</button>
          <button v-if="tiny && canEdit" class="menu-item" @click="menu = false; emit('edit', tile)"><Icon name="edit" :size="15" /> Edit</button>
          <button v-if="compact" class="menu-item" @click="menu = false; present = true"><Icon name="maximize-tile" :size="15" /> Full screen</button>
          <button class="menu-item" @click="duplicate"><Icon name="copy" :size="15" /> Duplicate</button>
          <button class="menu-item" @click="menu = false; shareOpen = true"><Icon name="share" :size="15" /> Share widget</button>
          <!-- Chart type → submenu. Only Column / Bar / Line can be swapped for one
               another; a predefined pie is frozen, so the item is disabled with the
               reason rather than silently missing. -->
          <div
            v-if="tile.type === 'chart' && tile.chart" class="menu-item sub"
            :class="{ dis: typeFrozen }" :title="typeFrozen ? typeFrozenWhy : ''"
            @mouseenter="typeOpen = !typeFrozen; exportOpen = false" @mouseleave="typeOpen = false"
          >
            <span class="mi-l"><Icon name="chart-bar" :size="15" /> Chart type</span><Icon name="chevron-right" :size="14" class="mi-c" />
            <transition name="pop"><div v-if="typeOpen" class="submenu types">
              <button
                v-for="ct in chartTypes" :key="ct.id" class="menu-item ct"
                :class="{ on: tile.chart.kind === ct.id }"
                :disabled="!!disabledFor(ct)" :title="disabledFor(ct) || `Show as ${ct.label}`"
                @click="setKind(ct)"
              >
                <Icon :name="ct.icon" :size="16" /> {{ ct.label }}
                <Icon v-if="tile.chart.kind === ct.id" name="check" :size="14" class="ct-ck" />
              </button>
            </div></transition>
          </div>
          <!-- Export → submenu (PDF / PNG / JPEG / SVG / CSV) -->
          <div class="menu-item sub" @mouseenter="exportOpen = true; typeOpen = false" @mouseleave="exportOpen = false">
            <span class="mi-l"><Icon name="share" :size="15" /> Export</span><Icon name="chevron-right" :size="14" class="mi-c" />
            <transition name="pop"><div v-if="exportOpen" class="submenu">
              <button v-for="f in EXPORTS" :key="f" class="menu-item" @click="download(f)">{{ f }}</button>
            </div></transition>
          </div>
          <template v-if="canDelete">
            <div class="menu-sep" />
            <button class="menu-item danger" @click="menu = false; confirmDel = true"><Icon name="trash" :size="15" /> Delete card</button>
          </template>
        </div>
      </transition>
    </teleport>

    <!-- Body -->
    <div ref="bodyEl" class="tbody">
      <div v-if="loading" class="loading">
        <div class="skeleton" style="height:60%;width:80%" />
        <div class="skeleton" style="height:14px;width:50%;margin-top:10px" />
      </div>

      <!-- empty-widget states: unconfigured / error / no-data -->
      <div v-else-if="tileState !== 'ok'" class="wstate" :class="{ err: tileState === 'error' }">
        <span class="ws-ico"><Icon :name="WS[tileState].icon" :size="22" /></span>
        <b>{{ WS[tileState].title }}</b>
        <span class="ws-sub">{{ WS[tileState].sub }}</span>
        <button v-if="tileState === 'error'" class="btn btn-sm" @click="retry"><Icon name="refresh" :size="14" /> Retry</button>
        <button v-else-if="tileState === 'unconfigured' && canEdit" class="btn btn-sm btn-primary" @click="emit('edit', tile)"><Icon name="edit" :size="14" /> Configure</button>
      </div>

      <template v-else-if="tile.type === 'kpi'">
        <div class="kpi">
          <div class="kpinum">{{ tile.value }}<span v-if="tile.unit" class="unit">{{ tile.unit }}</span></div>
        </div>
      </template>

      <template v-else-if="tile.type === 'chart'">
        <ChartTile v-if="tile.chart" :chart="tile.chart" :legend="showLegend" :data-labels="tile.dataLabels === true" :height="chartH" />
      </template>

      <template v-else>
        <div class="stbl">
          <!-- search bar (toggled from the header search icon, beside Refresh) -->
          <transition name="fade">
            <div v-if="searchOpen" class="stbl-bar">
              <div class="sbox">
                <Icon name="search" :size="14" class="muted" />
                <input v-model="tableSearch" placeholder="Search records…" ref="searchInput" />
                <button class="sx" title="Close" @click="searchOpen = false; tableSearch = ''"><Icon name="x" :size="14" /></button>
              </div>
            </div>
          </transition>
          <!-- scrollable table container (sticky header); click a header to sort -->
          <div class="stbl-scroll">
            <DataTable :columns="tile.columns" :rows="tile.rows || []" :search="tableSearch" :filter-model="tableFilters" @clear-filters="tableFilters = {}">
              <template #cell="{ value }">
                <span v-if="pillClass(value)" :class="pillClass(value)">{{ value }}</span>
                <button v-else-if="isId(value)" class="id-link" @click.stop="exploreId(value)">{{ value }}</button>
                <template v-else>{{ value }}</template>
              </template>
            </DataTable>
          </div>
          <a class="viewall">View all <Icon name="chevron-right" :size="13" /></a>
        </div>
      </template>
    </div>

    <!-- Share widget: preview + screenshot-style markup + recipients -->
    <teleport to="body">
      <ShareWidgetModal v-if="shareOpen" :tile="tile" @close="shareOpen = false" />

      <ConfirmDialog
        v-if="confirmDel"
        title="Delete this widget?"
        :target="tile.title"
        message="will be removed from this dashboard. The widget stays in the library, so you can add it back."
        confirm-label="Delete widget"
        @confirm="confirmDel = false; emit('remove', tile)"
        @cancel="confirmDel = false"
      />
    </teleport>

    <!-- Present mode (single tile) -->
    <teleport to="body">
      <div v-if="present" class="overlay" @click.self="present = false">
        <div class="present">
          <div class="phead"><b>{{ tile.title }}</b><button class="btn btn-icon" @click="present = false"><Icon name="x" :size="18" /></button></div>
          <div class="pbody">
            <ChartTile v-if="tile.type === 'chart'" :chart="tile.chart" :legend="showLegend" :data-labels="tile.dataLabels === true" :height="620" />
            <div v-else-if="tile.type === 'kpi'" class="kpi big"><div class="kpinum">{{ tile.value }}<span class="unit">{{ tile.unit }}</span></div></div>
            <div v-else class="stbl big">
              <DataTable :columns="tile.columns" :rows="tile.rows || []">
                <template #cell="{ value }">
                  <span v-if="pillClass(value)" :class="pillClass(value)">{{ value }}</span>
                  <button v-else-if="isId(value)" class="id-link" @click.stop="exploreId(value)">{{ value }}</button>
                  <template v-else>{{ value }}</template>
                </template>
              </DataTable>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
/* Fill the grid cell (which sizes the footprint via min-height) so the body — and a
   fill-height chart inside it — get a real height to distribute. Without this the tile
   collapses to its header once the chart stops carrying a fixed pixel height. */
.tile { display: flex; flex-direction: column; overflow: hidden; min-height: 130px; flex: 1; }
.thead { display: flex; align-items: center; justify-content: space-between; padding: 10px 8px 2px 12px; gap: 8px; }
.left { display: flex; align-items: center; gap: 6px; min-width: 0; }
/* 6-dot drag handle — appears on hover, before the title */
.draghandle { display: inline-grid; place-items: center; color: var(--muted-2); cursor: grab; opacity: 0; transition: opacity .14s; flex: none; margin-left: -4px; }
.draghandle:active { cursor: grabbing; }
.tile:hover .draghandle { opacity: 1; }
.pinbadge { display: inline-grid; place-items: center; color: var(--primary); flex: none; transform: rotate(35deg); }
.title { font-weight: 600; font-size: var(--tile-title, 13.5px); }
/* provenance + description shown in the info-icon tooltip */
.tt-prov { display: block; font-weight: 600; color: #fff; }
.tt-desc { display: block; font-weight: 400; margin-top: 4px; color: rgba(255,255,255,.78); }
.info { position: relative; color: var(--muted-2); display: inline-grid; place-items: center; cursor: help; opacity: 0; transition: opacity .14s; }
.tile:hover .info { opacity: 1; }
.info:hover { color: var(--primary); }
.info-tt { position: fixed; z-index: 200; width: 240px; }
.right { display: flex; align-items: center; gap: 1px; opacity: 0; transition: opacity .14s; }
.tile:hover .right, .tile.searching .right { opacity: 1; }
.ti { width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; color: var(--muted); display: grid; place-items: center; }
.ti:hover { background: var(--surface-2); color: var(--ink); }
.ti.on { background: var(--primary-soft); color: var(--primary-700); }
.ti.ai { color: var(--ai); }
.ti.ai:hover, .ti.ai.on { background: var(--ai-soft); color: var(--ai-ink); }
.ai-menu { min-width: 236px; }
.ai-lbl { display: flex; align-items: center; gap: 6px; }
.ai-lbl :deep(.ico) { color: var(--ai); }
.spin { animation: sp 0.75s linear infinite; } @keyframes sp { to { transform: rotate(360deg); } }
.mwrap { position: relative; }
.backdrop { position: fixed; inset: 0; z-index: 130; }
/* teleported menu — fixed to viewport, above the card so it is never clipped */
.tile-menu { position: fixed; z-index: 140; min-width: 190px; }
.menu-item.sub { justify-content: space-between; position: relative; }
.mi-l { display: flex; align-items: center; gap: 10px; }
.mi-c { color: var(--muted); }
.submenu { position: absolute; top: -7px; right: 100%; min-width: 124px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh-pop); padding: 6px; }
/* near the left edge there is no room to fly out leftwards — go right instead */
.tile-menu.sub-right .submenu { right: auto; left: 100%; }
/* chart-type submenu: 8 items, current one checked, incompatible ones greyed */
.submenu.types { min-width: 178px; top: -80px; }
.ct { justify-content: flex-start; gap: 10px; }
.ct .ct-ck { margin-left: auto; color: var(--primary); }
.ct.on { color: var(--primary-700); font-weight: 600; }
.ct:disabled { opacity: .4; cursor: not-allowed; }
.ct:disabled:hover { background: transparent; }
/* frozen: a predefined pie/KPI/shortcut can't be recast at all */
.menu-item.sub.dis { opacity: .4; cursor: not-allowed; }
.menu-item.sub.dis:hover { background: transparent; }
.tbody { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; min-height: 0; }
.loading { flex: 1; display: flex; flex-direction: column; justify-content: center; }
/* empty-widget states */
.wstate { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 5px; color: var(--muted); padding: 14px; }
.wstate b { color: var(--ink-2); font-size: 13.5px; font-weight: 600; }
.ws-sub { font-size: 12px; max-width: 230px; line-height: 1.45; }
.ws-ico { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--surface-2); color: var(--muted); margin-bottom: 3px; }
.wstate.err .ws-ico { background: var(--red-soft); color: var(--red); }
.wstate .btn { margin-top: 9px; }
/* full-area hover: the whole numeric region (below the title) fills on hover,
   with generous padding so the highlight surrounds the number on every side */
.kpi { display: flex; flex-direction: column; justify-content: center; align-items: center; flex: 1; text-align: center; padding: 18px 16px; border-radius: 12px; background: transparent; transition: background .15s; }
.tile:hover .kpi { background: var(--surface-2); }
.kpinum { font-size: 46px; font-weight: 500; letter-spacing: -1px; line-height: 1; }
.kpinum .unit { font-size: 20px; font-weight: 600; color: var(--muted); margin-left: 3px; }
.stbl { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.stbl-bar { margin-bottom: 6px; }
.sbox { display: flex; align-items: center; gap: 7px; width: 100%; height: 30px; border: 1px solid var(--border-strong); border-radius: 8px; padding: 0 8px; background: var(--surface); }
.sbox:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.sbox input { border: none; outline: none; background: transparent; width: 100%; font-size: 12.5px; }
.sx { border: none; background: transparent; color: var(--muted); cursor: pointer; display: grid; place-items: center; padding: 0; }
.sx:hover { color: var(--ink); }
.stbl-scroll { flex: 1; overflow: auto; min-height: 0; max-height: 200px; }
/* filter row eats a row's worth of height — give it back so rows stay visible */
.stbl-scroll:has(.fltr) { max-height: 236px; }
/* table/th/td/.nodata chrome lives in DataTable.vue — scoped CSS cannot reach
   a child component's internals. Only the root <table> is styleable from here. */
table { font-size: 12.5px; }
/* soft status / priority pills in shortcut tables */
.pill { display: inline-flex; align-items: center; height: 20px; padding: 0 9px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: .2px; white-space: nowrap; }
.pill-blue { background: var(--blue-soft); color: var(--blue); }
.pill-amber { background: var(--amber-soft); color: var(--amber); }
.pill-green { background: var(--green-soft); color: var(--green); }
.pill-red { background: var(--red-soft); color: var(--red); }
.pill-p1 { background: var(--red-soft); color: var(--red); }
.pill-p2 { background: var(--amber-soft); color: var(--amber); }
.pill-p3 { background: var(--blue-soft); color: var(--blue); }
.pill-p4 { background: var(--surface-2); color: var(--muted); }
.viewall { display: inline-flex; align-items: center; gap: 3px; margin-top: 6px; color: var(--primary-700); font-weight: 600; font-size: 12px; cursor: pointer; }
/* explorable record ID (task 12) */
.id-link { border: none; background: transparent; color: var(--primary-700); font: inherit; font-weight: 600; padding: 0; cursor: pointer; }
.id-link:hover { text-decoration: underline; }
.present { background: #fff; border-radius: var(--r-xl); width: min(1200px, 95vw); max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--sh-lg); overflow: hidden; }
.phead { display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; border-bottom: 1px solid var(--border); font-size: 16px; flex: none; }
.pbody { padding: 32px 40px; flex: 1; min-height: 62vh; display: grid; place-items: center; overflow: auto; }
.pbody > * { width: 100%; }
.kpi.big { padding: 0; } .kpi.big .kpinum { font-size: 150px; } .kpi.big .kpinum .unit { font-size: 48px; }
.stbl.big { align-self: start; } .stbl.big table { font-size: 15px; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
