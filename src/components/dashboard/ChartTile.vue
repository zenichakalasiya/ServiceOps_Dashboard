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
 *   4 Overflow chip  8 inline + "+N more" to reveal the rest
 *   6 Merged ② + ④   rank pill + 8 inline + "+N more"
 * Below HIGH_CARD every chart renders mode 0: a plain, complete legend.
 *
 * The two pills answer two different questions and must not overlap:
 *   rank pill  WHICH series?  → popover: rank window + the series it plots
 *   "+N more"  SHOW the rest  → expands the legend in place; where a rank pill
 *              exists, revealing everything means the filter now reads All
 * Clicking any legend entry (or any row in the popover) disables that series and
 * pulls its data out of the chart; it stays listed, struck through, to come back.
 *
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
  dataLabels: { type: Boolean, default: false },   // print values on the slices themselves
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

/* --- disabled series. One verb: toggle. A disabled entity stays in the legend,
 * struck through, and its data leaves the chart. --- */
const hidden = ref(new Set())
watch(() => props.chart, () => { hidden.value = new Set() })
// switching legend strategy starts from a clean series selection
watch(mode, () => { hidden.value = new Set() })

function toggle(key) {
  const s = new Set(hidden.value)
  s.has(key) ? s.delete(key) : s.add(key)
  hidden.value = s
}
function resetSeries() { hidden.value = new Set() }
function recolor({ key, color }) { overrides.value = { ...overrides.value, [key]: color } }

/* --- mode 2: the rank window. "Top N" is one window onto a sorted list;
 * bottom is the other. "All" drops the window entirely. --- */
const rankMode = ref('top')      // top | bottom | all
const rankN = ref(10)

const RANKS = [
  { id: 'top', label: 'Top N' },
  { id: 'bottom', label: 'Bottom N' },
  { id: 'all', label: 'All' },
]
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo))

const sortedDesc = computed(() => [...entities.value].sort((a, b) => b.value - a.value))
const windowed = computed(() => {
  const s = sortedDesc.value, n = s.length
  if (!n) return s
  if (rankMode.value === 'all') return s
  if (rankMode.value === 'bottom') return s.slice(n - clamp(rankN.value, 1, n))
  return s.slice(0, clamp(rankN.value, 1, n))
})
const otherCount = computed(() => entities.value.length - windowed.value.length)
const otherValue = computed(() => trueTotal.value - windowed.value.reduce((a, e) => a + e.value, 0))
const otherRow = computed(() => ({ key: '__other', name: `Other (${otherCount.value})`, value: otherValue.value, color: OTHER_COLOR }))
const censusLabel = computed(() => {
  const n = windowed.value.length, t = entities.value.length
  if (rankMode.value === 'all') return `All ${t}`
  if (rankMode.value === 'bottom') return `Bottom ${n} of ${t}`
  return `Top ${n} of ${t}`
})
// a new window is a new visible set — stale hidden keys would silently persist
watch([rankMode, rankN], () => { hidden.value = new Set() })

/* Modes that bound the series set to a rank window (Top/Bottom/Range/Coverage). */
const rankModes = computed(() => mode.value === 2 || mode.value === 6)

/* Everything the legend names — hidden entries included, so a disabled series
 * stays on screen (struck through) and can be switched back on. This is also
 * exactly what the series panel lists: one set, one source of truth. */
const manageable = computed(() => {
  if (!rankModes.value) return entities.value
  const rows = [...windowed.value]
  if (otherCount.value > 0) rows.push(otherRow.value)
  return rows
})

/* Disabling a series removes it from the chart in every mode. */
const plotted = computed(() => manageable.value.filter((e) => !hidden.value.has(e.key)))

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

/* Hold the chart back until its card has faded in (the board staggers cards in over
 * ~0.2s). Draw it sooner and the animation plays out behind an opacity-0 card. */
const ENTER_DELAY = 260
/* Everything AFTER the entrance — hiding a series, moving the rank window, switching
 * type — updates quickly and must NOT replay the entrance. ECharts only honours these
 * if the option is MERGED; `notMerge: true` makes every setOption look like a first
 * render, which would re-run the full 1.5s draw on every legend click. */
