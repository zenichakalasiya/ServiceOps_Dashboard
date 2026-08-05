<script setup>
import { reactive, computed, ref } from 'vue'
import Icon from '../ui/Icon.vue'
import Dropdown from '../ui/Dropdown.vue'
import DateRangePicker from '../ui/DateRangePicker.vue'
import ChartTile from './ChartTile.vue'
import MeasureConditions from './MeasureConditions.vue'
import FreeTextTile from './FreeTextTile.vue'
import { store } from '../../store/index.js'
import { chart as mkChart, kpi as mkKpi, shortcut as mkShortcut, text as mkText, ACCESS } from '../../data/mock.js'
import { CONDITION_FIELD_LABELS, NUMERIC_FIELD_LABELS, AGG_FNS, MAP_FNS } from '../../data/records.js'
import { NEW_KINDS } from '../../data/chartOptions.js'
const props = defineProps({ d: Object, type: Object, existing: { type: Object, default: null }, libItem: { type: Object, default: null }, duplicate: { type: Boolean, default: false } }) // type: { id,label,type,kind }
const emit = defineEmits(['close', 'created', 'saved', 'librarySaved', 'savedToLibrary', 'duplicated'])

const ex = props.existing
// "duplicate" opens the builder pre-filled from a board tile, but saving creates a NEW copy
// (unlike edit, which mutates the original in place).
const editing = computed(() => !!props.existing && !props.duplicate)
const libMode = computed(() => !!props.libItem)   // duplicate/edit a library tile → returns to listing
const prefix = computed(() => (libMode.value ? 'Clone' : props.duplicate ? 'Duplicate' : editing.value ? 'Update' : 'Create'))
const spinning = ref(false)
function refreshPreview() { spinning.value = true; setTimeout(() => { spinning.value = false }, 650) }

// Switchable tile types — tabs above the live preview
const TYPES = [
  { id: 'line', label: 'Line', icon: 'chart-line', type: 'chart', kind: 'line' },
  { id: 'bar', label: 'Bar', icon: 'chart-bar', type: 'chart', kind: 'hbar' },
  { id: 'column', label: 'Column', icon: 'chart-bar', type: 'chart', kind: 'bar' },
  { id: 'pie', label: 'Pie', icon: 'chart-pie', type: 'chart', kind: 'donut' },
  // PMG-ACT-01 additional chart kinds (each carries its own config + engine spec)
  { id: 'stack', label: 'Stacked', icon: 'chart-stack', type: 'chart', kind: 'stack' },
  { id: 'multiline', label: 'Multi-line', icon: 'chart-multiline', type: 'chart', kind: 'multiline' },
  { id: 'combo', label: 'Combo', icon: 'chart-combo', type: 'chart', kind: 'combo' },
  { id: 'hist', label: 'Histogram', icon: 'chart-hist', type: 'chart', kind: 'hist' },
  { id: 'funnel', label: 'Funnel', icon: 'chart-funnel', type: 'chart', kind: 'funnel' },
  { id: 'heatmap', label: 'Heatmap', icon: 'chart-heatmap', type: 'chart', kind: 'heatmap' },
  { id: 'gauge', label: 'Gauge', icon: 'chart-gauge', type: 'chart', kind: 'gauge' },
  { id: 'mapbubble', label: 'Map Bubble', icon: 'chart-map', type: 'chart', kind: 'mapbubble' },
  { id: 'kpi', label: 'KPI', icon: 'kpi', type: 'kpi', kind: null },
  { id: 'shortcut', label: 'Shortcut', icon: 'table', type: 'shortcut', kind: null },
  { id: 'text', label: 'Free Text', icon: 'chart-text', type: 'text', kind: null },
]
/* Start on the tile's own tab, but keep the tile's REAL kind. The six tabs don't
 * cover every kind the ⋯ menu can produce (area, funnel, pyramid all fold into a
 * tab), and merely *opening* the builder must not silently convert an area chart
 * into a plain line. Switching type replaces the kind with the tab's canonical one. */
const baseType = TYPES.find((t) => t.id === props.type.id) || props.type
const curType = ref({ ...baseType, kind: props.type.kind ?? baseType.kind })
// Editing a predefined widget is restricted: Highlights only (plus the type swap below).
const predefinedEdit = computed(() => editing.value && ex?.prov === 'predefined')

/* ---- Which types can this widget become? --------------------------------------
 * Two independent rules:
 *
 *  1. Only Bar, Column and Line can be swapped for one another. All three plot a
 *     category axis against a value axis, so one becomes another with no
 *     reconfiguration. A Pie is part-of-whole, a KPI is a scalar, a Shortcut is a
 *     table — you can never switch INTO one of those, because the fields would have
 *     to be re-derived and there is nothing to derive them from.
 *
 *  2. A PREDEFINED widget that already IS a Pie / KPI / Shortcut is frozen: it can't
 *     be converted at all. A custom one may still leave for one of the three.
 *
 * Creating a new widget is unconstrained — you're choosing what to build.
 */
const SWITCH_IDS = ['line', 'bar', 'column']
const frozenType = computed(() => predefinedEdit.value && !SWITCH_IDS.includes(curType.value.id))

function typeBlock(t) {
  if (t.id === curType.value.id) return null                    // the current type is never blocked
  if (libMode.value || props.duplicate) return 'The type is fixed when cloning or duplicating'
  if (!editing.value) return null                               // creating: pick anything
  if (frozenType.value) return `A predefined ${curType.value.label} can’t be converted to another type`
  if (!SWITCH_IDS.includes(t.id)) return `${t.label} needs its own configuration — only Bar, Column and Line can be swapped for one another`
  return null
}

/* ---- what the row above the preview offers ------------------------------------
 * Creating, you pick a FAMILY — Widget, KPI or Shortcut. The chart kind is not a
 * family: it's a property of the Widget family, so it lives in the config panel
 * beside everything else that configures the widget.
 *
 * Editing, the row is only worth showing when something can actually be switched:
 * Bar / Column / Line, which share a data shape. A Pie, KPI, Shortcut or clone gets
 * NO row — a line of disabled tabs is a menu of things you can't have, and it only
 * invites the question "why not". The note in the config panel answers that instead.
 */
const FAMILIES = [
  { id: 'widget', label: 'Widget', icon: 'chart-bar', type: 'chart' },
  { id: 'kpi', label: 'KPI', icon: 'kpi', type: 'kpi' },
  { id: 'shortcut', label: 'Shortcut', icon: 'table', type: 'shortcut' },
  { id: 'text', label: 'Free Text', icon: 'chart-text', type: 'text' },
]
const CHART_KINDS = TYPES.filter((t) => t.type === 'chart')
// remembers which chart you were on, so leaving the Widget family and coming back
// returns you to it rather than resetting to a default
const lastChartId = ref(props.type.type === 'chart' ? props.type.id : 'column')
const editTabs = computed(() => {
  if (libMode.value || props.duplicate || !editing.value) return []
  return SWITCH_IDS.includes(curType.value.id) ? TYPES.filter((t) => SWITCH_IDS.includes(t.id)) : []
})
const showFamilies = computed(() => !editing.value && !libMode.value && !props.duplicate)
const familyOn = (f) => (f.type === 'chart' ? isChart.value : curType.value.type === f.type)
function pickFamily(f) {
  switchType(TYPES.find((t) => t.id === (f.type === 'chart' ? lastChartId.value : f.id)))
}
function pickKind(t) { lastChartId.value = t.id; switchType(t) }

