<script setup>
/**
 * ChartTile — Apache ECharts renderer for widget tiles.
 *
 * Chart kinds: 'bar' | 'hbar' | 'line' | 'donut'. ECharts' built-in legend is
 * disabled; the legend is our own markup so it can evolve independently.
 *
 * Why ECharts (Apache-2.0): ServiceOps ships on-prem, so any chart library we
 * embed is *redistributed* to customers. Commercial libraries treat that as
 * OEM licensing. See docs/chart-library-and-competitor-dashboard-research.md.
 *
 * LEGEND MODES (docs/legend-and-topn-design.md). When a chart exceeds
 * HIGH_CARD entities, store.ui.legendStyle picks one of three strategies:
 *   2 Top-N + Other  bounded series set, explicit Other, rank pill
 *   4 Overflow chip  8 inline + "+N more" dropdown
 *   6 Merged ② + ④   rank pill + 8 inline + "+N more"; click a legend entry
 *                    to disable it and pull its data out of the chart
 * Below HIGH_CARD every chart renders mode 0: a plain, complete legend.
 * The doc still describes re-encode / series-manager / cardinality-gate — they
 * were prototyped, compared, and cut.
 */
import { computed, ref, shallowRef, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart, FunnelChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { store } from '../../store'
import Icon from '../ui/Icon.vue'
import SeriesManager from './SeriesManager.vue'

// Register only what we render. MarkLine/MarkArea come back with SLA threshold
// bands; DataZoom went out with the ranked-bar re-encode.
use([CanvasRenderer, BarChart, LineChart, PieChart, FunnelChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps({
  chart: Object,
  height: { type: Number, default: 180 },
  legend: { type: Boolean, default: true },
})

/* Categorical palette: every adjacent pair must be separable at a 9px legend
 * swatch and as a thin donut arc. The old palette opened with two blues
 * (#3d8bd0, #3279be) that were indistinguishable — anti-pattern 14 in
 * docs/chart-library-and-competitor-dashboard-research.md.
 * Beyond 10 series colour stops carrying meaning; the legend must. */
const PAL = [
  '#3d8bd0', '#1f9d63', '#d98a0b', '#e0483d', '#8b5cf6',
  '#16b1c4', '#d9488f', '#6b7f95', '#7a9a01', '#b8560f',
]
const OTHER_COLOR = '#9aa8b8'

/* Priority and Status are ordinal/semantic, not nominal — painting P1 calm-blue
 * because it happens to be slice 0 is confidently wrong. These win over PAL. */
const SEMANTIC = {
  p1: '#e0483d', p2: '#d98a0b', p3: '#3d8bd0', p4: '#8fa3b8',
  open: '#3d8bd0', 'in progress': '#d98a0b', pending: '#3d8bd0',
  resolved: '#1f9d63', closed: '#1f9d63', compliant: '#1f9d63',
  breached: '#e0483d', overdue: '#e0483d', failed: '#e0483d', critical: '#e0483d',
}

const HIGH_CARD = 12

const kind = computed(() => props.chart?.kind || 'bar')
const labels = computed(() => props.chart?.labels || [])
const series = computed(() => props.chart?.series || [])
/* Part-of-whole charts name *slices*; cartesian charts name *series*, because
 * their categories already sit on the axis and need no key. */
const SLICE_KINDS = ['pie', 'donut', 'funnel', 'pyramid']
const sliceBased = computed(() => SLICE_KINDS.includes(kind.value))

/* --- entities: the things a legend would name. Slices for single-series
 * charts, series for multi-series charts. Everything below works on these. --- */
const overrides = ref({})
function baseColor(name, i) {
  return overrides.value[name] || SEMANTIC[String(name).toLowerCase()] || PAL[i % PAL.length]
}
const entities = computed(() => {
  if (sliceBased.value) {
    const vals = series.value[0]?.values || []
    return labels.value.map((name, i) => ({ key: name, name, value: vals[i] ?? 0, color: baseColor(name, i) }))
  }
  return series.value.map((s, i) => ({
    key: s.name, name: s.name,
    value: s.values.reduce((a, b) => a + b, 0),
    color: baseColor(s.name, i),
  }))
})

/* THE denominator. Always the pre-truncation total — a Top-10 view of 63
 * categories must still report "% of all tickets", never "% of the shown 10". */
const trueTotal = computed(() => entities.value.reduce((a, e) => a + e.value, 0) || 1)

const isHighCard = computed(() => entities.value.length > HIGH_CARD)
/* Low-cardinality charts ignore the demo entirely and render as they always did. */
const mode = computed(() => (isHighCard.value ? store.ui.legendStyle : 0))

/* --- hidden series (modes 3 & 4) --- */
const hidden = ref(new Set())
const lastClicked = ref(null)
watch(() => props.chart, () => { hidden.value = new Set() })
// switching legend strategy starts from a clean series selection
watch(mode, () => { hidden.value = new Set(); lastClicked.value = null })

/* In ⑥ the rank window already bounds what's on the chart, so hiding acts on the
 * windowed set (plus Other) — hiding a series that isn't plotted is meaningless. */
function isolate(key) {
  const others = manageable.value.filter((e) => e.key !== key).map((e) => e.key)
  // clicking the already-isolated series restores everything
  hidden.value = hidden.value.size === others.length && !hidden.value.has(key) ? new Set() : new Set(others)
  lastClicked.value = key
}
function toggle(key) {
  const s = new Set(hidden.value)
  s.has(key) ? s.delete(key) : s.add(key)
  hidden.value = s
  lastClicked.value = key
}
function rangeTo(key) {
  const keys = manageable.value.map((e) => e.key)
  const a = keys.indexOf(lastClicked.value ?? key), b = keys.indexOf(key)
  const [lo, hi] = a < b ? [a, b] : [b, a]
  const s = new Set(hidden.value)
  for (let i = lo; i <= hi; i++) s.delete(keys[i])
  hidden.value = s
}
function resetSeries() { hidden.value = new Set(); lastClicked.value = null }
function bulk({ verb, keys, n }) {
  const list = manageable.value
  const all = list.map((e) => e.key)
  if (verb === 'all') hidden.value = new Set()
  else if (verb === 'none') hidden.value = new Set(all)
  else if (verb === 'invert') hidden.value = new Set(all.filter((k) => !hidden.value.has(k)))
  else if (verb === 'top') {
    const keep = new Set([...list].sort((a, b) => b.value - a.value).slice(0, n).map((e) => e.key))
    hidden.value = new Set(all.filter((k) => !keep.has(k)))
  } else if (verb === 'hide') hidden.value = new Set([...hidden.value, ...keys])
  else if (verb === 'only') hidden.value = new Set(all.filter((k) => !keys.includes(k)))
}
function recolor({ key, color }) { overrides.value = { ...overrides.value, [key]: color } }

/* --- mode 2: the rank window. "Top N" is one window onto a sorted list;
 * bottom / rank-range / coverage are the others. Range is what lets a user
 * reach the middle of the distribution at all. --- */
const rankMode = ref('top')      // top | bottom | range | coverage | all
const rankN = ref(10)
const rangeFrom = ref(11)
const rangeTo_ = ref(20)
const coverage = ref(90)
const rankOpen = ref(false)

const RANKS = [
  { id: 'top', label: 'Top N' },
  { id: 'bottom', label: 'Bottom N' },
  { id: 'range', label: 'Custom range' },
  { id: 'coverage', label: 'Coverage %' },
  { id: 'all', label: 'All' },
]
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo))

const sortedDesc = computed(() => [...entities.value].sort((a, b) => b.value - a.value))
const windowed = computed(() => {
  const s = sortedDesc.value, n = s.length
  if (!n) return s
  if (rankMode.value === 'all') return s
  if (rankMode.value === 'bottom') return s.slice(n - clamp(rankN.value, 1, n))
  if (rankMode.value === 'range') {
    const from = clamp(rangeFrom.value, 1, n)
    return s.slice(from - 1, clamp(rangeTo_.value, from, n))
  }
  if (rankMode.value === 'coverage') {
    const target = (clamp(coverage.value, 1, 100) / 100) * trueTotal.value
    const out = []; let run = 0
    for (const e of s) { out.push(e); run += e.value; if (run >= target) break }
    return out
  }
  return s.slice(0, clamp(rankN.value, 1, n))
})
const otherCount = computed(() => entities.value.length - windowed.value.length)
const otherValue = computed(() => trueTotal.value - windowed.value.reduce((a, e) => a + e.value, 0))
const otherRow = computed(() => ({ key: '__other', name: `Other (${otherCount.value})`, value: otherValue.value, color: OTHER_COLOR }))
const censusLabel = computed(() => {
  const n = windowed.value.length, t = entities.value.length
  if (rankMode.value === 'all') return `All ${t}`
  if (rankMode.value === 'bottom') return `Bottom ${n} of ${t}`
  if (rankMode.value === 'range') return `Rank ${clamp(rangeFrom.value, 1, t)}–${clamp(rangeTo_.value, 1, t)} of ${t}`
  if (rankMode.value === 'coverage') return `${n} of ${t} · ${clamp(coverage.value, 1, 100)}% of volume`
  return `Top ${n} of ${t}`
})
// a new window is a new visible set — stale hidden keys would silently persist
watch([rankMode, rankN, rangeFrom, rangeTo_, coverage], () => { hidden.value = new Set() })

/* Modes that bound the series set to a rank window (Top/Bottom/Range/Coverage). */
const rankModes = computed(() => mode.value === 2 || mode.value === 6)

/* Everything the legend names — hidden entries included, so a disabled series
 * stays on screen (struck through) and can be switched back on. */
const legendAll = computed(() => {
  if (!rankModes.value) return entities.value
  const rows = [...windowed.value]
  if (otherCount.value > 0) rows.push(otherRow.value)
  return rows
})

/* What the legend controls and the dropdown lists. */
const manageable = computed(() => (mode.value === 6 ? legendAll.value : entities.value))

/* --- which entities actually reach the chart, per mode --- */
const plotted = computed(() => {
  if (mode.value === 6) return legendAll.value.filter((e) => !hidden.value.has(e.key))
  if (rankModes.value) return legendAll.value
  if (mode.value === 4) return entities.value.filter((e) => !hidden.value.has(e.key))
  return entities.value
})

/* --- theme: read design tokens at runtime so dark mode Just Works --- */
const themeTick = ref(0)
watch(() => store.ui.theme, () => { themeTick.value++ })
const cssVar = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f
const tokens = computed(() => {
  themeTick.value
  return {
    ink: cssVar('--ink', '#364658'), ink2: cssVar('--ink-2', '#4f6075'),
    muted: cssVar('--muted', '#7b8fa5'), border: cssVar('--border', '#dfe5ed'),
    surface: cssVar('--surface', '#ffffff'), font: cssVar('--font', 'Poppins, sans-serif'),
    primary: cssVar('--primary', '#3d8bd0'),
  }
})
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* --- legend hover → native ECharts highlight/downplay --- */
const chartRef = shallowRef(null)
const legendHover = ref(null)
function emphasise(key) {
  legendHover.value = key
  const inst = chartRef.value; if (!inst) return
  const i = plotted.value.findIndex((e) => e.key === key); if (i < 0) return
  if (sliceBased.value) inst.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: i })
  else inst.dispatchAction({ type: 'highlight', seriesIndex: i })
}
function relax() { legendHover.value = null; chartRef.value?.dispatchAction({ type: 'downplay' }) }

