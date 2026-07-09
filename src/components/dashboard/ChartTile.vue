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
 * HIGH_CARD entities, store.ui.legendStyle picks one of five strategies:
 *   1 Re-encode     ranked hbar, names on the axis, no legend at all
 *   2 Top-N + Other bounded series set, explicit Other, census chip
 *   3 Series manager searchable side panel with bulk verbs
 *   4 Overflow chip 8 inline + "+N more" popover
 *   5 Cardinality gate  refuse to render; make the author choose
 */
import { computed, ref, shallowRef, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent, TooltipComponent, LegendComponent,
  MarkLineComponent, MarkAreaComponent, DataZoomComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { store } from '../../store'
import Icon from '../ui/Icon.vue'
import SeriesManager from './SeriesManager.vue'
import DataTable from './DataTable.vue'

use([
  CanvasRenderer, BarChart, LineChart, PieChart,
  GridComponent, TooltipComponent, LegendComponent,
  MarkLineComponent, MarkAreaComponent, DataZoomComponent,
])

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
/* A legend names slices on a donut, but series on a bar/line — there the
 * categories already sit on the x-axis and need no key. */
const sliceBased = computed(() => kind.value === 'donut')

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
watch(() => props.chart, () => { hidden.value = new Set(); gateChoice.value = null })
// switching legend strategy starts from a clean series selection
watch(mode, () => { hidden.value = new Set(); lastClicked.value = null; gateChoice.value = null })

function isolate(key) {
  const others = entities.value.filter((e) => e.key !== key).map((e) => e.key)
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
  const keys = entities.value.map((e) => e.key)
  const a = keys.indexOf(lastClicked.value ?? key), b = keys.indexOf(key)
  const [lo, hi] = a < b ? [a, b] : [b, a]
  const s = new Set(hidden.value)
  for (let i = lo; i <= hi; i++) s.delete(keys[i])
  hidden.value = s
}
function resetSeries() { hidden.value = new Set(); lastClicked.value = null }
function bulk({ verb, keys, n }) {
  const all = entities.value.map((e) => e.key)
  if (verb === 'all') hidden.value = new Set()
  else if (verb === 'none') hidden.value = new Set(all)
  else if (verb === 'invert') hidden.value = new Set(all.filter((k) => !hidden.value.has(k)))
  else if (verb === 'top') {
    const keep = new Set([...entities.value].sort((a, b) => b.value - a.value).slice(0, n).map((e) => e.key))
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

const sortedDesc = computed(() => [...entities.value].sort((a, b) => b.value - a.value))
const windowed = computed(() => {
  const s = sortedDesc.value
  if (rankMode.value === 'bottom') return s.slice(Math.max(0, s.length - rankN.value))
  if (rankMode.value === 'range') return s.slice(Math.max(0, rangeFrom.value - 1), rangeTo_.value)
  if (rankMode.value === 'all') return s
  if (rankMode.value === 'coverage') {
    const target = (coverage.value / 100) * trueTotal.value
    const out = []; let run = 0
    for (const e of s) { out.push(e); run += e.value; if (run >= target) break }
    return out
  }
  return s.slice(0, rankN.value)
})
const otherCount = computed(() => entities.value.length - windowed.value.length)
const otherValue = computed(() => trueTotal.value - windowed.value.reduce((a, e) => a + e.value, 0))
const censusLabel = computed(() => {
  const n = windowed.value.length, t = entities.value.length
  if (rankMode.value === 'all') return `All ${t}`
  if (rankMode.value === 'bottom') return `Bottom ${n} of ${t}`
  if (rankMode.value === 'range') return `Rank ${rangeFrom.value}–${rangeTo_.value} of ${t}`
  if (rankMode.value === 'coverage') return `${n} of ${t} · ${coverage.value}% of volume`
  return `Top ${n} of ${t}`
})

/* --- mode 5: the gate. Refuse to render; make the author pick. --- */
const gateChoice = ref(null)   // null | 'topn' | 'bar' | 'table' | 'all'

/* --- which entities actually reach the chart, per mode --- */
const plotted = computed(() => {
  if (mode.value === 2 || (mode.value === 5 && gateChoice.value === 'topn')) {
    const rows = [...windowed.value]
    if (otherCount.value > 0) rows.push({ key: '__other', name: `Other (${otherCount.value})`, value: otherValue.value, color: OTHER_COLOR })
    return rows
  }
  if (mode.value === 3 || mode.value === 4) return entities.value.filter((e) => !hidden.value.has(e.key))
  return entities.value
})

/* mode 1, and the gate's "ranked bar" answer, re-encode as a ranked hbar:
 * category names live on the axis, so no legend and no colour are needed. */
const reEncoded = computed(() => mode.value === 1 || (mode.value === 5 && gateChoice.value === 'bar'))
const asTable = computed(() => mode.value === 5 && gateChoice.value === 'table')
const gated = computed(() => mode.value === 5 && !gateChoice.value)
const effectiveKind = computed(() => (reEncoded.value ? 'hbar' : kind.value))

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
  const k = effectiveKind.value
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

  if (k === 'donut') {
    return {
      tooltip: { ...tip, trigger: 'item', formatter: (p) => `${dot(p.color)}${p.name}: ${pctOf(p.value)}% <b style="color:${t.ink}">(${p.value})</b>` },
      legend: { show: false },
      series: [{
        type: 'pie', radius: ['52%', '78%'], center: ['50%', '50%'],
        label: { show: false }, labelLine: { show: false },
        itemStyle: { borderColor: t.surface, borderWidth: 2 },
        emphasis: { focus: 'self', scale: true, scaleSize: 4 },
        blur: { itemStyle: { opacity: 0.18 } },
        data: rows.map((e) => ({ name: e.name, value: e.value, itemStyle: { color: e.color } })),
        ...(reduceMotion ? { animation: false } : { animationType: 'expansion', animationDuration: 600, animationEasing: 'cubicOut' }),
      }],
    }
  }

  const splitLine = { show: true, lineStyle: { color: t.border, type: 'dashed', opacity: 0.7 } }

  /* ① Re-encode: a ranked horizontal bar of the *slices*. One colour, names on
   * the axis, dataZoom to scroll — the direct answer to "I can't reach the
   * categories between rank 11 and rank 50". No legend is emitted at all. */
  if (reEncoded.value) {
    const ranked = [...rows].sort((a, b) => a.value - b.value)   // ECharts draws category axis bottom-up
    const win = Math.min(100, (12 / Math.max(1, ranked.length)) * 100)
    return {
      tooltip: { ...tip, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps) => `${dot(ps[0].color)}${ps[0].name}: ${pctOf(ps[0].value)}% <b style="color:${t.ink}">(${ps[0].value})</b>` },
      legend: { show: false },
      grid: { left: 6, right: 30, top: 10, bottom: 4, containLabel: true },
      xAxis: { type: 'value', ...axis, splitLine },
      yAxis: { type: 'category', data: ranked.map((e) => e.name), ...axis, axisLabel: { ...axis.axisLabel, width: 130, overflow: 'truncate' } },
      dataZoom: [
        { type: 'inside', yAxisIndex: 0, start: 100 - win, end: 100, zoomOnMouseWheel: false, moveOnMouseWheel: true },
        { type: 'slider', yAxisIndex: 0, start: 100 - win, end: 100, width: 10, right: 4, borderColor: 'transparent', backgroundColor: t.border, fillerColor: t.primary + '33', handleStyle: { color: t.primary }, showDetail: false },
      ],
      series: [{ type: 'bar', barMaxWidth: 18, itemStyle: { borderRadius: [0, 3, 3, 0], color: t.primary }, data: ranked.map((e) => e.value), emphasis: { focus: 'series' } }],
      ...anim,
    }
  }

  /* Cartesian: bar (column) | hbar (native horizontal) | line.
   * Here entities are *series*, so hiding one drops it from the plot. */
  const shown = series.value.filter((s) => !hidden.value.has(s.name) || mode.value < 3)
  const isLine = k === 'line'
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
      areaStyle: isLine ? { opacity: 0.12 } : undefined,
      smooth: isLine ? 0.35 : undefined,
      symbolSize: isLine ? 7 : undefined,
      emphasis: { focus: 'series' },
      blur: { itemStyle: { opacity: 0.18 }, lineStyle: { opacity: 0.18 }, areaStyle: { opacity: 0.04 } },
    })),
    ...anim,
  }
})