const isChart = computed(() => curType.value.type === 'chart')
const isKpi = computed(() => curType.value.type === 'kpi')
const isShortcut = computed(() => curType.value.type === 'shortcut')
const isText = computed(() => curType.value.type === 'text')
const ctaLabel = computed(() => (isChart.value ? 'Widget' : curType.value.label))
function switchType(t) {
  if (typeBlock(t)) return
  if (!cfg.name || cfg.name === `New ${curType.value.label}`) cfg.name = `New ${t.label}`
  curType.value = t
}

// Manual vs Query-Based: the SQL Query field (with Tap Preview) shows for Shortcuts
// and for any Widget/KPI once the user switches to the Query Based tab.
const queryMode = computed(() => isShortcut.value || (!isShortcut.value && cfg.mode === 'query'))
const manualMode = computed(() => !isShortcut.value && cfg.mode === 'manual')

// Placeholder shown in the Query field — greyed (placeholder color), per attached spec.
const SQL_PLACEHOLDER = "SELECT id, subject, priority, status\nFROM requests\nWHERE priority = 'P1' AND status = 'open'"

// dropdown option lists
const GROUP_OPTS = ['Service Desk', 'Network Team', 'NOC Viewers']
/* Wording mirrors the dashboard panel's, changed only where "dashboard" would be wrong.
 * Same ACCESS source, so a Restricted widget and a Restricted board mean the same thing. */
const ACC_DESC = {
  public: 'Everyone with portal access can see this widget.',
  private: 'Only you can see and manage this widget.',
  restricted: 'Only the technicians / groups you pick below can see it.',
}
const XAXIS_OPTS = ['Priority', 'Status', 'Team', 'Created date']
const YFUNC_OPTS = ['Count Of', 'Sum Of', 'Average Of', 'Distinct Count']
const YCOL_OPTS = ['Requests', 'Effort hours', 'Resolution time']
const DATEF_OPTS = ['Created date', 'Updated date', 'Resolved date', 'Due date']
/* Date Filter picks WHICH date column to filter on; Date Range picks the WINDOW. The
 * range field is a DateRangePicker, which reads the same QUICK list the topbar and the
 * tile calendar do — a range that exists in one picker and not another is how you end up
 * with a widget nobody can reproduce. */

// ServiceOps "Create Widget" fields. Prefilled from the existing tile when editing.
function initCfg() {
  return {
    name: props.duplicate ? `Copy of ${ex.title}` : ex?.title || props.libItem?.title || `New ${curType.value.label}`,
    module: 'Request', techAccess: [store.currentUser], groupAccess: '',
    mode: ex?.sql ? 'query' : 'manual',   // Manual | Query Based
    xAxis: 'Priority', yFunc: 'Count Of', yColumn: 'Requests',
    assetType: '', dateFilter: 'Created date', description: ex?.info || '',
    // an existing tile already carrying its own `dateFilter` range IS a sticky widget —
    // read the switch back off the tile so editing one doesn't silently un-stick it
    stickyDate: !!ex?.dateFilter, dateRange: ex?.dateFilter || 'Last 7 days',
    // Output shaping is a rank WINDOW, not a sort direction: "Top 10" / "Bottom 10".
    // (None/Ascending/Descending said how to order the rows but never how many to
    // keep, which is the question a long-tailed chart actually asks.)
    rank: ex?.rank || 'top', rankN: ex?.rankN ?? 10,
    excludeZero: false, sqlQuery: ex?.sql || '',
    access: ex?.access || 'public',   // Public / Private / Restricted — as a dashboard has
    // display properties, saved on the widget. undefined = on / off respectively.
    legend: ex?.legend !== false,
    dataLabels: ex?.dataLabels === true,
    donut: ex?.chart?.donut !== false,   // Pie/Donut split — ring by default (§4 pie)
    // ── PMG-ACT-01 additional-kind config (prefilled from the tile's saved spec) ──
    conds: (ex?.chart?.spec?.conds || ex?.chart?.spec?.measure?.conds || []).map((c) => ({ ...c })),
    stackXDim: ex?.chart?.spec?.xDim || 'Priority',
    stackSplit: ex?.chart?.spec?.splitDim || 'Status',
    stackMode: ex?.chart?.spec?.stackMode || 'stacked',
    mlXDim: ex?.chart?.spec?.xDim || 'Priority',
    mlSplit: ex?.chart?.spec?.splitDim || 'Status',
    comboXDim: ex?.chart?.spec?.xDim || 'Priority',
    comboFn: ex?.chart?.spec?.comboFn || 'Average',
    comboField: ex?.chart?.spec?.comboField || 'Resolution time',
    histField: ex?.chart?.spec?.histField || 'Resolution time',
    histBucket: ex?.chart?.spec?.histBucket || 4,
    stageField: ex?.chart?.spec?.stageField || 'Status',
    // map bubble (§4.6) — geographic dimension is fixed to Site
    mapFn: ex?.chart?.spec?.mapFn || 'Count',
    mapField: ex?.chart?.spec?.mapField || 'Resolution time',
    // heatmap (§4.5)
    heatX: ex?.chart?.spec?.heatX || 'Priority',
    heatY: ex?.chart?.spec?.heatY || 'Team',
    heatFn: ex?.chart?.spec?.heatFn || 'Count',
    heatField: ex?.chart?.spec?.heatField || 'Resolution time',
    // gauge (§4.8) — its own base + numerator condition sets
    gaugeMode: ex?.chart?.spec?.measure?.mode || 'count',
    gaugeFn: ex?.chart?.spec?.measure?.fn || 'Average',
    gaugeField: ex?.chart?.spec?.measure?.field || 'CSAT score',
    gaugeNumConds: ex?.chart?.spec?.measure?.numConds ? ex.chart.spec.measure.numConds.map((c) => ({ ...c })) : [],
    gaugeMax: ex?.chart?.spec?.gaugeMax || '',
    gaugeHigherBetter: ex?.chart?.spec?.invert === true,
    gaugeWarnAt: ex?.chart?.spec?.warnAt ?? 70,
    gaugeBadAt: ex?.chart?.spec?.badAt ?? 90,
    // Free Text (§4) — the tile's markdown-lite content
    content: ex?.content || '',
  }
}
const isPie = computed(() => curType.value.kind === 'donut')
// additional PMG-ACT-01 kinds render from a chartSpec through the records.js engine
const isNewKind = computed(() => NEW_KINDS.has(curType.value.kind))
const chartSpec = computed(() => {
  const k = curType.value.kind
  if (k === 'stack') return { kind: 'stack', xDim: cfg.stackXDim, splitDim: cfg.stackSplit, stackMode: cfg.stackMode, conds: cfg.conds }
  if (k === 'multiline') return { kind: 'multiline', xDim: cfg.mlXDim, splitDim: cfg.mlSplit, conds: cfg.conds }
  if (k === 'combo') return { kind: 'combo', xDim: cfg.comboXDim, comboFn: cfg.comboFn, comboField: cfg.comboField, conds: cfg.conds }
  if (k === 'hist') return { kind: 'hist', histField: cfg.histField, histBucket: cfg.histBucket, conds: cfg.conds }
  if (k === 'funnel') return { kind: 'funnel', stageField: cfg.stageField, conds: cfg.conds }
  if (k === 'mapbubble') return { kind: 'mapbubble', mapFn: cfg.mapFn, mapField: cfg.mapField, conds: cfg.conds }
  if (k === 'heatmap') return { kind: 'heatmap', heatX: cfg.heatX, heatY: cfg.heatY, heatFn: cfg.heatFn, heatField: cfg.heatField, conds: cfg.conds }
  if (k === 'gauge') return {
    kind: 'gauge',
    measure: { mode: cfg.gaugeMode, fn: cfg.gaugeFn, field: cfg.gaugeField, conds: cfg.conds, numConds: cfg.gaugeNumConds },
    warnAt: cfg.gaugeWarnAt, badAt: cfg.gaugeBadAt, invert: cfg.gaugeHigherBetter, gaugeMax: cfg.gaugeMax,
  }
  return null
})
// heatmap and gauge carry no legend / Top-N — their Display section is suppressed
const noDisplay = computed(() => ['heatmap', 'gauge', 'mapbubble'].includes(curType.value.kind))
const rankN = computed({
  get: () => cfg.rankN,
  // keep it a number and never let it reach 0 — a chart of nothing is not a view
  set: (v) => { const n = parseInt(String(v).replace(/\D/g, ''), 10); cfg.rankN = Number.isFinite(n) && n > 0 ? n : '' },
})
const cfg = reactive(initCfg())
function reset() { Object.assign(cfg, initCfg()) }