const pctOf = (v) => ((v / trueTotal.value) * 100).toFixed(2)
const dot = (c) => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin-right:7px"></span>`

const option = computed(() => {
  const t = tokens.value
  const k = kind.value
  const rows = plotted.value

  const tip = {
    backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, padding: [6, 10],
    extraCssText: 'box-shadow: 0 8px 28px rgba(27,28,46,.18); border-radius: 8px;',
    textStyle: { color: t.ink2, fontSize: 12, fontFamily: t.font },
  }
  const axis = {
    axisLine: { show: false }, axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: 11, fontFamily: t.font },
  }
  const anim = reduceMotion
    ? { animation: false }
    : { animation: true, animationDuration: 550, animationEasing: 'cubicOut', animationDelay: (i) => i * 20 }

  const sliceTip = { ...tip, trigger: 'item', formatter: (p) => `${dot(p.color)}${p.name}: ${pctOf(p.value)}% <b style="color:${t.ink}">(${p.value})</b>` }
  const sliceData = rows.map((e) => ({ name: e.name, value: e.value, itemStyle: { color: e.color } }))

  /* Pie / Doughnut — same series, different inner radius. */
  if (k === 'pie' || k === 'donut') {
    return {
      tooltip: sliceTip,
      legend: { show: false },
      series: [{
        type: 'pie',
        radius: k === 'donut' ? ['52%', '78%'] : ['0%', '74%'],
        center: ['50%', '50%'],
        label: { show: false }, labelLine: { show: false },
        itemStyle: { borderColor: t.surface, borderWidth: 2 },
        emphasis: { focus: 'self', scale: true, scaleSize: 4 },
        blur: { itemStyle: { opacity: 0.18 } },
        data: sliceData,
        ...(reduceMotion ? { animation: false } : { animationType: 'expansion', animationDuration: 600, animationEasing: 'cubicOut' }),
      }],
    }
  }

  /* Funnel / Pyramid — the same series, sorted the other way up. */
  if (k === 'funnel' || k === 'pyramid') {
    return {
      tooltip: sliceTip,
      legend: { show: false },
      series: [{
        type: 'funnel',
        left: '8%', right: '8%', top: 10, bottom: 10,
        sort: k === 'funnel' ? 'descending' : 'ascending',
        gap: 2, minSize: '12%',
        label: { show: false },
        itemStyle: { borderColor: t.surface, borderWidth: 2 },
        emphasis: { focus: 'self' },
        blur: { itemStyle: { opacity: 0.18 } },
        data: sliceData,
      }],
      ...anim,
    }
  }

  const splitLine = { show: true, lineStyle: { color: t.border, type: 'dashed', opacity: 0.7 } }

  /* Cartesian: bar (column) | hbar (horizontal) | line | area.
   * Here entities are *series*, so hiding one drops it from the plot. */
  const shown = series.value.filter((s) => !hidden.value.has(s.name))
  const isArea = k === 'area'
  const isLine = k === 'line' || isArea
  const horizontal = k === 'hbar'
  const cat = { type: 'category', data: labels.value, ...axis, boundaryGap: !isLine, ...(horizontal ? { inverse: true } : {}) }
  const val = { type: 'value', ...axis, splitLine }
  return {
    tooltip: {
      ...tip, trigger: 'axis', axisPointer: { type: isLine ? 'line' : 'shadow', lineStyle: { color: t.border } },
      formatter: (ps) => {
        const head = `<div style="color:${t.ink};font-weight:600;margin-bottom:3px">${ps[0]?.axisValueLabel ?? ''}</div>`
        const body = ps.map((p) => `<div style="white-space:nowrap">${dot(p.color)}${shown.length > 1 ? p.seriesName : ps[0]?.axisValueLabel ?? ''}: ${pctOf(p.value)}% <b style="color:${t.ink}">(${p.value})</b></div>`).join('')
        return shown.length > 1 ? head + body : body
      },
    },
    legend: { show: false },
    grid: { left: 6, right: 14, top: 14, bottom: 4, containLabel: true },
    xAxis: horizontal ? val : cat,
    yAxis: horizontal ? cat : val,
    series: shown.map((s) => ({
      name: s.name, type: isLine ? 'line' : 'bar', data: s.values,
      barMaxWidth: 26,
      itemStyle: { borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0], color: baseColor(s.name, series.value.indexOf(s)) },
      lineStyle: isLine ? { width: 2.5, cap: 'round', join: 'round' } : undefined,
      // the fill is what separates Area from Line
      areaStyle: isArea ? { opacity: 0.18 } : undefined,
      smooth: isLine ? 0.35 : undefined,
      symbolSize: isLine ? 7 : undefined,
      emphasis: { focus: 'series' },
      blur: { itemStyle: { opacity: 0.18 }, lineStyle: { opacity: 0.18 }, areaStyle: { opacity: 0.04 } },
    })),
    ...anim,
  }
})