/* --- legend rendering decisions --- */
const showInlineLegend = computed(() =>
  props.legend && !gated.value && !asTable.value && !reEncoded.value && (mode.value === 0 || mode.value === 2 || mode.value === 4))
const inlineEntries = computed(() => (mode.value === 4 ? plotted.value.slice(0, 8) : plotted.value))
/* Count against *all* entities, not the plotted ones. Isolating a series from
 * the popover shrinks `plotted` to 1 — measured that way the chip would delete
 * itself and strand the user with no route back to the other 62. */
const overflowCount = computed(() =>
  mode.value === 4 ? Math.max(0, entities.value.length - inlineEntries.value.length) : 0)

/* ④ The overflow popover floats above the whole tile. It has to be teleported:
 * anchored inside .chart it gets clipped by the card's overflow:hidden and
 * follows the chart box instead of the chip. */
const POP_W = 300
const overflowOpen = ref(false)
const moreBtn = ref(null)
const pop = ref({ left: 0, top: 0, maxH: 340, arrow: POP_W / 2, below: false })

function placePop() {
  const r = moreBtn.value?.getBoundingClientRect()
  if (!r) return
  const GAP = 8, EDGE = 8
  const roomAbove = r.top - EDGE
  const roomBelow = window.innerHeight - r.bottom - EDGE
  const below = roomAbove < 220 && roomBelow > roomAbove
  const maxH = Math.min(360, Math.max(180, (below ? roomBelow : roomAbove) - GAP))
  const left = Math.max(EDGE, Math.min(r.left + r.width / 2 - POP_W / 2, window.innerWidth - POP_W - EDGE))
  pop.value = {
    left,
    top: below ? r.bottom + GAP : r.top - GAP - maxH,
    maxH, below,
    arrow: r.left + r.width / 2 - left,
  }
}
function toggleOverflow() {
  overflowOpen.value = !overflowOpen.value
  if (overflowOpen.value) nextTick(placePop)
}
function closeOverflow() { overflowOpen.value = false }
function onDocKey(e) { if (e.key === 'Escape') closeOverflow() }