/* Widget names must be unique across every dashboard.
 *
 * This fires on UPDATE as well as create — it used to bail out entirely when
 * editing, so renaming a widget onto an existing name sailed through. The tile
 * being edited is excluded by id (otherwise a widget would collide with itself),
 * and the current board is checked too: two widgets with the same name on the
 * SAME dashboard is the worst case, not an exemption. */
const dupBoards = computed(() => {
  const n = cfg.name?.trim().toLowerCase()
  if (!n) return []
  const selfId = props.duplicate ? null : props.existing?.id
  const names = new Set()
  store.dashboards.forEach((dash) => {
    if (dash.archived) return
    const hit = (dash.tiles || []).some((t) => t.id !== selfId && (t.title || '').toLowerCase() === n)
    if (hit) names.add(dash.id === props.d?.id ? `${dash.name} (this dashboard)` : dash.name)
  })
  return [...names]
})
// a duplicate name BLOCKS the save — "must be unique" is a rule, not a suggestion
const nameTaken = computed(() => dupBoards.value.length > 0)
const canSave = computed(() => !!cfg.name?.trim() && !nameTaken.value)
const ctaHint = computed(() =>
  !cfg.name?.trim() ? 'Give this widget a name'
    : nameTaken.value ? 'That name is already taken — widget names must be unique'
      : '')