const UPDATE_ANIM = { animationDurationUpdate: 300, animationEasingUpdate: 'cubicOut', animationDelayUpdate: 0 }

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
  /* ---- Entrance animation ------------------------------------------------------
   * Each type draws itself in the way its own geometry implies, slowly enough to
   * actually be seen:
   *
   *   column   bars grow bottom → top, stepping left → right
   *   bar      bars grow left → right, stepping top → bottom
   *   line     the path draws itself left → right (ECharts clips it from the left)
   *   pie      the ring sweeps round from twelve o'clock
   *   funnel   the bands widen out, stepping down
   *
   * ENTER_DELAY holds the chart back until its card has faded in. Without it the
   * chart finished drawing while the card was still at opacity 0 — which is exactly
   * why the charts appeared to pop in fully formed with no animation at all.
   *
   * The stagger tightens as the series grows, so a 63-slice donut doesn't take ten
   * seconds to arrive. */
  const anim = (count) => {
    if (reduceMotion) return { animation: false }
    const step = Math.min(70, Math.max(18, 500 / Math.max(1, count)))
    if (k === 'line' || k === 'area') {
      return { animation: true, animationDuration: 1500, animationEasing: 'cubicOut', animationDelay: ENTER_DELAY }
    }
    if (k === 'pie' || k === 'donut') {
      return { animation: true, animationType: 'expansion', animationDuration: 1400, animationEasing: 'cubicOut', animationDelay: ENTER_DELAY }
    }
    // bar | hbar | funnel — all grow from their baseline, so the delay is what
    // turns them into a sweep rather than a simultaneous pop
    return { animation: true, animationDuration: 900, animationEasing: 'cubicOut', animationDelay: (i) => ENTER_DELAY + i * step }
  }

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
        center: ['50%', '50%'],   // the legend is its own flex column, so the plot area is already narrowed
        // data labels sit *inside* the slice: leader lines outside would fight the
        // side legend for the same strip of space
        label: props.dataLabels
          ? { show: true, position: 'inside', formatter: '{c}', fontSize: 10, fontFamily: t.font, color: '#fff', fontWeight: 600 }
          : { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: t.surface, borderWidth: 2 },
        emphasis: { focus: 'self', scale: true, scaleSize: 4 },
        blur: { itemStyle: { opacity: 0.18 } },
        data: sliceData,
        ...anim(sliceData.length),
      }],
      ...UPDATE_ANIM,
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
        ...anim(sliceData.length),
      }],
      ...UPDATE_ANIM,
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
    series: shown.map((s, si) => ({
      name: s.name, type: isLine ? 'line' : 'bar', data: s.values,
      barMaxWidth: 26,
      itemStyle: { borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0], color: baseColor(s.name, series.value.indexOf(s)) },
      lineStyle: isLine ? { width: 2.5, cap: 'round', join: 'round' } : undefined,
      // the fill is what separates Area from Line
      areaStyle: isArea ? { opacity: 0.18 } : undefined,
      smooth: isLine ? 0.35 : undefined,
      symbolSize: isLine ? 7 : undefined,
      // a grouped bar's second series starts a beat after the first, so the pair
      // sweeps across rather than landing together
      ...(() => {
        const a = anim(s.values.length)
        if (!a.animation || typeof a.animationDelay !== 'function') return a
        const base = a.animationDelay
        return { ...a, animationDelay: (i) => base(i) + si * 90 }
      })(),
      emphasis: { focus: 'series' },
      blur: { itemStyle: { opacity: 0.18 }, lineStyle: { opacity: 0.18 }, areaStyle: { opacity: 0.04 } },
    })),
    ...UPDATE_ANIM,
  }
})

/* --- legend rendering decisions --- */
const INLINE_CAP = 8
const chipModes = computed(() => mode.value === 4 || mode.value === 6)
const showInlineLegend = computed(() => props.legend)

