<script setup>
import { reactive, computed, ref } from 'vue'
import Icon from '../ui/Icon.vue'
import Dropdown from '../ui/Dropdown.vue'
import ChartTile from './ChartTile.vue'
import { store } from '../../store/index.js'
import { chart as mkChart, kpi as mkKpi, shortcut as mkShortcut } from '../../data/mock.js'
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
  { id: 'kpi', label: 'KPI', icon: 'kpi', type: 'kpi', kind: null },
  { id: 'shortcut', label: 'Shortcut', icon: 'table', type: 'shortcut', kind: null },
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
const XAXIS_OPTS = ['Priority', 'Status', 'Team', 'Created date']
const YFUNC_OPTS = ['Count Of', 'Sum Of', 'Average Of', 'Distinct Count']
const YCOL_OPTS = ['Requests', 'Effort hours', 'Resolution time']
const DATEF_OPTS = ['Created date', 'Updated date', 'Resolved date', 'Due date']

// ServiceOps "Create Widget" fields. Prefilled from the existing tile when editing.
function initCfg() {
  return {
    name: props.duplicate ? `Copy of ${ex.title}` : ex?.title || props.libItem?.title || `New ${curType.value.label}`,
    module: 'Request', techAccess: [store.currentUser], groupAccess: '',
    mode: ex?.sql ? 'query' : 'manual',   // Manual | Query Based
    xAxis: 'Priority', yFunc: 'Count Of', yColumn: 'Requests',
    assetType: '', dateFilter: 'Created date', description: ex?.info || '',
    // Output shaping is a rank WINDOW, not a sort direction: "Top 10" / "Bottom 10".
    // (None/Ascending/Descending said how to order the rows but never how many to
    // keep, which is the question a long-tailed chart actually asks.)
    rank: ex?.rank || 'top', rankN: ex?.rankN ?? 10,
    excludeZero: false, sqlQuery: ex?.sql || '',
    sharedAccess: ex?.sharedAccess || 'view',   // access granted to people it's shared with
    // display properties, saved on the widget. undefined = on / off respectively.
    legend: ex?.legend !== false,
    dataLabels: ex?.dataLabels === true,
  }
}
const isPie = computed(() => curType.value.kind === 'donut')
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
  if (isKpi.value) {
    return ex
      ? mkKpi(title, ex.value, ex.unit, ex.delta, ex.status, cfg.description)
      : mkKpi(title, 128, '', { dir: 'up', pct: 5.2 }, 'good', cfg.description)
  }
  if (isChart.value) {
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
    return t
  }
  return ex
    ? mkShortcut(title, ex.columns, ex.rows.map((r) => [...r]), cfg.description)
    : mkShortcut(title, ['ID', 'Subject', 'Priority', 'Status'],
      [['INC-2041', 'VPN down for finance team', 'P1', 'In Progress'], ['INC-2038', 'Email delivery delayed', 'P1', 'Open']], cfg.description)
})