const previewTile = computed(() => {
  const title = cfg.name || `New ${curType.value.label}`
  if (isText.value) return mkText(title, cfg.content, cfg.description)
  if (isKpi.value) {
    return ex
      ? mkKpi(title, ex.value, ex.unit, ex.delta, ex.status, cfg.description)
      : mkKpi(title, 128, '', { dir: 'up', pct: 5.2 }, 'good', cfg.description)
  }
  if (isChart.value) {
    // additional kinds carry a chartSpec; ChartTile computes the display from it
    if (isNewKind.value) {
      const t = mkChart(title, { kind: curType.value.kind, spec: chartSpec.value }, cfg.description)
      t.legend = cfg.legend
      return t
    }
    let labels, series
    if (ex?.chart) {
      labels = ex.chart.labels
      series = ex.chart.series.map((s) => ({ ...s, values: [...s.values] }))
    } else {
      const donut = curType.value.kind === 'donut'
      labels = donut ? ['P1', 'P2', 'P3', 'P4'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      series = [{ name: cfg.yFunc, values: donut ? [18, 64, 120, 46] : [42, 51, 38, 60, 55] }]
    }
    /* Apply the rank window. Single-series charts rank their *categories* (a pie
     * ranks slices), so labels and values must be reordered together — sorting the
     * values alone, as the old sortOrder did, silently detached each bar from its
     * label. Multi-series charts are left alone: there is no single ranking. */
    const n = Number(cfg.rankN) || 0
    if (series.length === 1 && n > 0 && n < labels.length) {
      const pairs = labels.map((l, i) => ({ l, v: series[0].values[i] }))
      pairs.sort((a, b) => (cfg.rank === 'bottom' ? a.v - b.v : b.v - a.v))
      const win = pairs.slice(0, n)
      labels = win.map((p) => p.l)
      series = [{ ...series[0], values: win.map((p) => p.v) }]
    }
    const t = mkChart(title, { kind: curType.value.kind, labels, series }, cfg.description)
    t.legend = cfg.legend          // so the live preview reflects the toggle
    t.dataLabels = cfg.dataLabels
    t.rank = cfg.rank; t.rankN = cfg.rankN
    if (isPie.value) t.chart.donut = cfg.donut   // ring vs flat pie
    return t
  }
  return ex
    ? mkShortcut(title, ex.columns, ex.rows.map((r) => [...r]), cfg.description)
    : mkShortcut(title, ['ID', 'Subject', 'Priority', 'Status'],
      [['INC-2041', 'VPN down for finance team', 'P1', 'In Progress'], ['INC-2038', 'Email delivery delayed', 'P1', 'Open']], cfg.description)
})

// place = true  → "{prefix} & Add Widget" (put it on the canvas, redirect)
// place = false → "{prefix} Widget"        (save the definition, don't place)
/* The sticky switch and `tile.dateFilter` are the same fact: a tile carrying a range is
 * one that ignores the dashboard filter, and that range is exactly what the calendar on
 * its header reads. Switching sticky off clears it, so the tile falls back to the board's
 * filter and its calendar disappears — the same state as every widget that never had one. */
function applySticky(t) { t.dateFilter = cfg.stickyDate ? cfg.dateRange : null }

function save(place) {
  const pv = previewTile.value
  // --- duplicate a board tile: build a NEW copy from the (re)configured data ---
  if (props.duplicate) {
    pv.w = ex.w; pv.h = ex.h
    if (ex.group != null) pv.group = ex.group
    if (queryMode.value) pv.sql = cfg.sqlQuery
    pv.access = cfg.access
    applySticky(pv)
    emit('duplicated', { tile: pv, afterId: ex.id })
    return
  }
  // --- library duplicate/edit: hand the config back to the listing ---
  if (props.libItem) {
    emit('librarySaved', { title: cfg.name, module: cfg.module, type: curType.value.type, access: cfg.access, place })
    return
  }
  // --- edit an existing board tile in place (type may change for a predefined edit) ---
  if (props.existing) {
    const t = props.existing
    t.title = cfg.name || t.title
    t.info = cfg.description
    t.type = curType.value.type
    if (isChart.value) {
      t.chart = pv.chart
      t.legend = cfg.legend; t.dataLabels = cfg.dataLabels; t.rank = cfg.rank; t.rankN = cfg.rankN
      t.columns = undefined; t.rows = undefined; t.value = undefined
    }
    else if (isShortcut.value) { t.columns = pv.columns; t.rows = pv.rows; t.sql = cfg.sqlQuery; t.chart = undefined }
    else if (isKpi.value) { t.value = pv.value; t.unit = pv.unit; t.chart = undefined; t.columns = undefined; t.rows = undefined }
    else if (isText.value) { t.content = cfg.content; t.chart = undefined; t.columns = undefined; t.rows = undefined; t.value = undefined }
    if (!isShortcut.value && !isText.value) t.sql = cfg.mode === 'query' ? cfg.sqlQuery : undefined
    t.access = cfg.access
    applySticky(t)
    props.d.updated = new Date().toISOString()
    emit('saved', { id: t.id, place })
    return
  }
  // --- create new ---
  if (place) {
    if (isText.value) { pv.w = 4; pv.h = 1 }
    else { pv.w = isChart.value ? 6 : isShortcut.value ? 6 : 3; pv.h = isKpi.value ? 1 : 2 }
    if (queryMode.value) pv.sql = cfg.sqlQuery
    pv.access = cfg.access
    applySticky(pv)
    props.d.tiles.push(pv)
    props.d.updated = new Date().toISOString()
    emit('created', pv.id)
  } else {
    emit('savedToLibrary', { title: cfg.name, module: cfg.module, type: curType.value.type, access: cfg.access })
  }
}
</script>

<template>
  <teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="builder">
        <!-- Header (ClickUp-style) -->
        <header class="bhead">
          <div class="crumb"><span class="muted">Dashboard</span> <Icon name="chevron-right" :size="13" class="sep" /> <span v-if="duplicate" class="muted">Duplicate</span><span v-else-if="editing || libMode" class="muted">Edit</span> <b>{{ cfg.name || ('New ' + curType.label) }}</b></div>
          <div class="hacts">
            <button class="ic" title="Refresh preview" @click="refreshPreview"><Icon name="refresh" :size="16" :class="{ spin: spinning }" /></button>
            <button class="ic" @click="emit('close')" title="Close"><Icon name="x" :size="18" /></button>
          </div>
        </header>

        <div class="bbody">
          <!-- LEFT: live preview (ServiceOps) -->
          <section class="preview">
            <!-- creating: pick a family. editing: only the swaps that are actually
                 possible. Neither renders a disabled tab. -->
            <div v-if="showFamilies" class="pv-tabs">
              <button
                v-for="f in FAMILIES" :key="f.id" class="pv-tab"
                :class="{ on: familyOn(f) }" :title="`Build a ${f.label}`" @click="pickFamily(f)"
              >
                <Icon :name="f.icon" :size="16" /> {{ f.label }}
              </button>
            </div>
            <div class="pv-card">
              <div class="pv-canvas">
                <div v-if="isKpi" class="pv-kpi">{{ previewTile.value }}<span v-if="previewTile.unit" class="u">{{ previewTile.unit }}</span><span class="d">▲ {{ previewTile.delta?.pct }}%</span></div>
                <ChartTile v-else-if="isChart" :chart="previewTile.chart" :legend="cfg.legend" :data-labels="cfg.dataLabels" :height="320" />
                <div v-else-if="isText" class="pv-text"><FreeTextTile :content="cfg.content" /></div>
                <table v-else class="pv-tbl"><thead><tr><th v-for="c in previewTile.columns" :key="c">{{ c }}</th></tr></thead><tbody><tr v-for="(r,i) in previewTile.rows" :key="i"><td v-for="(c,j) in r" :key="j">{{ c }}</td></tr></tbody></table>
              </div>
            </div>
            <div class="pv-foot"><Icon name="eye" :size="13" /> Live preview — updates as you configure</div>
          </section>

          <!-- RIGHT: scrollable config (ServiceOps fields) -->
          <aside class="config">
            <div class="cfg-scroll">
              <!-- predefined widget: only the chart type + Highlights (both below) can change -->
              <div v-if="predefinedEdit" class="sec pe-note">
                <Icon name="verified" :size="15" />
                <span v-if="frozenType">
                  This is a <b>predefined {{ curType.label }}</b> — its type can’t be changed, and only <b>Highlights</b> below are editable.
                </span>
                <span v-else>
                  This is a <b>predefined</b> widget — you can switch it between <b>Bar, Column and Line</b> and edit <b>Highlights</b>, both below. Nothing else.
                </span>
              </div>
              <!-- Editing a switchable chart (Bar/Column/Line): the type switch lives here as
                   tiles in the config panel, never as tabs above the preview — and never a
                   Widget/KPI/Shortcut family switch, since you can't recast a tile's family
                   mid-edit. Shown for both predefined and custom edits. -->
              <div v-if="editTabs.length" class="sec">
                <div class="sec-h">Chart Type</div>
                <div class="kinds">
                  <button
                    v-for="t in editTabs" :key="t.id" class="kind"
                    :class="{ on: curType.id === t.id }" :title="`Show as ${t.label}`" @click="pickKind(t)"
                  >
                    <Icon :name="t.icon" :size="22" :class="{ rot90: t.id === 'bar' }" />
                    <span class="kind-l">{{ t.label }}</span>
                  </button>
                </div>
              </div>
              <template v-if="!predefinedEdit">
              <!-- Basic Details -->
              <div class="sec">
                <div class="sec-h">{{ isShortcut ? 'Basic Shortcut Details' : 'Basic Widget Details' }}</div>
                <div class="grid2">
                  <div class="fld"><label>Name <i>*</i></label><input class="input" :class="{ bad: nameTaken }" v-model="cfg.name" placeholder="Name" /></div>
                  <div class="fld"><label>Module <i>*</i></label><Dropdown v-model="cfg.module" :options="store.modules" /></div>
                </div>
                <p v-if="dupBoards.length" class="dup-warn"><Icon name="alert" :size="13" /> <span>A widget named “{{ cfg.name }}” already exists on {{ dupBoards.slice(0, 2).join(', ') }}<span v-if="dupBoards.length > 2"> +{{ dupBoards.length - 2 }} more</span>. <b>Widget names must be unique</b> — pick another.</span></p>
                <div v-if="isShortcut" class="fld" style="margin-top:12px"><label>Description</label><textarea class="input" rows="2" v-model="cfg.description" placeholder="Description" /></div>
                <template v-if="cfg.module==='Asset' && manualMode">
                  <div class="fld"><label>Asset type</label>
                    <div class="open-dd"><button v-for="a in ['Hardware','Software','Non-IT','Consumable']" :key="a" class="dd-opt" :class="{ on: cfg.assetType===a }" @click="cfg.assetType=a">{{ a }} <Icon v-if="cfg.assetType===a" name="check" :size="13"/></button></div>
                  </div>
                </template>
              </div>

              <!-- Visibility & Sharing — the same three-way choice a dashboard has, from the
                   same ACCESS source, so "Restricted" means one thing across the product.
                   The technician / group pickers belong to Restricted and appear with it:
                   asking who may open a Public widget is a question with no answer. -->
              <div class="sec">
                <div class="sec-h">Visibility &amp; sharing</div>
                <label class="acc-lbl">Widget Access Level <i>*</i></label>
                <div class="acc-seg">
                  <button
                    v-for="(a, k) in ACCESS" :key="k" class="acc-btn" :class="{ on: cfg.access === k }"
                    @click="cfg.access = k"
                  >
                    <Icon :name="a.icon" :size="15" /> {{ a.label }}
                  </button>
                </div>
                <p class="hint acc-note"><Icon name="info" :size="13" /> {{ ACC_DESC[cfg.access] }}</p>
                <div v-if="cfg.access === 'restricted'" class="grid2" style="margin-top:12px">
                  <div class="fld"><label>Technician Access Level <i>*</i></label><Dropdown v-model="cfg.techAccess" :options="store.owners" :multiple="true" placeholder="Select technicians" /></div>
                  <div class="fld"><label>Technician Group Access Level <i>*</i></label><Dropdown v-model="cfg.groupAccess" :options="GROUP_OPTS" placeholder="Select" /></div>
                </div>
              </div>

              <!-- Chart Type is its own section AFTER visibility, as the prototype orders
                   it: what the widget is called and who can see it are settled before how
                   it is drawn. The labels stay under the tiles — twelve icon-only squares
                   is a memory test, and the prototype only had four. -->
              <div v-if="showFamilies && isChart" class="sec">
                <div class="sec-h">Chart Type</div>
                <p class="hint" style="margin:-6px 0 12px">Pick how the data should be visualized.</p>
                <div class="kinds">
                  <button
                    v-for="k in CHART_KINDS" :key="k.id" class="kind"
                    :class="{ on: curType.id === k.id }" @click="pickKind(k)"
                  >
                    <Icon :name="k.icon" :size="22" :class="{ rot90: k.id === 'bar' }" />
                    <span class="kind-l">{{ k.label }}</span>
                  </button>
                </div>
                <template v-if="!isShortcut && !isText">
                  <div class="seg" style="margin-top:14px">
                    <button class="seg-b" :class="{ on: cfg.mode==='manual' }" @click="cfg.mode='manual'">Manual</button>
                    <button class="seg-b" :class="{ on: cfg.mode==='query' }" @click="cfg.mode='query'">Query Based</button>
                  </div>
                  <p class="hint">A widget counts the records that match its conditions.</p>
                </template>
              </div>
              <!-- families without a chart type still need the Manual / Query switch -->
              <div v-else-if="!isShortcut && !isText" class="sec">
                <div class="seg">
                  <button class="seg-b" :class="{ on: cfg.mode==='manual' }" @click="cfg.mode='manual'">Manual</button>
                  <button class="seg-b" :class="{ on: cfg.mode==='query' }" @click="cfg.mode='query'">Query Based</button>
                </div>
                <p class="hint">A widget counts the records that match its conditions.</p>
              </div>

              <!-- Query — Shortcuts always; Widget/KPI when "Query Based" tab is active -->
              <div v-if="queryMode" class="sec">
                <div class="sec-h">Query <i class="req">*</i></div>
                <textarea class="input sql" rows="6" v-model="cfg.sqlQuery" :placeholder="SQL_PLACEHOLDER" spellcheck="false" />
                <div class="qrow"><span class="hint" style="margin:0">{{ isShortcut ? 'Write a query to return the records this Shortcut lists.' : 'Write a query to return the data this widget plots.' }}</span><button class="btn btn-sm btn-primary" @click="refreshPreview"><Icon name="eye" :size="13" /> Tap Preview</button></div>
              </div>

              <!-- Axes (classic charts, Manual mode only) -->
              <div v-if="isChart && manualMode && !isNewKind" class="sec">
                <div class="sec-h">Axes</div>
                <div class="fld"><label>X-Axis <i>*</i></label><Dropdown v-model="cfg.xAxis" :options="XAXIS_OPTS" /></div>
                <div class="grid2">
                  <div class="fld"><label>Y-Axis Function <i>*</i></label><Dropdown v-model="cfg.yFunc" :options="YFUNC_OPTS" /></div>
                  <div class="fld"><label>Y-Axis Column <i>*</i></label><Dropdown v-model="cfg.yColumn" :options="YCOL_OPTS" /></div>
                </div>
              </div>

              <!-- Series / Buckets / Stages / Matrix — the additional PMG-ACT-01 kinds (§4). -->
              <div v-if="isChart && manualMode && isNewKind && curType.kind !== 'gauge'" class="sec">
                <div class="sec-h">{{ curType.kind === 'hist' ? 'Buckets' : curType.kind === 'funnel' ? 'Stages' : curType.kind === 'heatmap' ? 'Matrix' : curType.kind === 'mapbubble' ? 'Bubbles' : 'Series' }}</div>
                <!-- Stacked / Grouped (§4.1) -->
                <template v-if="curType.kind === 'stack'">
                  <div class="grid2">
                    <div class="fld"><label>X-Axis <i>*</i></label><Dropdown v-model="cfg.stackXDim" :options="CONDITION_FIELD_LABELS" /></div>
                    <div class="fld"><label>Split by <i>*</i></label><Dropdown v-model="cfg.stackSplit" :options="CONDITION_FIELD_LABELS" /></div>
                  </div>
                  <div class="seg">
                    <button class="seg-b" :class="{ on: cfg.stackMode==='stacked' }" @click="cfg.stackMode='stacked'">Stacked</button>
                    <button class="seg-b" :class="{ on: cfg.stackMode==='grouped' }" @click="cfg.stackMode='grouped'">Grouped</button>
                  </div>
                  <p class="hint">{{ cfg.stackMode === 'grouped'
                    ? 'One column per split value, side by side within each X value — compares totals directly instead of composing them.'
                    : 'One stacked column per X value, one colour per split value — two grouping dimensions on one chart.' }}</p>
                </template>
                <!-- Multi-line (§4.2) -->
                <template v-else-if="curType.kind === 'multiline'">
                  <div class="grid2">
                    <div class="fld"><label>X-Axis <i>*</i></label><Dropdown v-model="cfg.mlXDim" :options="CONDITION_FIELD_LABELS" /></div>
                    <div class="fld"><label>Split by <i>*</i></label><Dropdown v-model="cfg.mlSplit" :options="CONDITION_FIELD_LABELS" /></div>
                  </div>
                  <p class="hint">One line per split value, plotted across the same X-Axis — trends across a category compared side by side on a shared scale.</p>
                </template>
                <!-- Combo (§4.3) — count bars + an aggregate line on a second axis -->
                <template v-else-if="curType.kind === 'combo'">
                  <div class="fld"><label>X-Axis <i>*</i></label><Dropdown v-model="cfg.comboXDim" :options="CONDITION_FIELD_LABELS" /></div>
                  <div class="grid2">
                    <div class="fld"><label>Line Function <i>*</i></label><Dropdown v-model="cfg.comboFn" :options="AGG_FNS" /></div>
                    <div class="fld"><label>Line Field <i>*</i></label><Dropdown v-model="cfg.comboField" :options="NUMERIC_FIELD_LABELS" /></div>
                  </div>
                  <p class="hint">Count bars on the left axis; the aggregate line rides the secondary axis.</p>
                </template>
                <!-- Histogram (§4.4) — gap-free equal-width bands over a numeric field -->
                <template v-else-if="curType.kind === 'hist'">
                  <div class="grid2">
                    <div class="fld"><label>Field <i>*</i></label><Dropdown v-model="cfg.histField" :options="NUMERIC_FIELD_LABELS" /></div>
                    <div class="fld"><label>Bucket size <i>*</i></label><input class="input" type="number" min="0.5" step="0.5" v-model.number="cfg.histBucket" /></div>
                  </div>
                  <p class="hint">Named, gap-free ranges in field order. Records without a value are excluded — never counted as zero.</p>
                </template>
                <!-- Funnel (§4.7) — cumulative stage counts in the field's defined order -->
                <template v-else-if="curType.kind === 'funnel'">
                  <div class="fld"><label>Stage field <i>*</i></label><Dropdown v-model="cfg.stageField" :options="CONDITION_FIELD_LABELS" /></div>
                  <p class="hint">Stages keep the field's defined order — never alphabetical. Each band counts records that reached that stage or beyond, shown as a share of the first.</p>
                </template>
                <!-- Heatmap (§4.5) — Columns × Rows grid, cell = count or an aggregate -->
                <template v-else-if="curType.kind === 'heatmap'">
                  <div class="grid2">
                    <div class="fld"><label>Columns <i>*</i></label><Dropdown v-model="cfg.heatX" :options="CONDITION_FIELD_LABELS" /></div>
                    <div class="fld"><label>Rows <i>*</i></label><Dropdown v-model="cfg.heatY" :options="CONDITION_FIELD_LABELS" /></div>
                  </div>
                  <div class="grid2">
                    <div class="fld"><label>Cell value <i>*</i></label><Dropdown v-model="cfg.heatFn" :options="MAP_FNS" /></div>
                    <div v-if="cfg.heatFn !== 'Count'" class="fld"><label>Field <i>*</i></label><Dropdown v-model="cfg.heatField" :options="NUMERIC_FIELD_LABELS" /></div>
                  </div>
                  <p class="hint">{{ cfg.heatFn === 'Count'
                    ? 'Record count per cell, colour-scaled across the grid.'
                    : `${cfg.heatFn} of ${cfg.heatField} per cell, colour-scaled across the grid. A cell with no matching value reads as 0.` }}</p>
                </template>
                <!-- Map Bubble (§4.6) — one bubble per Site, sized by the value -->
                <template v-else-if="curType.kind === 'mapbubble'">
                  <div class="grid2">
                    <div class="fld"><label>Bubble value <i>*</i></label><Dropdown v-model="cfg.mapFn" :options="MAP_FNS" /></div>
                    <div v-if="cfg.mapFn !== 'Count'" class="fld"><label>Field <i>*</i></label><Dropdown v-model="cfg.mapField" :options="NUMERIC_FIELD_LABELS" /></div>
                  </div>
                  <p class="hint">One bubble per Site (the geographic dimension is fixed to Site), positioned by its coordinates and sized by {{ cfg.mapFn === 'Count' ? 'the record count' : `${cfg.mapFn} of ${cfg.mapField}` }}. Sites with no matching records get no bubble.</p>
                </template>
              </div>

              <!-- Gauge (§4.8) — Measurement + Gauge Range, with its own condition editors -->
              <template v-if="curType.kind === 'gauge' && manualMode">
                <div class="sec">
                  <div class="sec-h">Measurement</div>
                  <div class="seg">
                    <button class="seg-b" :class="{ on: cfg.gaugeMode==='count' }" @click="cfg.gaugeMode='count'">Count</button>
                    <button class="seg-b" :class="{ on: cfg.gaugeMode==='aggregate' }" @click="cfg.gaugeMode='aggregate'">Aggregate</button>
                    <button class="seg-b" :class="{ on: cfg.gaugeMode==='percentage' }" @click="cfg.gaugeMode='percentage'">Percentage</button>
                  </div>
                  <div v-if="cfg.gaugeMode==='aggregate'" class="grid2">
                    <div class="fld"><label>Function</label><Dropdown v-model="cfg.gaugeFn" :options="AGG_FNS" /></div>
                    <div class="fld"><label>Field</label><Dropdown v-model="cfg.gaugeField" :options="NUMERIC_FIELD_LABELS" /></div>
                  </div>
                  <template v-if="cfg.gaugeMode==='percentage'">
                    <div class="fld" style="margin-top:12px">
                      <label>Base conditions</label>
                      <p class="hint" style="margin:0 0 8px">The base set — the denominator. Leave empty to measure against every record.</p>
                      <MeasureConditions v-model="cfg.conds" empty-text="No base conditions — every record counts." />
                    </div>
                    <div class="fld" style="margin-top:12px">
                      <label>Numerator</label>
                      <p class="hint" style="margin:0 0 8px">The share of the base that also meets these — the numerator.</p>
                      <MeasureConditions v-model="cfg.gaugeNumConds" empty-text="No numerator conditions yet." />
                    </div>
                  </template>
                  <div v-else class="fld" style="margin-top:12px">
                    <label>Conditions</label>
                    <p class="hint" style="margin:0 0 8px">Filter the records this meter measures. If none are set, all records are counted.</p>
                    <MeasureConditions v-model="cfg.conds" />
                  </div>
                </div>
                <div class="sec">
                  <div class="sec-h">Gauge Range</div>
                  <div class="grid2">
                    <div class="fld"><label>Max</label><input class="input" type="number" min="0" v-model="cfg.gaugeMax" placeholder="Auto" /></div>
                  </div>
                  <label class="tgl-row" style="margin-top:12px">
                    <span class="tgl-txt"><b>Higher is better</b><em>Flip the bands so the top of the range is green, not red.</em></span>
                    <button class="tgl" :class="{ on: cfg.gaugeHigherBetter }" role="switch" :aria-checked="cfg.gaugeHigherBetter"
                      @click.prevent="cfg.gaugeHigherBetter = !cfg.gaugeHigherBetter"><i /></button>
                  </label>
                  <div class="grid2">
                    <div class="fld"><label>Amber from</label><input class="input" type="number" v-model.number="cfg.gaugeWarnAt" /></div>
                    <div class="fld"><label>{{ cfg.gaugeHigherBetter ? 'Green from' : 'Red from' }}</label><input class="input" type="number" v-model.number="cfg.gaugeBadAt" /></div>
                  </div>
                  <p class="hint">The bands come from these thresholds — the meter analog of KPI Highlights.</p>
                </div>
              </template>

              <!-- Content — Free Text only (§4). The one section this family shows. -->
              <div v-if="isText" class="sec">
                <div class="sec-h">Content</div>
                <textarea class="input" rows="7" v-model="cfg.content" placeholder="# Section heading&#10;- A bullet point&#10;A paragraph of note text, with a [link](https://example.com) inline." />
                <p class="hint">Lines starting with '# ' render as headings, '- ' as bullets; [label](url) anywhere becomes a link. No data query behind this widget.</p>
              </div>

              <!-- Data Configuration -->
              <div v-if="manualMode && !isText" class="sec">
                <div class="sec-h">Data Configuration</div>
                <div class="fld"><label>Date Filter <i>*</i></label><Dropdown v-model="cfg.dateFilter" :options="DATEF_OPTS" /></div>
                <!-- Opt out of the dashboard's shared time filter for this one widget.
                     The Date Range field is hidden until the switch is on, because until
                     then the widget has no range of its own — showing an inert field
                     invites you to fill in something that will be ignored. -->
                <label class="tgl-row" style="margin-top:14px">
                  <span class="tgl-txt">
                    <b>Use custom sticky date</b>
                    <em>Keep this widget on its own dates. Changing the dashboard’s time filter won’t affect it.</em>
                  </span>
                  <button class="tgl" :class="{ on: cfg.stickyDate }" role="switch" :aria-checked="cfg.stickyDate"
                    @click.prevent="cfg.stickyDate = !cfg.stickyDate"><i /></button>
                </label>
                <!-- a calendar field, not a dropdown: a range can be a named preset OR an
                     absolute From→To, and a <select> can only ever offer the first -->
                <div v-if="cfg.stickyDate" class="fld"><label>Date Range <i>*</i></label><DateRangePicker v-model="cfg.dateRange" /></div>
                <div class="fld"><label>Description</label><textarea class="input" rows="3" v-model="cfg.description" placeholder="Description" /></div>
              </div>

              <!-- Conditions — classic kinds get the placeholder line; additional kinds
                   get the real shared `field is value` editor bound to the engine (§5). -->
              <div v-if="manualMode && !isNewKind && !isText" class="sec">
                <div class="sec-h">Conditions</div>
                <p class="hint">Add conditions to filter records. If none are set, all records are counted.</p>
                <button class="add-line"><Icon name="plus" :size="14" /> Add Condition</button>
              </div>
              <div v-if="isChart && manualMode && isNewKind && curType.kind !== 'gauge'" class="sec">
                <div class="sec-h">Conditions</div>
                <p class="hint">Filter the records this widget plots. Rows are ANDed; leave empty to count every record.</p>
                <MeasureConditions v-model="cfg.conds" />
              </div>
              </template>

              <!-- Display — custom widgets only. A predefined widget is Highlights and
                   the chart type, nothing else; the legend and data-label toggles are
                   configuration like any other. (This means a predefined widget's legend
                   can no longer be turned off anywhere — "Hide legend" left the ⋯ menu
                   too. That is the rule as stated.) -->
              <div v-if="isChart && !predefinedEdit && !noDisplay" class="sec">
                <div class="sec-h">Display</div>

                <div v-if="manualMode && !isNewKind" class="fld">
                  <label>Show</label>
                  <div class="rank-row">
                    <div class="seg">
                      <button class="seg-b" :class="{ on: cfg.rank === 'top' }" @click="cfg.rank = 'top'">Top N</button>
                      <button class="seg-b" :class="{ on: cfg.rank === 'bottom' }" @click="cfg.rank = 'bottom'">Bottom N</button>
                    </div>
                    <input class="input rank-n" type="text" inputmode="numeric" v-model="rankN" placeholder="All" />
                  </div>
                  <p class="hint">
                    The {{ cfg.rank === 'bottom' ? 'smallest' : 'largest' }}
                    <b>{{ Number(cfg.rankN) || '—' }}</b> categories. Leave it blank to plot every one.
                  </p>
                </div>

                <label class="tgl-row">
                  <span class="tgl-txt">
                    <b>Legend</b>
                    <em>The key that names each series or slice.</em>
                  </span>
                  <button class="tgl" :class="{ on: cfg.legend }" role="switch" :aria-checked="cfg.legend"
                    @click.prevent="cfg.legend = !cfg.legend"><i /></button>
                </label>

                <label v-if="isPie" class="tgl-row">
                  <span class="tgl-txt">
                    <b>Donut</b>
                    <em>Render as a ring with the record total in the centre.</em>
                  </span>
                  <button class="tgl" :class="{ on: cfg.donut }" role="switch" :aria-checked="cfg.donut"
                    @click.prevent="cfg.donut = !cfg.donut"><i /></button>
                </label>

                <label v-if="isPie" class="tgl-row">
                  <span class="tgl-txt">
                    <b>Data labels</b>
                    <em>Print each slice’s value on the chart itself.</em>
                  </span>
                  <button class="tgl" :class="{ on: cfg.dataLabels }" role="switch" :aria-checked="cfg.dataLabels"
                    @click.prevent="cfg.dataLabels = !cfg.dataLabels"><i /></button>
                </label>

                <label v-if="manualMode && !predefinedEdit" class="toggle"><span>Exclude Zero Count Values</span><button class="sw" :class="{ on: cfg.excludeZero }" @click="cfg.excludeZero=!cfg.excludeZero"><i /></button></label>
              </div>

              <!-- Highlights (also the only editable section for a predefined widget).
                   New kinds carry their own (Gauge Range) or don't use it. -->
              <div v-if="(manualMode && !isNewKind && !isText) || predefinedEdit" class="sec">
                <div class="sec-h">Highlights</div>
                <p class="hint">Color the value when it crosses a threshold.</p>
                <button class="add-line"><Icon name="plus" :size="14" /> Add Highlights</button>
              </div>
            </div>

            <footer class="cfg-foot">
              <button class="btn" @click="reset">Reset</button>
              <!-- Canvas duplicate → single Duplicate · Canvas edit → single Update ·
                   Library edit/clone + new create → both {prefix} and {prefix} & Add -->
              <!-- every save path is blocked while the name collides -->
              <template v-if="duplicate">
                <button class="btn btn-primary" :disabled="!canSave" :title="ctaHint" @click="save(true)"><Icon name="copy" :size="16" /> Duplicate {{ ctaLabel }}</button>
              </template>
              <template v-else-if="editing">
                <button class="btn btn-primary" :disabled="!canSave" :title="ctaHint" @click="save(false)"><Icon name="check" :size="16" /> Update {{ ctaLabel }}</button>
              </template>
              <template v-else>
                <!-- the prototype leads with the place-it action, then the plain create,
                     then Cancel — placing is the common case, so it takes the emphasis -->
                <button class="btn btn-primary" :disabled="!canSave" :title="ctaHint" @click="save(true)">{{ prefix }} &amp; Add to Dashboard</button>
                <button class="btn" :disabled="!canSave" :title="ctaHint" @click="save(false)">{{ prefix }}</button>
              </template>
              <button class="btn" @click="emit('close')">Cancel</button>
            </footer>
          </aside>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(20,21,38,.5); backdrop-filter: blur(2px); z-index: 120; display: grid; place-items: center; padding: 16px; }