/* --- legend rendering decisions --- */
/* ③ and ④ both keep the chart at full card width and reach the series list
 * through a chip. Neither reserves layout space for it — a 250px column inside
 * the card squeezed the chart into a corner. */
const chipModes = computed(() => mode.value === 4 || mode.value === 6)
const showInlineLegend = computed(() => props.legend)
/* ⑥ keeps disabled series in the legend (struck through) so they can be
 * switched back on; ④ drops them, since the dropdown is the way back. */
const legendEntries = computed(() => (mode.value === 6 ? legendAll.value : plotted.value))
const inlineEntries = computed(() => (chipModes.value ? legendEntries.value.slice(0, 8) : legendEntries.value))
/* Count against the manageable set, not the plotted one. Isolating a series
 * shrinks `plotted` to 1 — measured that way the chip would delete itself and
 * strand the user with no route back to the rest. */
const overflowCount = computed(() =>
  chipModes.value ? Math.max(0, manageable.value.length - inlineEntries.value.length) : 0)
// clicking a legend entry disables it and pulls its data out of the chart
const legendClickable = computed(() => chipModes.value)

/* The panel floats above the whole tile. It has to be teleported: anchored
 * inside .chart it gets clipped by the card's overflow:hidden and follows the
 * chart box instead of the chip. */
