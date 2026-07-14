// Chart types a viewer can switch between from the widget's ⋯ menu, without
// reopening the builder. Order matches the AIOps "Graph Type" list.
//
// `slice` marks part-of-whole charts: they encode one series as slices, so a
// multi-series widget (Created vs Resolved) cannot become one.
export const CHART_TYPES = [
  { id: 'bar', label: 'Column', icon: 'chart-bar', slice: false },
  { id: 'hbar', label: 'Bar', icon: 'chart-hbar', slice: false },
  { id: 'line', label: 'Line', icon: 'chart-line', slice: false },
  { id: 'area', label: 'Area', icon: 'chart-area', slice: false },
  { id: 'pie', label: 'Pie', icon: 'chart-pie', slice: true },
  { id: 'donut', label: 'Doughnut', icon: 'chart-donut', slice: true },
  { id: 'funnel', label: 'Funnel', icon: 'chart-funnel', slice: true },
  { id: 'pyramid', label: 'Pyramid', icon: 'chart-pyramid', slice: true },
]

/* A PREDEFINED widget may only be recast among these three.
 *
 * The reason is data shape, not taste: Column, Bar and Line all plot the same
 * thing — a category axis against a value axis — so one can become another with
 * no reconfiguration. Pie is part-of-whole, a KPI is a scalar, a Shortcut is a
 * table; converting to or from those needs the fields re-derived, which is
 * exactly what a predefined widget doesn't let you do.
 *
 * So the rule is symmetric: you can only switch if you are ALREADY one of these
 * three. A predefined pie/KPI/shortcut cannot be recast at all.
 *
 * Custom widgets are unaffected — they get the full list above.
 */
export const RESTRICTED_KINDS = ['bar', 'hbar', 'line']

export function typesFor(tile) {
  if (tile?.prov !== 'predefined') return CHART_TYPES
  // a predefined pie / KPI / shortcut is frozen — nothing to offer
  if (!RESTRICTED_KINDS.includes(tile?.chart?.kind)) return []
  return CHART_TYPES.filter((t) => RESTRICTED_KINDS.includes(t.id))
}

// Why a type can't be used here — null when it can. Shown as the item's tooltip,
// rather than hiding the option and leaving the user to guess (Dynatrace greys
// out incompatible types instead of removing them).
export function whyDisabled(type, chart) {
  if (!type.slice) return null
  const n = (chart?.series || []).length
  if (n > 1) return `${type.label} shows a single series — this widget plots ${n}`
  return null
}