.builder { width: 100%; height: 100%; background: var(--surface); border-radius: var(--r-xl); box-shadow: var(--sh-lg); display: flex; flex-direction: column; overflow: hidden; }
.bhead { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border); flex: none; }
.crumb { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.crumb .sep { color: var(--muted-2); }
.hacts { display: flex; gap: 2px; }
.ic { width: 34px; height: 34px; border: none; background: transparent; color: var(--muted); border-radius: 9px; display: grid; place-items: center; }
.ic:hover { background: var(--surface-2); color: var(--ink); }
.bbody { flex: 1; display: flex; min-height: 0; }
/* Nothing divides the preview from the config panel — no rule AND no colour change.
   There was never a border here, but the preview sat on --bg while the panel sits on
   --surface, and that edge read as a 1px divider running the full height. The preview
   card keeps its own border and shadow, so it still reads as a card on white. */
.preview { flex: 1.5; display: flex; flex-direction: column; min-width: 0; padding: 18px 22px 22px; background: var(--surface); }
.pv-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.pv-tab { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 13px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); border-radius: 9px; font-weight: 500; font-size: 13px; }
.pv-tab:hover { background: var(--surface-2); }
.pv-tab.on { background: var(--primary); border-color: var(--primary); color: #fff; box-shadow: var(--sh-sm); }
.pv-tab:disabled { opacity: .45; cursor: not-allowed; }
.pv-tab.on:disabled { opacity: 1; }
.pv-tab .rot90 { transform: rotate(90deg); }
/* chart-kind picker in the config panel — the family row's little sibling, sized for
   a 2-up grid so all four fit the narrow column without wrapping oddly */
/* all four chart kinds in one row, as square tiles: icon over label */
.kinds { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.kind { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; aspect-ratio: 1 / 1; padding: 8px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); border-radius: 10px; font-weight: 500; font-size: 12.5px; }
.kind:hover { background: var(--surface-2); border-color: var(--muted-2); }
/* selected: a light primary wash, not a solid fill */
.kind.on { background: var(--primary-soft); border-color: var(--primary); color: var(--primary-700); box-shadow: var(--sh-sm); }
.kind-l { line-height: 1; }
.kind .rot90 { transform: rotate(90deg); }
.pv-card { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--sh-sm); display: flex; flex-direction: column; overflow: hidden; }
.pv-canvas { flex: 1; display: grid; place-items: center; padding: 22px; min-height: 0; }
.pv-canvas > * { width: 100%; }
.pv-text { align-self: stretch; max-height: 100%; overflow: auto; }
.pv-kpi { font-size: 72px; font-weight: 700; letter-spacing: -2px; text-align: center; }
.pv-kpi .d { font-size: 20px; color: var(--green); margin-left: 12px; font-weight: 600; }
.pv-tbl { width: 100%; border-collapse: collapse; font-size: 13px; align-self: start; }
.pv-tbl th { text-align: left; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .4px; padding: 7px 10px; border-bottom: 1px solid var(--border); }
.pv-tbl td { padding: 9px 10px; border-bottom: 1px solid var(--border); }
.pv-foot { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted); margin-top: 12px; }
.config { width: 480px; flex: none; display: flex; flex-direction: column; min-height: 0; }
.cfg-scroll { flex: 1; overflow: auto; padding: 18px 20px; }
/* No rules between sections — the config sidebar had one under every section, so a Gauge
   scrolled past six or seven of them. Each heading is already a bold line with space above
   it; the rule was drawing a border around something the type had already separated.
   Applies to all four families (Widget · KPI · Shortcut · Free Text) since they share
   this one .sec class. */