const panelOpen = ref(false)
const moreBtn = ref(null)
const rankBtn = ref(null)
const POP_W = 300
const BLANK = { left: '0px', top: 'auto', bottom: '0px', maxH: '360px', arrow: '0px', below: false }
const pop = ref({ ...BLANK })
const rankPos = ref({ ...BLANK })

/* Anchor a floating panel to a trigger, in viewport coords: centred on it,
 * clamped to the edges, flipped below when there is no room above.
 * Above the trigger we pin the *bottom* edge — pinning `top` at
 * `trigger.top - maxH` only lands flush for panels that actually fill maxH,
 * and leaves shorter ones floating away from their arrow. */
function anchor(el, W, cap) {
  const r = el?.getBoundingClientRect()
  if (!r) return null
  const GAP = 8, EDGE = 8
  const roomAbove = r.top - EDGE
  const roomBelow = window.innerHeight - r.bottom - EDGE
  const below = roomAbove < 200 && roomBelow > roomAbove
  const maxH = Math.min(cap, Math.max(170, (below ? roomBelow : roomAbove) - GAP))
  const left = Math.max(EDGE, Math.min(r.left + r.width / 2 - W / 2, window.innerWidth - W - EDGE))
  return {
    left: left + 'px',
    top: below ? r.bottom + GAP + 'px' : 'auto',
    bottom: below ? 'auto' : window.innerHeight - r.top + GAP + 'px',
    maxH: maxH + 'px',
    below,
    arrow: r.left + r.width / 2 - left + 'px',
  }
}
const RANK_W = 330
function placePop() { const p = anchor(moreBtn.value, POP_W, 360); if (p) pop.value = p }
function placeRank() { const p = anchor(rankBtn.value, RANK_W, 320); if (p) rankPos.value = p }
function reflow() { if (panelOpen.value) placePop(); if (rankOpen.value) placeRank() }