watch(overflowOpen, (open) => {
  const fn = open ? addEventListener : removeEventListener
  fn.call(window, 'scroll', placePop, true)   // capture: the board scrolls, not the window
  fn.call(window, 'resize', placePop)
  fn.call(window, 'keydown', onDocKey)
})
watch(mode, closeOverflow)
// hiding series reflows the inline legend, which moves the chip under the popover
watch(inlineEntries, () => { if (overflowOpen.value) nextTick(placePop) })
onBeforeUnmount(() => {
  removeEventListener('scroll', placePop, true)
  removeEventListener('resize', placePop)
  removeEventListener('keydown', onDocKey)
})

/* table view (gate option 3) */
const tableRows = computed(() => sortedDesc.value.map((e) => [e.name, String(e.value), `${pctOf(e.value)}%`]))

let raf = 0
onMounted(() => { raf = requestAnimationFrame(() => chartRef.value?.resize()) })
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="chart" :style="{ height: height + 'px' }">
    <!-- ⑤ Cardinality gate: refuse to render an unreadable chart; make the choice explicit -->
    <div v-if="gated" class="gate">
      <span class="g-ico"><Icon name="alert" :size="20" /></span>
      <b class="g-t">{{ entities.length }} distinct values</b>
      <span class="g-s">A donut can show about 8 before colour stops carrying meaning. How should this render?</span>
      <div class="g-acts">
        <button class="g-b primary" @click="gateChoice = 'topn'">Top 10 + Other<em>recommended</em></button>
        <button class="g-b" @click="gateChoice = 'bar'">Ranked bar</button>
        <button class="g-b" @click="gateChoice = 'table'">Table</button>
        <button class="g-b ghost" @click="gateChoice = 'all'">Show all anyway</button>
      </div>
    </div>

    <template v-else>
      <!-- the gate's answer stays visible and reversible -->
      <div v-if="mode === 5" class="g-crumb">
        <Icon name="verified" :size="12" />
        {{ gateChoice === 'topn' ? 'Top 10 + Other' : gateChoice === 'bar' ? 'Ranked bar' : gateChoice === 'table' ? 'Table' : 'Showing all ' + entities.length }}
        <button @click="gateChoice = null">change</button>
      </div>

      <div class="chart-row">
        <DataTable v-if="asTable" class="gt" :columns="['Technician', 'Tickets', 'Share']" :rows="tableRows" />
        <VChart
          v-else ref="chartRef" class="ec" :option="option"
          :init-options="{ renderer: 'canvas' }" :update-options="{ notMerge: true }" autoresize
        />

        <!-- ③ Series manager: the legend as a control surface -->
        <aside v-if="mode === 3" class="sm-panel">
          <SeriesManager
            :entities="entities" :hidden="hidden" :total="trueTotal"
            @isolate="isolate" @toggle="toggle" @range="rangeTo" @reset="resetSeries"
            @bulk="bulk" @recolor="recolor"
          />
        </aside>
      </div>

      <!-- ② census chip — truncation is stated on the tile, not buried in the builder -->
      <div v-if="mode === 2 || (mode === 5 && gateChoice === 'topn')" class="census">
        <button class="cs-chip" @click="rankOpen = !rankOpen">
          <Icon name="filter" :size="12" /> {{ censusLabel }}
          <Icon name="chevron-down" :size="13" />
        </button>
        <span v-if="otherCount > 0" class="cs-note">
          <i :style="{ background: OTHER_COLOR }" /> Other = {{ otherCount }} more ({{ pctOf(otherValue) }}% of total)
        </span>

        <div v-if="rankOpen" class="rank-pop">
          <div class="rp-h">Which slice of the ranking?</div>
          <label v-for="m in [['top','Top N'],['bottom','Bottom N'],['range','Rank range'],['coverage','Coverage %'],['all','All']]" :key="m[0]" class="rp-r">
            <input type="radio" :value="m[0]" v-model="rankMode" /> {{ m[1] }}
            <template v-if="m[0] === 'top' && rankMode === 'top'"><input class="rp-n" type="number" min="1" :max="entities.length" v-model.number="rankN" /></template>
            <template v-if="m[0] === 'bottom' && rankMode === 'bottom'"><input class="rp-n" type="number" min="1" :max="entities.length" v-model.number="rankN" /></template>
            <template v-if="m[0] === 'range' && rankMode === 'range'">
              <input class="rp-n" type="number" min="1" v-model.number="rangeFrom" /><span class="rp-d">–</span><input class="rp-n" type="number" v-model.number="rangeTo_" />
            </template>
            <template v-if="m[0] === 'coverage' && rankMode === 'coverage'"><input class="rp-n" type="number" min="1" max="100" v-model.number="coverage" /><span class="rp-d">%</span></template>
          </label>
          <p class="rp-f">Percentages always use the full {{ trueTotal }}-record total, never the visible subset.</p>
        </div>
      </div>

      <!-- inline legend (classic ⓪, bounded ②, or truncated ④) -->
      <div v-if="showInlineLegend" class="legend">
        <span
          v-for="e in inlineEntries" :key="e.key" class="lg"
          :class="{ faded: legendHover !== null && legendHover !== e.key }"
          @mouseenter="emphasise(e.key)" @mouseleave="relax()"
        ><i :style="{ background: e.color }" />{{ e.name }}
          <b v-if="sliceBased">{{ pctOf(e.value) }}%</b>
        </span>

        <!-- ④ overflow chip: nothing is hidden without saying so -->
        <button v-if="mode === 4 && overflowCount" ref="moreBtn" class="more" :class="{ on: overflowOpen }" @click.stop="toggleOverflow">
          +{{ overflowCount }} more
        </button>
      </div>

      <teleport to="body">
        <template v-if="overflowOpen && mode === 4">
          <div class="more-back" @click="closeOverflow" @wheel.prevent />
          <div
            class="more-pop" :class="{ below: pop.below }"
            :style="{ left: pop.left + 'px', top: pop.top + 'px', width: POP_W + 'px', maxHeight: pop.maxH + 'px' }"
            @click.stop
          >
            <span class="mp-arrow" :style="{ left: pop.arrow + 'px' }" />
            <header class="mp-h">All {{ entities.length }} series<button class="mp-x" @click="closeOverflow"><Icon name="x" :size="14" /></button></header>
            <SeriesManager
              compact :entities="entities" :hidden="hidden" :total="trueTotal"
              @isolate="isolate" @toggle="toggle" @range="rangeTo" @reset="resetSeries"
              @bulk="bulk" @recolor="recolor"
            />
          </div>
        </template>
      </teleport>

      <!-- ① re-encode: the axis is the legend -->
      <div v-if="reEncoded" class="reenc-note">
        <Icon name="bulb" :size="12" /> Names sit on the axis — no legend, no colour needed. Scroll or drag to reach any rank.
      </div>
    </template>
  </div>