.sec { padding-bottom: 22px; margin-bottom: 0; border-bottom: none; }
/* Display → rank window (Top N / Bottom N + a free number field) */
.rank-row { display: flex; align-items: center; gap: 8px; }
.rank-row .seg { flex: 1; }
.rank-n { width: 74px; flex: none; text-align: center; font-weight: 600; }

/* Display → toggles */
.tgl-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; cursor: pointer; margin-bottom: 12px; }
.tgl-row:last-child { margin-bottom: 0; }
.tgl-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tgl-txt b { font-size: 12.5px; font-weight: 500; color: var(--ink-2); }
.tgl-txt em { font-style: normal; font-size: 11.5px; color: var(--muted); line-height: 1.4; }
.tgl { flex: none; width: 38px; height: 22px; padding: 0; border: none; border-radius: 999px; background: var(--border-strong); position: relative; transition: background .15s; }
.tgl i { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: var(--sh-sm); transition: transform .15s; }
.tgl.on { background: var(--primary); }
.tgl.on i { transform: translateX(16px); }

.pe-note { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; line-height: 1.5; color: var(--primary-700); background: var(--primary-softer); border: 1px solid var(--primary-soft); border-radius: 9px; padding: 10px 12px; }
.pe-note :deep(.ico) { flex: none; margin-top: 1px; }
/* Duplicate-name warning. It belongs to the Name field, so it hugs it: the top
 * margin pulls back most of the field's 12px, and the gap it owns sits *below*.
 * It used to be the other way round — 16px above, 0 below — which read as though
 * it belonged to the Technician fields it was jammed against.
 * align-items: flex-start keeps the icon at the top-left when the text wraps to
 * two lines, instead of the icon drifting to the vertical centre. */