function togglePanel() { rankOpen.value = false; panelOpen.value = !panelOpen.value; if (panelOpen.value) nextTick(placePop) }
function toggleRank() { panelOpen.value = false; rankOpen.value = !rankOpen.value; if (rankOpen.value) nextTick(placeRank) }
function closePops() { panelOpen.value = false; rankOpen.value = false }
function onDocKey(e) { if (e.key === 'Escape') closePops() }

const anyPop = computed(() => panelOpen.value || rankOpen.value)
watch(anyPop, (open) => {
  const fn = open ? addEventListener : removeEventListener
  fn.call(window, 'scroll', reflow, true)   // capture: the board scrolls, not the window
  fn.call(window, 'resize', reflow)
  fn.call(window, 'keydown', onDocKey)
})
watch(mode, closePops)
// hiding series reflows the inline legend, which moves the chip under the panel
watch(inlineEntries, () => nextTick(reflow))
onBeforeUnmount(() => {
  removeEventListener('scroll', reflow, true)
  removeEventListener('resize', reflow)
  removeEventListener('keydown', onDocKey)
})

let raf = 0
onMounted(() => { raf = requestAnimationFrame(() => chartRef.value?.resize()) })
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="chart" :style="{ height: height + 'px' }">
      <div class="chart-row">
        <VChart
          ref="chartRef" class="ec" :option="option"
          :init-options="{ renderer: 'canvas' }" :update-options="{ notMerge: true }" autoresize
        />
      </div>

      <!-- ② only: the "Other" residue spelled out beneath the chart -->
      <div v-if="mode === 2" class="census">
        <span v-if="otherCount > 0" class="cs-note">
          <i :style="{ background: OTHER_COLOR }" /> Other = {{ otherCount }} more ({{ pctOf(otherValue) }}% of total)
        </span>
      </div>

      <!-- inline legend (classic ⓪, bounded ②, truncated ④, merged ⑥) -->
      <div v-if="showInlineLegend" class="legend">
        <!-- the rank pill sits before the legend and states the truncation -->
        <button
          v-if="rankModes" ref="rankBtn" class="cs-chip" :class="{ on: rankOpen }"
          title="Choose which slice of the ranking to plot" @click.stop="toggleRank"
        >
          <Icon name="filter" :size="12" /> {{ censusLabel }}
          <Icon name="chevron-down" :size="13" />
        </button>

        <span
          v-for="e in inlineEntries" :key="e.key" class="lg"
          :class="{ faded: legendHover !== null && legendHover !== e.key, off: hidden.has(e.key), click: legendClickable }"
          :title="legendClickable ? (hidden.has(e.key) ? `Show ${e.name}` : `Hide ${e.name}`) : e.name"
          @mouseenter="emphasise(e.key)" @mouseleave="relax()"
          @click="legendClickable && toggle(e.key)"
        ><i :style="{ background: e.color }" />{{ e.name }}
          <b v-if="sliceBased">{{ pctOf(e.value) }}%</b>
        </span>

        <!-- ④/⑥ the chip is the only handle: nothing is hidden without saying so -->
        <button v-if="chipModes && overflowCount" ref="moreBtn" class="more" :class="{ on: panelOpen }" @click.stop="togglePanel">
          +{{ overflowCount }} more
        </button>
      </div>

      <teleport to="body">
        <div v-if="anyPop" class="more-back" @click="closePops" @wheel.prevent />

        <!-- series dropdown: floats over the tile, never inside it -->
        <div
          v-if="panelOpen && chipModes" class="more-pop" :class="{ below: pop.below }"
          :style="{ left: pop.left, top: pop.top, bottom: pop.bottom, width: POP_W + 'px', maxHeight: pop.maxH }"
          @click.stop
        >
          <span class="mp-arrow" :style="{ left: pop.arrow }" />
          <header class="mp-h">{{ mode === 6 ? censusLabel : `All ${entities.length} series` }}<button class="mp-x" @click="closePops"><Icon name="x" :size="14" /></button></header>
          <SeriesManager
            compact :entities="manageable" :hidden="hidden" :total="trueTotal"
            @isolate="isolate" @toggle="toggle" @range="rangeTo" @reset="resetSeries"
            @bulk="bulk" @recolor="recolor"
          />
        </div>

        <!-- rank window: tabs + one field each -->
        <div
          v-if="rankOpen && rankModes" class="more-pop rank-pop" :class="{ below: rankPos.below }"
          :style="{ left: rankPos.left, top: rankPos.top, bottom: rankPos.bottom, width: RANK_W + 'px' }"
          @click.stop
        >
          <span class="mp-arrow" :style="{ left: rankPos.arrow }" />
          <header class="mp-h">Which slice of the ranking?<button class="mp-x" @click="closePops"><Icon name="x" :size="14" /></button></header>

          <div class="rp-tabs">
            <button v-for="r in RANKS" :key="r.id" class="rp-t" :class="{ on: rankMode === r.id }" @click="rankMode = r.id">{{ r.label }}</button>
          </div>

          <div class="rp-field">
            <template v-if="rankMode === 'top' || rankMode === 'bottom'">
              <label>Show the</label>
              <input class="rp-n" type="number" min="1" :max="entities.length" v-model.number="rankN" />
              <span>{{ rankMode === 'top' ? 'largest' : 'smallest' }} of {{ entities.length }}</span>
            </template>
            <template v-else-if="rankMode === 'range'">
              <label>Ranks</label>
              <input class="rp-n" type="number" min="1" :max="entities.length" v-model.number="rangeFrom" />
              <span class="rp-d">to</span>
              <input class="rp-n" type="number" min="1" :max="entities.length" v-model.number="rangeTo_" />
              <span>— reach the middle of the distribution</span>
            </template>
            <template v-else-if="rankMode === 'coverage'">
              <label>Cover</label>
              <input class="rp-n" type="number" min="1" max="100" v-model.number="coverage" />
              <span>% of total volume — the tail collapses itself</span>
            </template>
            <template v-else>
              <span class="rp-warn"><Icon name="alert" :size="13" /> All {{ entities.length }} series. Colour stops carrying meaning past about 10.</span>
            </template>
          </div>

          <p class="rp-f">
            <template v-if="otherCount > 0">The remaining {{ otherCount }} roll into <b>Other</b> — nothing is dropped.<br /></template>
            Percentages always use the full {{ trueTotal }}-record total, never the visible subset.
          </p>
        </div>
      </teleport>
  </div>