/* The "+N more" chip expands the legend in place rather than opening a second
 * panel. Two popovers answering the same question ("which series?") was the
 * confusion; now the rank pill owns the filter and the chip owns the reveal. */
const expanded = ref(false)
watch([mode, () => props.chart], () => { expanded.value = false })
// leaving All re-truncates the legend — the rank pill is the way back
watch(rankMode, (m) => { if (m !== 'all') expanded.value = false })

const truncating = computed(() => chipModes.value && !expanded.value)
const inlineEntries = computed(() =>
  truncating.value ? manageable.value.slice(0, INLINE_CAP) : manageable.value)
/* Count against the manageable set, not the plotted one: disabling series shrinks
 * `plotted`, and measured that way the chip would delete itself and strand the
 * user with no route back to the rest. */
const overflowCount = computed(() =>
  truncating.value ? Math.max(0, manageable.value.length - inlineEntries.value.length) : 0)
// clicking a legend entry disables it and pulls its data out of the chart
const legendClickable = computed(() => rankModes.value || chipModes.value)

/* ---- Side legend (part-of-whole charts) -------------------------------------
 * A pie/donut names slices, and slice names are long. Laid out centre-bottom they
 * wrap into a paragraph and eat the chart's height. Stacked to the RIGHT they read
 * as a list, one per line — but then only as many fit as the chart is tall, so the
 * rest paginate. Grow the widget and more fit per page; the page count falls out.
 *
 * Cartesian charts keep the bottom legend: they name *series*, of which there are
 * usually two or three, and a side column would steal width from the plot. */
const sideLegend = computed(() => sliceBased.value && props.legend)

const ROW_H = 22          // one legend row, incl. gap — keep in step with .lg-side
const legendCol = ref(null)
const colH = ref(0)
const page = ref(0)

let ro = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(([e]) => { colH.value = e.contentRect.height })
  watch(legendCol, (el) => { ro.disconnect(); if (el) ro.observe(el) }, { immediate: true, flush: 'post' })
})
onBeforeUnmount(() => ro?.disconnect())

const sideEntries = computed(() => manageable.value)
/* How many rows fit. The rank pill and pager both live in the footer, which is a
 * sibling of the measured list — so colH already excludes them and the count is a
 * straight divide, no reserving. */
const perPage = computed(() => {
  const h = colH.value
  if (!h) return sideEntries.value.length || 1
  return Math.max(1, Math.floor(h / ROW_H))
})
const pageCount = computed(() => Math.max(1, Math.ceil(sideEntries.value.length / perPage.value)))
const paged = computed(() => {
  const start = page.value * perPage.value
  return sideEntries.value.slice(start, start + perPage.value)
})
// resizing the tile changes how many fit — never strand the user past the last page
watch([pageCount], () => { if (page.value > pageCount.value - 1) page.value = pageCount.value - 1 })
watch([() => props.chart, mode, rankMode], () => { page.value = 0 })

/* Reveal every legend. Where there is a rank pill it *is* the filter, so showing
 * all the legends means the filter now reads All — the pill must not keep
 * claiming "Top 11 of 63" while all 63 sit beneath it. */
function expandAll() {
  if (rankModes.value) rankMode.value = 'all'   // resets `hidden`, then:
  expanded.value = true
}

/* One panel, one trigger: the rank pill. The rank window and the series list are
 * the same question — "which series are on this chart?" — so they live together:
 * tabs and field on top, the resulting series underneath. The panel is sized so
 * the series list, not the chrome, is what the space goes to.
 *
 * It has to be teleported: anchored inside .chart it gets clipped by the card's
 * overflow:hidden and follows the chart box instead of the pill. */
const panelOpen = ref(false)
const panelAnchor = ref(null)
const rankBtn = ref(null)
const POP_W = 380
const POP_H = 560
const BLANK = { left: '0px', top: 'auto', bottom: '0px', maxH: POP_H + 'px', arrow: '0px', below: false }
const pop = ref({ ...BLANK })

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
function reflow() { if (!panelOpen.value) return; const p = anchor(panelAnchor.value, POP_W, POP_H); if (p) pop.value = p }

