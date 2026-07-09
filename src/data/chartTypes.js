// Chart types a viewer can switch between from the widget's ⋯ menu, without
// reopening the builder. Order matches the AIOps "Graph Type" list.
//
// `slice` marks part-of-whole charts: they encode one series as slices, so a
// multi-series widget (Created vs Resolved) cannot become one.
export const CHART_TYPES = [
  { id: 'bar', label: 'Bar', icon: 'chart-bar', slice: false },
  { id: 'pie', label: 'Pie', icon: 'chart-pie', slice: true },
  { id: 'line', label: 'Line', icon: 'chart-line', slice: false },
  { id: 'area', label: 'Area', icon: 'chart-area', slice: false },
  { id: 'donut', label: 'Doughnut', icon: 'chart-donut', slice: true },
  { id: 'funnel', label: 'Funnel', icon: 'chart-funnel', slice: true },
  { id: 'pyramid', label: 'Pyramid', icon: 'chart-pyramid', slice: true },
  { id: 'hbar', label: 'Horizontal Bar', icon: 'chart-hbar', slice: false },
]

// Why a type can't be used here — null when it can. Shown as the item's tooltip,
// rather than hiding the option and leaving the user to guess (Dynatrace greys
// out incompatible types instead of removing them).
export function whyDisabled(type, chart) {
  if (!type.slice) return null
  const n = (chart?.series || []).length
  if (n > 1) return `${type.label} shows a single series — this widget plots ${n}`
  return null
}
