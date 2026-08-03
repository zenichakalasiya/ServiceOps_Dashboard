/**
 * chartOptions.js — ECharts option builders for the PMG-ACT-01 additional chart
 * kinds. Each `opt*` takes (out, spec, t):
 *   out  — the engine output from records.js `chartData(spec)`
 *   spec — the tile's chartSpec (kind + its per-kind config)
 *   t    — theme tokens { ink, ink2, muted, border, surface, font, pal[], other }
 * and returns a plain ECharts option. ChartTile owns registration + rendering and
 * dispatches new kinds here via CHART_OPT; the legacy kinds stay in ChartTile.
 *
 * NEW_KINDS is the authority for "is this a chartData/CHART_OPT kind?" — ChartTile
 * uses it to decide whether to compute from a spec or from labels/series, and the
 * builder uses it to pick the right config sections. Grows one batch at a time.
 */
export const NEW_KINDS = new Set(['stack', 'multiline'])

// shared chrome — mirrors the cartesian idioms in ChartTile.vue so the additional
// kinds read as the same product, not a bolt-on.
const dot = (c) => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin-right:7px"></span>`
const tipBox = (t) => ({
  backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, padding: [6, 10],
  extraCssText: 'box-shadow: 0 8px 28px rgba(27,28,46,.18); border-radius: 8px;',
  textStyle: { color: t.ink2, fontSize: 12, fontFamily: t.font },
})
const axisChrome = (t) => ({
  axisLine: { show: false }, axisTick: { show: false },
  axisLabel: { color: t.muted, fontSize: 11, fontFamily: t.font },
})
const dashedSplit = (t) => ({ show: true, lineStyle: { color: t.border, type: 'dashed', opacity: 0.7 } })

const ENTER_DELAY = 260   // hold the draw until the card has faded in (matches ChartTile)

// ── Stacked / Grouped (§4.1) ─────────────────────────────────────────────────────
// One series per Split-by value. Stacked → one column per X value, square corners,
// stack:'total'. Grouped → drop the stack key, bars side by side with rounded tops.
export function optStacked(out, spec, t) {
  const grouped = spec.stackMode === 'grouped'
  const labels = out.labels || []
  const series = out.series || []
  const step = (n) => Math.min(70, Math.max(18, 500 / Math.max(1, n)))
  return {
    tooltip: {
      ...tipBox(t), trigger: 'axis', axisPointer: { type: 'shadow', lineStyle: { color: t.border } },
      formatter: (ps) => {
        const head = `<div style="color:${t.ink};font-weight:600;margin-bottom:3px">${ps[0]?.axisValueLabel ?? ''}</div>`
        const body = ps.map((p) => `<div style="white-space:nowrap">${dot(p.color)}${p.seriesName}: <b style="color:${t.ink}">${p.value}</b></div>`).join('')
        return head + body
      },
    },
    // native, interactive legend — clicking a name drops that series and rescales
    legend: {
      show: true, type: 'scroll', bottom: 0, icon: 'roundRect',
      itemWidth: 9, itemHeight: 9, itemGap: 12,
      textStyle: { color: t.muted, fontSize: 11.5, fontFamily: t.font }, inactiveColor: t.border,
    },
    grid: { left: 6, right: 14, top: 14, bottom: 30, containLabel: true },
    xAxis: { type: 'category', data: labels, ...axisChrome(t), boundaryGap: true },
    yAxis: { type: 'value', ...axisChrome(t), splitLine: dashedSplit(t) },
    series: series.map((s, si) => ({
      name: s.name, type: 'bar', data: s.values,
      ...(grouped ? {} : { stack: 'total' }),
      barMaxWidth: grouped ? 26 : 40,
      itemStyle: { color: t.pal[si % t.pal.length], borderRadius: grouped ? [3, 3, 0, 0] : [0, 0, 0, 0] },
      animation: true, animationDuration: 900, animationEasing: 'cubicOut',
      animationDelay: (i) => ENTER_DELAY + i * step(s.values.length) + si * 90,
      emphasis: { focus: 'series' }, blur: { itemStyle: { opacity: 0.18 } },
    })),
    animationDurationUpdate: 300, animationEasingUpdate: 'cubicOut', animationDelayUpdate: 0,
  }
}

// ── Multi-line (§4.2) ─────────────────────────────────────────────────────────────
// One line per Split-by value across a shared X-Axis; native interactive legend.
export function optMultiline(out, spec, t) {
  const labels = out.labels || []
  const series = out.series || []
  const color = (i) => t.pal[i % t.pal.length]
  return {
    tooltip: { ...tipBox(t), trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.border } } },
    legend: {
      show: true, type: 'scroll', bottom: 0, icon: 'roundRect',
      itemWidth: 9, itemHeight: 9, itemGap: 12,
      textStyle: { color: t.muted, fontSize: 11.5, fontFamily: t.font }, inactiveColor: t.border,
    },
    grid: { left: 6, right: 14, top: 14, bottom: 30, containLabel: true },
    // boundaryGap:false so the first point sits on the axis, not inset half a band
    xAxis: { type: 'category', data: labels, boundaryGap: false, ...axisChrome(t) },
    yAxis: { type: 'value', ...axisChrome(t), splitLine: dashedSplit(t) },
    series: series.map((s, i) => ({
      name: s.name, type: 'line', data: s.values,
      smooth: 0.35, showSymbol: true, symbolSize: 7,
      lineStyle: { width: 2.5, cap: 'round', join: 'round', color: color(i) },
      itemStyle: { color: color(i) },
      emphasis: { focus: 'series' },
      blur: { lineStyle: { opacity: 0.18 }, itemStyle: { opacity: 0.18 } },
      animation: true, animationDuration: 1500, animationEasing: 'cubicOut', animationDelay: ENTER_DELAY,
    })),
    animationDurationUpdate: 300, animationEasingUpdate: 'cubicOut', animationDelayUpdate: 0,
  }
}

// kind → option builder. ChartTile calls CHART_OPT[kind](out, spec, t). Grows per batch.
export const CHART_OPT = {
  stack: optStacked,
  multiline: optMultiline,
}
