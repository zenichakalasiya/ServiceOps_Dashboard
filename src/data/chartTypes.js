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

/* SWITCHING RULES — one place, used by both the tile's ⋯ menu and the builder.
 *
 * Only Column, Bar and Line can be swapped for one another. The reason is data
 * shape, not taste: all three plot a category axis against a value axis, so one
 * becomes another with no reconfiguration. Pie is part-of-whole, a KPI is a
 * scalar, a Shortcut is a table — converting to or from those needs the fields
 * re-derived. So you can never switch *into* one of them.
 *
 * On top of that, a PREDEFINED widget that already IS a pie / KPI / shortcut is
 * frozen: it cannot be converted at all. A custom one may still leave for one of
 * the three (it just can't come back inside the same edit — Reset restores it).
 */
export const SWITCHABLE_KINDS = ['bar', 'hbar', 'line']   // Column · Bar · Line
const isSwitchable = (k) => SWITCHABLE_KINDS.includes(k)

// A predefined pie/KPI/shortcut can't be recast at all.
export function isFrozen(tile) {
  return tile?.prov === 'predefined' && !isSwitchable(tile?.chart?.kind)
}

// What the ⋯ menu may offer. Empty = the widget is frozen.
export function typesFor(tile) {
  if (isFrozen(tile)) return []
  return CHART_TYPES.filter((t) => isSwitchable(t.id))
}

export function frozenReason(tile) {
  const label = CHART_TYPES.find((t) => t.id === tile?.chart?.kind)?.label || 'widget'
  return `A predefined ${label} can’t be converted to another type`
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