</template>

<style scoped>
.chart { display: flex; flex-direction: column; min-width: 0; position: relative; }
.chart-row { flex: 1; display: flex; min-height: 0; gap: 10px; }
.ec { flex: 1; min-height: 0; min-width: 0; }

.legend { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 12px; padding: 6px 4px 0; flex: none; }
.lg { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted); cursor: pointer; transition: opacity .12s; user-select: none; }
.lg.faded { opacity: .4; }
.lg i { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.lg b { color: var(--ink-2); }
/* a disabled series stays in the legend, struck through, so it can come back */
.lg.off { opacity: .42; }
.lg.off i { background: var(--muted-2) !important; }
.lg.off, .lg.off b { text-decoration: line-through; }
.lg.click:hover { color: var(--ink); }
.more { display: inline-flex; align-items: center; gap: 4px; border: 1px dashed var(--border-strong); background: var(--surface); color: var(--primary-700); border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 600; }
.more:hover, .more.on { background: var(--primary-soft); border-style: solid; border-color: var(--primary); }

/* ④ overflow popover — teleported to <body>, so it floats over the whole card
   instead of being clipped by it. Positioned in viewport coords from the chip. */
.more-back { position: fixed; inset: 0; z-index: 299; }
.more-pop { position: fixed; z-index: 300; display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh-pop); }
.more-pop > * { flex: 1; min-height: 0; }
.mp-arrow { position: absolute; bottom: -6px; width: 10px; height: 10px; flex: none; background: var(--surface); border: 1px solid var(--border); border-top: none; border-left: none; transform: translateX(-50%) rotate(45deg); }
.more-pop.below .mp-arrow { top: -6px; bottom: auto; border: 1px solid var(--border); border-bottom: none; border-right: none; }
.mp-h { display: flex; align-items: center; justify-content: space-between; flex: none; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); }
.mp-x { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; padding: 2px; border-radius: 5px; }
.mp-x:hover { background: var(--surface-2); color: var(--ink); }