/* Duplicate name reads as a WARNING, not an error — amber, not red. */
.dup-warn { display: flex; align-items: flex-start; gap: 7px; font-size: 12px; line-height: 1.45; color: var(--amber); background: var(--amber-soft); border-radius: 7px; padding: 8px 10px; margin: -6px 0 10px; }
.dup-warn .ico { flex: none; margin-top: 1px; }   /* optical-align with the first text line */
.dup-warn b { font-weight: 600; color: var(--amber); }
.input.bad { border-color: var(--amber); }
.sec:last-child { padding-bottom: 0; }
.sec-h { font-weight: 600; font-size: 13.5px; margin-bottom: 12px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fld { display: flex; flex-direction: column; margin-bottom: 12px; }
.fld:last-child { margin-bottom: 0; }
.fld label { font-size: 12px; font-weight: 500; color: var(--ink-2); margin-bottom: 5px; }
.fld label i { color: var(--red); font-style: normal; }
.selw { position: relative; }
.selw select { appearance: none; padding-right: 30px; cursor: pointer; }
.chev { position: absolute; right: 11px; top: 12px; color: var(--muted); pointer-events: none; }
.seg { display: inline-flex; gap: 4px; background: var(--surface-2); padding: 3px; border-radius: 9px; border: 1px solid var(--border); margin-bottom: 8px; }
.seg-b { border: none; background: transparent; padding: 6px 14px; border-radius: 7px; font-weight: 500; font-size: 12.5px; color: var(--muted); }
.seg-b.on { background: var(--surface); color: var(--primary-700); box-shadow: var(--sh-sm); }
.hint { font-size: 11.5px; color: var(--muted); margin: 6px 0 10px; }
/* Visibility & Sharing — the same three-way control the dashboard panel uses, sized for
   the narrower config column (the board's 38px pills would crowd it). */
.acc-lbl { display: block; font-size: 12px; font-weight: 500; color: var(--ink-2); margin-bottom: 6px; }
.acc-lbl i { color: var(--red); font-style: normal; }
.acc-seg { display: flex; gap: 6px; }
.acc-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); border-radius: 9px; font-weight: 500; font-size: 12.5px; }
.acc-btn:hover { background: var(--surface-2); }
.acc-btn.on { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-700); }
.acc-note { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; }
.open-dd { display: flex; flex-direction: column; gap: 3px; border: 1px solid var(--primary-soft); border-radius: 9px; padding: 5px; background: var(--primary-softer); }
.dd-opt { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border: none; background: transparent; border-radius: 6px; font-size: 13px; text-align: left; }
.dd-opt:hover { background: var(--surface); } .dd-opt.on { background: var(--surface); color: var(--primary-700); font-weight: 600; }
.toggle { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--ink-2); }
.sw { width: 38px; height: 22px; border-radius: 999px; border: none; background: var(--border-strong); position: relative; transition: background .15s; }
.sw i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: var(--sh-sm); }
.sw.on { background: var(--primary); } .sw.on i { left: 18px; }
.add-line { display: inline-flex; align-items: center; gap: 6px; border: 1px dashed var(--border-strong); background: transparent; border-radius: 8px; padding: 8px 12px; font-size: 12.5px; font-weight: 500; color: var(--primary-700); }
.add-line:hover { background: var(--primary-softer); }
.sec-h .req { color: var(--red); font-style: normal; }
.sql { font-family: 'Consolas', ui-monospace, monospace; font-size: 12.5px; line-height: 1.55; background: var(--surface-2); color: var(--ink); }
.sql::placeholder { color: var(--muted-2); opacity: 1; }
.pv-kpi .u { font-size: 28px; font-weight: 600; color: var(--muted); margin-left: 4px; }
.spin { animation: bsp .7s linear infinite; } @keyframes bsp { to { transform: rotate(360deg); } }
.qrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 9px; }
.cfg-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--border); background: var(--surface-2); flex: none; }
@media (max-width: 900px) {
  .bbody { flex-direction: column; }
  .preview { flex: none; height: 240px; border-right: none; }
  .config { width: auto; flex: 1; }
}
</style>