// place = true  → "{prefix} & Add Widget" (put it on the canvas, redirect)
// place = false → "{prefix} Widget"        (save the definition, don't place)
function save(place) {
  const pv = previewTile.value
  // --- duplicate a board tile: build a NEW copy from the (re)configured data ---
  if (props.duplicate) {
    pv.w = ex.w; pv.h = ex.h
    if (ex.group != null) pv.group = ex.group
    if (queryMode.value) pv.sql = cfg.sqlQuery
    pv.sharedAccess = cfg.sharedAccess
    emit('duplicated', { tile: pv, afterId: ex.id })
    return
  }
  // --- library duplicate/edit: hand the config back to the listing ---
  if (props.libItem) {
    emit('librarySaved', { title: cfg.name, module: cfg.module, type: curType.value.type, sharedAccess: cfg.sharedAccess, place })
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
    if (!isShortcut.value) t.sql = cfg.mode === 'query' ? cfg.sqlQuery : undefined
    t.sharedAccess = cfg.sharedAccess
    props.d.updated = new Date().toISOString()
    emit('saved', { id: t.id, place })
    return
  }
  // --- create new ---
  if (place) {
    pv.w = isChart.value ? 6 : isShortcut.value ? 6 : 3
    pv.h = isKpi.value ? 1 : 2
    if (queryMode.value) pv.sql = cfg.sqlQuery
    pv.sharedAccess = cfg.sharedAccess
    props.d.tiles.push(pv)
    props.d.updated = new Date().toISOString()
    emit('created', pv.id)
  } else {
    emit('savedToLibrary', { title: cfg.name, module: cfg.module, type: curType.value.type, sharedAccess: cfg.sharedAccess })
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
            <div v-else-if="editTabs.length" class="pv-tabs">
              <button
                v-for="t in editTabs" :key="t.id" class="pv-tab"
                :class="{ on: curType.id === t.id }" :title="`Show as ${t.label}`"
                @click="pickKind(t)"
              >
                <Icon :name="t.icon" :size="16" :class="{ rot90: t.id === 'bar' }" /> {{ t.label }}
              </button>
            </div>
            <div class="pv-card">
              <div class="pv-canvas">
                <div v-if="isKpi" class="pv-kpi">{{ previewTile.value }}<span v-if="previewTile.unit" class="u">{{ previewTile.unit }}</span><span class="d">▲ {{ previewTile.delta?.pct }}%</span></div>
                <ChartTile v-else-if="isChart" :chart="previewTile.chart" :legend="cfg.legend" :data-labels="cfg.dataLabels" :height="320" />
                <table v-else class="pv-tbl"><thead><tr><th v-for="c in previewTile.columns" :key="c">{{ c }}</th></tr></thead><tbody><tr v-for="(r,i) in previewTile.rows" :key="i"><td v-for="(c,j) in r" :key="j">{{ c }}</td></tr></tbody></table>
              </div>
            </div>
            <div class="pv-foot"><Icon name="eye" :size="13" /> Live preview — updates as you configure</div>
          </section>

          <!-- RIGHT: scrollable config (ServiceOps fields) -->
          <aside class="config">
            <div class="cfg-scroll">
              <!-- predefined widget: only the chart type (above) + Highlights (below) can change -->
              <div v-if="predefinedEdit" class="sec pe-note">
                <Icon name="verified" :size="15" />
                <span v-if="frozenType">
                  This is a <b>predefined {{ curType.label }}</b> — its type can’t be changed, and only <b>Highlights</b> below are editable.
                </span>
                <span v-else>
                  This is a <b>predefined</b> widget — you can switch it between <b>Bar, Column and Line</b> (tabs above) and edit <b>Highlights</b> below. Nothing else.
                </span>
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
                <div class="grid2">
                  <div class="fld"><label>Technician Access Level <i>*</i></label><Dropdown v-model="cfg.techAccess" :options="store.owners" :multiple="true" placeholder="Select technicians" /></div>
                  <div class="fld"><label>Technician Group Access Level <i>*</i></label><Dropdown v-model="cfg.groupAccess" :options="GROUP_OPTS" placeholder="Select" /></div>
                </div>
                <div class="fld" style="margin-top:12px">
                  <label>Access when shared</label>
                  <div class="seg">
                    <button class="seg-b" :class="{ on: cfg.sharedAccess==='view' }" @click="cfg.sharedAccess='view'">View</button>
                    <button class="seg-b" :class="{ on: cfg.sharedAccess==='edit' }" @click="cfg.sharedAccess='edit'">Edit</button>
                  </div>
                  <p class="hint" style="margin:6px 0 0">People you share this with can Edit only if you grant Edit access here.</p>
                </div>
                <!-- how the Widget is drawn — a property of the widget, so it sits with
                     the rest of its configuration rather than in the family row above -->
                <div v-if="showFamilies && isChart" class="fld" style="margin-top:12px">
                  <div class="sec-h">Chart type</div>
                  <div class="kinds">
                    <button
                      v-for="k in CHART_KINDS" :key="k.id" class="kind"
                      :class="{ on: curType.id === k.id }" @click="pickKind(k)"
                    >
                      <Icon :name="k.icon" :size="22" :class="{ rot90: k.id === 'bar' }" />
                      <span class="kind-l">{{ k.label }}</span>
                    </button>
                  </div>
                </div>
                <template v-if="!isShortcut">
                  <div class="seg">
                    <button class="seg-b" :class="{ on: cfg.mode==='manual' }" @click="cfg.mode='manual'">Manual</button>
                    <button class="seg-b" :class="{ on: cfg.mode==='query' }" @click="cfg.mode='query'">Query Based</button>
                  </div>
                  <p class="hint">A widget counts the records that match its conditions.</p>
                </template>
                <div v-if="isShortcut" class="fld" style="margin-top:12px"><label>Description</label><textarea class="input" rows="2" v-model="cfg.description" placeholder="Description" /></div>
                <template v-if="cfg.module==='Asset' && manualMode">
                  <div class="fld"><label>Asset type</label>
                    <div class="open-dd"><button v-for="a in ['Hardware','Software','Non-IT','Consumable']" :key="a" class="dd-opt" :class="{ on: cfg.assetType===a }" @click="cfg.assetType=a">{{ a }} <Icon v-if="cfg.assetType===a" name="check" :size="13"/></button></div>
                  </div>
                </template>
              </div>

              <!-- Query — Shortcuts always; Widget/KPI when "Query Based" tab is active -->
              <div v-if="queryMode" class="sec">
                <div class="sec-h">Query <i class="req">*</i></div>
                <textarea class="input sql" rows="6" v-model="cfg.sqlQuery" :placeholder="SQL_PLACEHOLDER" spellcheck="false" />
                <div class="qrow"><span class="hint" style="margin:0">{{ isShortcut ? 'Write a query to return the records this Shortcut lists.' : 'Write a query to return the data this widget plots.' }}</span><button class="btn btn-sm btn-primary" @click="refreshPreview"><Icon name="eye" :size="13" /> Tap Preview</button></div>
              </div>

              <!-- Axes (charts, Manual mode only) -->
              <div v-if="isChart && manualMode" class="sec">
                <div class="sec-h">Axes</div>
                <div class="fld"><label>X-Axis <i>*</i></label><Dropdown v-model="cfg.xAxis" :options="XAXIS_OPTS" /></div>
                <div class="grid2">
                  <div class="fld"><label>Y-Axis Function <i>*</i></label><Dropdown v-model="cfg.yFunc" :options="YFUNC_OPTS" /></div>
                  <div class="fld"><label>Y-Axis Column <i>*</i></label><Dropdown v-model="cfg.yColumn" :options="YCOL_OPTS" /></div>
                </div>
              </div>

              <!-- Data Configuration -->
              <div v-if="manualMode" class="sec">
                <div class="sec-h">Data Configuration</div>
                <div class="fld"><label>Date Filter <i>*</i></label><Dropdown v-model="cfg.dateFilter" :options="DATEF_OPTS" /></div>
                <div class="fld"><label>Description</label><textarea class="input" rows="3" v-model="cfg.description" placeholder="Description" /></div>
              </div>

              <!-- Conditions -->
              <div v-if="manualMode" class="sec">
                <div class="sec-h">Conditions</div>
                <p class="hint">Add conditions to filter records. If none are set, all records are counted.</p>
                <button class="add-line"><Icon name="plus" :size="14" /> Add Condition</button>
              </div>
              </template>

              <!-- Display — custom widgets only. A predefined widget is Highlights and
                   the chart type, nothing else; the legend and data-label toggles are
                   configuration like any other. (This means a predefined widget's legend
                   can no longer be turned off anywhere — "Hide legend" left the ⋯ menu
                   too. That is the rule as stated.) -->
              <div v-if="isChart && !predefinedEdit" class="sec">
                <div class="sec-h">Display</div>

                <div v-if="manualMode" class="fld">
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
                    <b>Data labels</b>
                    <em>Print each slice’s value on the chart itself.</em>
                  </span>
                  <button class="tgl" :class="{ on: cfg.dataLabels }" role="switch" :aria-checked="cfg.dataLabels"
                    @click.prevent="cfg.dataLabels = !cfg.dataLabels"><i /></button>
                </label>

                <label v-if="manualMode && !predefinedEdit" class="toggle"><span>Exclude Zero Count Values</span><button class="sw" :class="{ on: cfg.excludeZero }" @click="cfg.excludeZero=!cfg.excludeZero"><i /></button></label>
              </div>

              <!-- Highlights (also the only editable section for a predefined widget) -->
              <div v-if="manualMode || predefinedEdit" class="sec">
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
                <button class="btn" :disabled="!canSave" :title="ctaHint" @click="save(false)">{{ prefix }} {{ ctaLabel }}</button>
                <button class="btn btn-primary" :disabled="!canSave" :title="ctaHint" @click="save(true)"><Icon name="plus" :size="16" /> {{ prefix }} &amp; Add {{ ctaLabel }}</button>
              </template>
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
.preview { flex: 1.5; display: flex; flex-direction: column; min-width: 0; padding: 18px 22px 22px; background: var(--bg); border-right: 1px solid var(--border); }
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
.pv-kpi { font-size: 72px; font-weight: 700; letter-spacing: -2px; text-align: center; }
.pv-kpi .d { font-size: 20px; color: var(--green); margin-left: 12px; font-weight: 600; }
.pv-tbl { width: 100%; border-collapse: collapse; font-size: 13px; align-self: start; }
.pv-tbl th { text-align: left; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .4px; padding: 7px 10px; border-bottom: 1px solid var(--border); }
.pv-tbl td { padding: 9px 10px; border-bottom: 1px solid var(--border); }
.pv-foot { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted); margin-top: 12px; }
.config { width: 480px; flex: none; display: flex; flex-direction: column; min-height: 0; }
.cfg-scroll { flex: 1; overflow: auto; padding: 18px 20px; }
.sec { padding-bottom: 18px; margin-bottom: 18px; border-bottom: 1px solid var(--border); }
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
.sec:last-child { border-bottom: none; margin-bottom: 0; }
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
  .preview { flex: none; height: 240px; border-right: none; border-bottom: 1px solid var(--border); }
  .config { width: auto; flex: 1; }
}
</style>