/* ② the "Other" residue, spelled out */
.census { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 7px 2px 0; flex: none; flex-wrap: wrap; }
.cs-note { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); }
.cs-note i { width: 9px; height: 9px; border-radius: 3px; }

/* the rank pill — first item in the legend row */
.cs-chip { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); border-radius: 999px; font-size: 11.5px; font-weight: 600; flex: none; }
.cs-chip:hover, .cs-chip.on { border-color: var(--primary); color: var(--primary-700); background: var(--primary-soft); }

/* rank window — tabs, then the one field that tab needs */
.rank-pop { gap: 8px; padding: 10px 12px; }
.rank-pop > * { flex: none; }
.rp-tabs { display: flex; gap: 2px; padding: 2px; background: var(--surface-2); border-radius: 7px; }
.rp-t { flex: 1; height: 26px; border: none; background: transparent; color: var(--muted); border-radius: 5px; font-size: 11px; font-weight: 600; white-space: nowrap; padding: 0 4px; }
.rp-t:hover { color: var(--ink); }
.rp-t.on { background: var(--surface); color: var(--primary-700); box-shadow: var(--sh-sm); }
.rp-field { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-height: 30px; font-size: 12px; color: var(--muted); }
.rp-field label { font-size: 12px; color: var(--ink-2); font-weight: 500; }
.rp-n { width: 56px; height: 26px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--ink); font: inherit; font-size: 12px; font-weight: 600; text-align: center; }
.rp-n:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.rp-d { color: var(--muted); font-size: 12px; }
.rp-warn { display: inline-flex; align-items: center; gap: 6px; color: var(--amber); font-size: 11.5px; line-height: 1.4; }
.rp-f { margin: 0; padding-top: 7px; border-top: 1px solid var(--border); font-size: 10.5px; line-height: 1.5; color: var(--muted); }
.rp-f b { color: var(--ink-2); }

</style>