function togglePanel(el) {
  if (panelOpen.value && panelAnchor.value === el) { panelOpen.value = false; return }
  panelAnchor.value = el
  panelOpen.value = true
  nextTick(reflow)
}
function closePops() { panelOpen.value = false }
function onDocKey(e) { if (e.key === 'Escape') closePops() }

watch(panelOpen, (open) => {
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

/* NO resize() on mount. It used to fire on the next frame to nudge the chart into
 * its box — but a resize re-lays-out the series and SNAPS a running entrance
 * animation to its end state. That is why the bars and the pie appeared fully
 * formed while only the line (whose clip animation survives a relayout) looked
 * animated. `autoresize` on <VChart> already handles the container. */
</script>

<template>
  <div class="chart" :style="{ height: height + 'px' }">
      <div class="chart-row">
        <VChart
          ref="chartRef" class="ec" :option="option"
          :init-options="{ renderer: 'canvas' }" :update-options="{ replaceMerge: ['series'] }" autoresize
        />

        <!-- Part-of-whole charts: legend to the RIGHT, one slice per line, paged to
             whatever the widget's height can hold. Taller widget → more per page. -->
        <aside v-if="sideLegend" class="legend-side">
          <div ref="legendCol" class="ls-list">
            <span
              v-for="e in paged" :key="e.key" class="lg lg-side"
              :class="{ faded: legendHover !== null && legendHover !== e.key, off: hidden.has(e.key), click: legendClickable }"
              :title="legendClickable ? (hidden.has(e.key) ? `Show ${e.name} on the chart` : `Hide ${e.name} from the chart`) : e.name"
              @mouseenter="emphasise(e.key)" @mouseleave="relax()"
              @click="legendClickable && toggle(e.key)"
            >
              <i :style="{ background: e.color }" />
              <span class="ls-nm">{{ e.name }}</span>
              <b>{{ pctOf(e.value) }}%</b>
            </span>
          </div>

          <!-- The rank pill and the pager share one footer row, pinned to the bottom.
               Keeping the pill out of the top gives the list an extra row, and pairing
               it with the pager means the chrome costs one line, not two. -->
          <footer v-if="rankModes || pageCount > 1" class="ls-foot">
            <button
              v-if="rankModes" ref="rankBtn" class="cs-chip side" :class="{ on: panelOpen }"
              title="Choose which slice of the ranking to plot" @click.stop="togglePanel(rankBtn)"
            >
              <span class="cs-lbl">{{ censusLabel }}</span>
              <Icon name="chevron-down" :size="13" />
            </button>

            <div v-if="pageCount > 1" class="ls-pager">
              <button :disabled="page === 0" title="Previous" @click="page--"><Icon name="chevron-left" :size="14" /></button>
              <span>{{ page + 1 }} / {{ pageCount }}</span>
              <button :disabled="page >= pageCount - 1" title="Next" @click="page++"><Icon name="chevron-right" :size="14" /></button>
            </div>
          </footer>
        </aside>
      </div>

      <!-- ② only: the "Other" residue spelled out beneath the chart -->
      <div v-if="mode === 2 && !sideLegend" class="census">
        <span v-if="otherCount > 0" class="cs-note">
          <i :style="{ background: OTHER_COLOR }" /> Other = {{ otherCount }} more ({{ pctOf(otherValue) }}% of total)
        </span>
      </div>

      <!-- bottom legend — cartesian charts only (classic ⓪, bounded ②, truncated ④, merged ⑥) -->
      <div v-if="showInlineLegend && !sideLegend" class="legend">
        <!-- the rank pill states the truncation and opens the one panel that can
             change it. It sits outside the scroll box so it never scrolls away. -->
        <button
          v-if="rankModes" ref="rankBtn" class="cs-chip" :class="{ on: panelOpen }"
          title="Choose which slice of the ranking to plot" @click.stop="togglePanel(rankBtn)"
        >
          <Icon name="filter" :size="12" /> {{ censusLabel }}
          <Icon name="chevron-down" :size="13" />
        </button>

        <div class="lg-wrap" :class="{ scroller: expanded }">
          <span
            v-for="e in inlineEntries" :key="e.key" class="lg"
            :class="{ faded: legendHover !== null && legendHover !== e.key, off: hidden.has(e.key), click: legendClickable }"
            :title="legendClickable ? (hidden.has(e.key) ? `Show ${e.name} on the chart` : `Hide ${e.name} from the chart`) : e.name"
            @mouseenter="emphasise(e.key)" @mouseleave="relax()"
            @click="legendClickable && toggle(e.key)"
          ><i :style="{ background: e.color }" />{{ e.name }}
            <b v-if="sliceBased">{{ pctOf(e.value) }}%</b>
          </span>

          <!-- nothing is hidden without saying so. Clicking reveals the rest —
               and, where there is a rank pill, moves the filter to All. -->
          <button
            v-if="overflowCount" class="more"
            :title="rankModes
              ? `Show all ${entities.length} series — switches the filter to All`
              : `Show all ${entities.length} series`"
            @click.stop="expandAll()"
          >
            +{{ overflowCount }} more
          </button>
        </div>
      </div>

      <teleport to="body">
        <div v-if="panelOpen" class="more-back" @click="closePops" @wheel.prevent />

        <!-- One panel: pick the slice of the ranking, then see exactly the
             series that slice puts on the chart. Floats over the tile. -->
        <div
          v-if="panelOpen" class="more-pop" :class="{ below: pop.below }"
          :style="{ left: pop.left, top: pop.top, bottom: pop.bottom, width: POP_W + 'px', maxHeight: pop.maxH }"
          @click.stop
        >
          <span class="mp-arrow" :style="{ left: pop.arrow }" />
          <header class="mp-h">
            {{ rankModes ? 'Which slice of the ranking?' : `All ${entities.length} series` }}
            <button class="mp-x" @click="closePops"><Icon name="x" :size="14" /></button>
          </header>

          <template v-if="rankModes">
            <div class="rp-tabs">
              <button v-for="r in RANKS" :key="r.id" class="rp-t" :class="{ on: rankMode === r.id }" @click="rankMode = r.id">{{ r.label }}</button>
            </div>

            <div class="rp-field">
              <template v-if="rankMode === 'top' || rankMode === 'bottom'">
                <label>Show the</label>
                <input class="rp-n" type="number" min="1" :max="entities.length" v-model.number="rankN" />
                <span>{{ rankMode === 'top' ? 'largest' : 'smallest' }} of {{ entities.length }}</span>
              </template>
              <template v-else>
                <span class="rp-warn"><Icon name="alert" :size="13" /> Colour stops carrying meaning past about 10.</span>
              </template>
            </div>
          </template>

          <!-- the series that slice actually plots — click one to drop it from the chart.
               Search is offered only on the All tab: on Top/Bottom/Range/Coverage the
               rank window has already narrowed the list, so searching it would hunt
               through a set the filter chose rather than the data. -->
          <SeriesManager
            compact :entities="manageable" :hidden="hidden" :total="trueTotal"
            :searchable="rankMode === 'all'"
            @toggle="toggle" @reset="resetSeries" @recolor="recolor"
          />
        </div>
      </teleport>
  </div>
</template>

<style scoped>
.chart { display: flex; flex-direction: column; min-width: 0; position: relative; }
.chart-row { flex: 1; display: flex; min-height: 0; gap: 10px; }
.ec { flex: 1; min-height: 0; min-width: 0; }

/* Side legend — part-of-whole charts. The list is the only part that flexes, so
   the pager stays pinned at the bottom and the rank pill at the top. */
.legend-side { flex: none; width: 168px; display: flex; flex-direction: column; gap: 6px; min-height: 0; padding: 2px 0; }
.ls-list { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.lg-side { width: 100%; height: 18px; justify-content: flex-start; }   /* 18 + 4 gap = ROW_H */
/* The name takes only the width it needs (flex: 0 1 auto), so the value sits right
   beside it. It used to be flex: 1, which ate every spare pixel and shoved the value
   to the far edge — a chasm of dead space next to a label as short as "P1". A long
   name still shrinks and ellipses, which is what the min-width: 0 is for. */
.ls-nm { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lg-side b { flex: none; margin-left: 2px; font-variant-numeric: tabular-nums; }
/* Footer: pill on the left, pager on the right, on one line. It wraps only if the
   two genuinely can't share the width — then it degrades to the old stacked look. */
.ls-foot { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ls-pager { flex: none; margin-left: auto; display: flex; align-items: center; justify-content: center; gap: 2px; height: 22px; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.ls-pager button { width: 18px; height: 18px; border: none; background: transparent; color: var(--muted); border-radius: 5px; display: grid; place-items: center; }
.ls-pager button:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
.ls-pager button:disabled { opacity: .3; cursor: not-allowed; }
/* The pill takes the row's spare width and its label ellipses rather than pushing
   the pager off the line. */
.cs-chip.side { flex: 1 1 auto; min-width: 0; justify-content: center; padding: 0 7px; gap: 3px; }
.cs-lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

/* The pill is the row's anchor: it must sit at the far left and stay there. So the
   row itself never wraps — only the chips inside .lg-wrap do. (With flex-wrap on
   .legend the chip block was wide enough to take its own line, which left the pill
   stranded and centred above it.) */
.legend { display: flex; flex-wrap: nowrap; align-items: flex-start; gap: 10px; padding: 6px 4px 0; flex: none; }
.lg-wrap { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 12px; }
/* revealing all 63 legends must not shove the chart out of the tile */
.lg-wrap.scroller { max-height: 74px; overflow-y: auto; padding: 1px 2px; }
.lg { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted); cursor: pointer; transition: opacity .12s; user-select: none; }
.lg.faded { opacity: .4; }
.lg i { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.lg b { color: var(--ink-2); }
/* a disabled series stays in the legend, struck through, so it can come back */
.lg.off { opacity: .42; }
.lg.off i { background: var(--muted-2) !important; }
.lg.off, .lg.off b { text-decoration: line-through; }
.lg.click:hover { color: var(--ink); }
.more { display: inline-flex; align-items: center; gap: 4px; border: 1px dashed var(--border-strong); background: var(--surface); color: var(--primary-700); border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 600; flex: none; }
.more:hover { background: var(--primary-soft); border-style: solid; border-color: var(--primary); }

/* ④ overflow popover — teleported to <body>, so it floats over the whole card
   instead of being clipped by it. Positioned in viewport coords from the chip. */
.more-back { position: fixed; inset: 0; z-index: 299; }
.more-pop { position: fixed; z-index: 300; display: flex; flex-direction: column; gap: 7px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh-pop); }
/* only the series list grows and scrolls; tabs, field and footnote stay put */
.more-pop > * { flex: none; }
.more-pop > .sm { flex: 1; min-height: 0; }
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
.rp-tabs { display: flex; gap: 2px; padding: 2px; background: var(--surface-2); border-radius: 7px; }
.rp-t { flex: 1; height: 26px; border: none; background: transparent; color: var(--muted); border-radius: 5px; font-size: 11px; font-weight: 600; white-space: nowrap; padding: 0 4px; }
.rp-t:hover { color: var(--ink); }
.rp-t.on { background: var(--surface); color: var(--primary-700); box-shadow: var(--sh-sm); }
.rp-field { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-height: 30px; padding-bottom: 7px; border-bottom: 1px solid var(--border); font-size: 12px; color: var(--muted); }
.rp-field label { font-size: 12px; color: var(--ink-2); font-weight: 500; }
.rp-n { width: 56px; height: 26px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--ink); font: inherit; font-size: 12px; font-weight: 600; text-align: center; }
.rp-n:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.rp-d { color: var(--muted); font-size: 12px; }
.rp-warn { display: inline-flex; align-items: center; gap: 6px; color: var(--amber); font-size: 11.5px; line-height: 1.4; }

</style>