</template>

<style scoped>
.chart { display: flex; flex-direction: column; min-width: 0; position: relative; }
.chart-row { flex: 1; display: flex; min-height: 0; gap: 10px; }
.ec { flex: 1; min-height: 0; min-width: 0; }
.gt { align-self: flex-start; }

.legend { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 12px; padding: 6px 4px 0; flex: none; }
.lg { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted); cursor: pointer; transition: opacity .12s; }
.lg.faded { opacity: .4; }
.lg i { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.lg b { color: var(--ink-2); }
.more { border: 1px dashed var(--border-strong); background: var(--surface); color: var(--primary-700); border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 600; }
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

/* ③ series manager panel */
.sm-panel { width: 250px; flex: none; border-left: 1px solid var(--border); padding-left: 10px; display: flex; min-height: 0; }
.sm-panel > * { flex: 1; min-height: 0; }

/* ② census chip */
.census { display: flex; align-items: center; gap: 10px; padding: 7px 2px 0; flex: none; position: relative; flex-wrap: wrap; }
.cs-chip { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); border-radius: 999px; font-size: 11.5px; font-weight: 600; }
.cs-chip:hover { border-color: var(--primary); color: var(--primary-700); }
.cs-note { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); }
.cs-note i { width: 9px; height: 9px; border-radius: 3px; }
.rank-pop { position: absolute; left: 0; bottom: calc(100% + 6px); z-index: 25; width: 268px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh-pop); padding: 10px 12px; }
.rp-h { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 6px; }
.rp-r { display: flex; align-items: center; gap: 7px; padding: 4px 0; font-size: 12.5px; color: var(--ink-2); cursor: pointer; }
.rp-n { width: 52px; margin-left: auto; height: 24px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--ink); font: inherit; font-size: 12px; text-align: center; }
.rp-r .rp-n ~ .rp-n { margin-left: 0; }
.rp-d { color: var(--muted); font-size: 12px; }
.rp-f { margin: 8px 0 0; padding-top: 7px; border-top: 1px solid var(--border); font-size: 10.5px; line-height: 1.45; color: var(--muted); }

/* ⑤ gate */
.gate { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 5px; padding: 14px; }
.g-ico { color: var(--amber); }
.g-t { font-size: 14px; color: var(--ink); }
.g-s { font-size: 12px; color: var(--muted); max-width: 380px; line-height: 1.5; }
.g-acts { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 8px; }
.g-b { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); border-radius: var(--r-sm); font-size: 12px; font-weight: 500; }
.g-b:hover { background: var(--surface-2); }
.g-b.primary { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 600; }
.g-b.primary:hover { background: var(--primary-600); }
.g-b.primary em { font-style: normal; font-size: 10px; opacity: .8; font-weight: 500; }
.g-b.ghost { border-style: dashed; color: var(--muted); }
.g-crumb { display: inline-flex; align-items: center; gap: 5px; align-self: flex-start; font-size: 11px; color: var(--muted); padding-bottom: 6px; flex: none; }
.g-crumb button { border: none; background: transparent; color: var(--primary-700); font-weight: 600; font-size: 11px; text-decoration: underline; }

.reenc-note { display: flex; align-items: center; gap: 6px; padding-top: 6px; font-size: 10.5px; color: var(--muted); flex: none; }
</style>
