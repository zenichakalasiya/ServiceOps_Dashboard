/**
 * records.js — the deterministic 48-record demo dataset + the chart engine for the
 * PMG-ACT-01 additional chart types (per "New Chart Types — Builder Configuration
 * Reference"). Every new-kind preview computes from these records so the numbers are
 * real, not placeholders.
 *
 * The dataset reproduces the spec's categorical structure exactly — Priority×Status,
 * Team×Priority, Site counts, and the Status funnel — and the Resolution-time
 * histogram (bucket 4). Per-field averages (combo line, heatmap/map aggregates) are
 * computed by the engine and may differ from the reference's own dataset.
 */

// ── categorical + numeric field vocabularies (order IS the axis order) ──────────
export const CONDITION_FIELD_LABELS = ['Status', 'Priority', 'Team', 'Reopened', 'Escalated', 'Site']
export const NUMERIC_FIELD_LABELS = ['CSAT score', 'Effort hours', 'Resolution time']
export const AGG_FNS = ['Average', 'Sum', 'Min', 'Max']
export const MAP_FNS = ['Count', 'Average', 'Sum', 'Min', 'Max']

const FIELD_KEY = { Status: 'status', Priority: 'priority', Team: 'team', Reopened: 'reopened', Escalated: 'escalated', Site: 'site' }
const NUM_KEY = { 'CSAT score': 'csat', 'Effort hours': 'effort', 'Resolution time': 'resolution' }
const BOOL_FIELDS = new Set(['Reopened', 'Escalated'])
const FIELD_VALUES = {
  Status: ['Open', 'In Progress', 'Resolved', 'Closed'],
  Priority: ['Low', 'Medium', 'High', 'Urgent'],
  Team: ['Service Desk', 'Network Team', 'Apps Team'],
  Reopened: ['Yes', 'No'],
  Escalated: ['Yes', 'No'],
  Site: ['Mumbai', 'Pune', 'Bengaluru', 'Delhi NCR', 'Chennai', 'Hyderabad', 'Ahmedabad'],
}
export const valuesFor = (fieldLabel) => FIELD_VALUES[fieldLabel] || []
export const fieldUnit = (fieldLabel) => (fieldLabel === 'CSAT score' ? '/5' : 'h')

// coordinates for the seven demo cities ([lng, lat]) — the geographic dimension is
// fixed to Site (§4.6). The country outline itself lives in indiaMap.js (Batch 5).
export const SITE_COORDS = {
  Mumbai: [72.87, 19.07], Pune: [73.85, 18.52], Bengaluru: [77.59, 12.97],
  'Delhi NCR': [77.10, 28.70], Chennai: [80.27, 13.08], Hyderabad: [78.47, 17.38], Ahmedabad: [72.57, 23.02],
}

// r(priority, status, team, site, reopened, escalated, csat, effort, resolution)
const r = (priority, status, team, site, reopened, escalated, csat, effort, resolution) =>
  ({ priority, status, team, site, reopened, escalated, csat, effort, resolution })

export const REQUEST_RECORDS = [
  // ── Low (11): Open3 IP1 Res2 Closed5 · Team SD6 NT2 Apps3 ──
  r('Low', 'Open', 'Service Desk', 'Mumbai', false, false, null, 4, null),
  r('Low', 'Open', 'Service Desk', 'Mumbai', false, false, null, 6, null),
  r('Low', 'Open', 'Network Team', 'Mumbai', false, false, null, 3, null),
  r('Low', 'In Progress', 'Service Desk', 'Mumbai', false, false, null, 5, null),
  r('Low', 'Resolved', 'Service Desk', 'Mumbai', false, false, 4, 3, 2.5),
  r('Low', 'Resolved', 'Apps Team', 'Mumbai', false, false, 5, 2, 3.5),
  r('Low', 'Closed', 'Service Desk', 'Mumbai', false, false, 4, 5, 4.5),
  r('Low', 'Closed', 'Service Desk', 'Mumbai', true, false, 3, 6, 5),
  r('Low', 'Closed', 'Network Team', 'Mumbai', false, false, 5, 4, 5.5),
  r('Low', 'Closed', 'Apps Team', 'Mumbai', false, false, 4, 7, 6),
  r('Low', 'Closed', 'Apps Team', 'Mumbai', false, false, 5, 3, 6),
  // ── Medium (17): Open3 IP3 Res3 Closed8 · Team SD7 NT5 Apps5 ──
  r('Medium', 'Open', 'Service Desk', 'Mumbai', false, false, null, 8, null),
  r('Medium', 'Open', 'Network Team', 'Pune', false, false, null, 5, null),
  r('Medium', 'Open', 'Apps Team', 'Pune', false, false, null, 6, null),
  r('Medium', 'In Progress', 'Service Desk', 'Pune', false, true, null, 9, null),
  r('Medium', 'In Progress', 'Network Team', 'Pune', false, false, null, 4, null),
  r('Medium', 'In Progress', 'Apps Team', 'Pune', false, false, null, 7, null),
  r('Medium', 'Resolved', 'Service Desk', 'Pune', false, false, 4, 6, 6.5),
  r('Medium', 'Resolved', 'Network Team', 'Pune', false, false, 3, 8, 7),
  r('Medium', 'Resolved', 'Apps Team', 'Pune', false, false, 5, 5, 7),
  r('Medium', 'Closed', 'Service Desk', 'Pune', false, false, 4, 7, 7.5),
  r('Medium', 'Closed', 'Service Desk', 'Pune', true, false, 4, 6, 7.5),
  r('Medium', 'Closed', 'Service Desk', 'Pune', false, false, 5, 9, 7.8),
  r('Medium', 'Closed', 'Service Desk', 'Pune', false, false, 3, 5, 8.5),
  r('Medium', 'Closed', 'Network Team', 'Bengaluru', false, false, 4, 8, 9),
  r('Medium', 'Closed', 'Network Team', 'Bengaluru', false, true, 5, 4, 9.5),
  r('Medium', 'Closed', 'Apps Team', 'Bengaluru', false, false, 4, 7, 10),
  r('Medium', 'Closed', 'Apps Team', 'Bengaluru', false, false, 5, 6, 10),
  // ── High (14): Open3 IP3 Res2 Closed6 · Team SD8 NT2 Apps4 ──
  r('High', 'Open', 'Service Desk', 'Bengaluru', false, true, null, 10, null),
  r('High', 'Open', 'Service Desk', 'Bengaluru', false, false, null, 5, null),
  r('High', 'Open', 'Apps Team', 'Bengaluru', false, false, null, 8, null),
  r('High', 'In Progress', 'Service Desk', 'Bengaluru', false, true, null, 9, null),
  r('High', 'In Progress', 'Service Desk', 'Delhi NCR', false, false, null, 6, null),
  r('High', 'In Progress', 'Apps Team', 'Delhi NCR', false, false, null, 7, null),
  r('High', 'Resolved', 'Service Desk', 'Delhi NCR', false, false, 4, 8, 10.5),
  r('High', 'Resolved', 'Network Team', 'Delhi NCR', false, true, 3, 11, 11),
  r('High', 'Closed', 'Service Desk', 'Chennai', false, false, 4, 7, 11.5),
  r('High', 'Closed', 'Service Desk', 'Chennai', true, false, 3, 9, 12.5),
  r('High', 'Closed', 'Network Team', 'Chennai', false, false, 4, 8, 13.5),
  r('High', 'Closed', 'Apps Team', 'Chennai', false, true, 5, 6, 14.5),
  r('High', 'Closed', 'Apps Team', 'Hyderabad', false, false, 3, 10, 16.5),
  r('High', 'Closed', 'Service Desk', 'Hyderabad', false, true, 4, 12, 18),
  // ── Urgent (6): Open1 IP1 Res1 Closed3 · Team SD4 NT2 Apps0 ──
  r('Urgent', 'Open', 'Service Desk', 'Hyderabad', false, true, null, 6, null),
  r('Urgent', 'In Progress', 'Network Team', 'Hyderabad', false, true, null, 8, null),
  r('Urgent', 'Resolved', 'Service Desk', 'Ahmedabad', false, true, 3, 9, 21),
  r('Urgent', 'Closed', 'Service Desk', 'Ahmedabad', true, true, 3, 10, 23),
  r('Urgent', 'Closed', 'Service Desk', 'Ahmedabad', false, true, 4, 11, 25),
  r('Urgent', 'Closed', 'Network Team', 'Ahmedabad', false, true, 2, 14, 30),
].map((rec, i) => ({ id: i + 1, ...rec }))

// ── helpers ─────────────────────────────────────────────────────────────────────
function catVal(rec, fieldLabel) {
  if (BOOL_FIELDS.has(fieldLabel)) return rec[FIELD_KEY[fieldLabel]] ? 'Yes' : 'No'
  return rec[FIELD_KEY[fieldLabel]]
}
export function applyConds(recs, conds) {
  if (!conds || !conds.length) return recs
  return recs.filter((rec) => conds.every((c) => c.field && catVal(rec, c.field) === c.value))
}
const numVals = (recs, fieldLabel) => recs.map((rec) => rec[NUM_KEY[fieldLabel]]).filter((x) => x != null)
function aggregate(fn, vals) {
  const v = vals.filter((x) => x != null)
  if (!v.length) return null
  if (fn === 'Sum') return v.reduce((a, b) => a + b, 0)
  if (fn === 'Min') return Math.min(...v)
  if (fn === 'Max') return Math.max(...v)
  return v.reduce((a, b) => a + b, 0) / v.length   // Average
}
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10)
const trim = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100))
export function niceCeil(x) {
  if (x <= 10) return 10
  const mag = Math.pow(10, Math.floor(Math.log10(x)))
  return Math.ceil(x / mag) * mag
}

// ── engine — one function per PMG-ACT-01 kind (§4) ────────────────────────────────
// Stacked / Grouped / Multi-line — one series per Split-by value, each point the count
// of records at (X-Axis = label, Split by = series). §4.1 / §4.2.
export function chartTwoDim(xAxis, splitDim, conds) {
  const recs = applyConds(REQUEST_RECORDS, conds)
  const labels = valuesFor(xAxis), splits = valuesFor(splitDim)
  const series = splits.map((sv) => ({
    name: sv,
    values: labels.map((xv) => recs.filter((rec) => catVal(rec, xAxis) === xv && catVal(rec, splitDim) === sv).length),
  }))
  return { labels, series }
}

// Combo — count bars (primary axis) + an aggregate line (secondary axis). §4.3.
export function chartCombo(xAxis, comboFn, comboField, conds) {
  const recs = applyConds(REQUEST_RECORDS, conds)
  const labels = valuesFor(xAxis)
  const bars = labels.map((xv) => recs.filter((rec) => catVal(rec, xAxis) === xv).length)
  const line = labels.map((xv) => {
    const vals = numVals(recs.filter((rec) => catVal(rec, xAxis) === xv), comboField)
    return vals.length ? round1(aggregate(comboFn, vals)) : null   // no value → genuine gap
  })
  return { labels, series: [
    { name: 'Requests', role: 'bar', values: bars },
    { name: `${comboFn} ${comboField}`, role: 'line', values: line },
  ] }
}

// Histogram — gap-free equal-width bands over a numeric field; nulls excluded. §4.4.
export function chartHistogram(field, bucketSize, conds) {
  const recs = applyConds(REQUEST_RECORDS, conds)
  const size = Number(bucketSize) > 0 ? Math.max(0.5, Number(bucketSize)) : 4
  const vals = numVals(recs, field)
  if (!vals.length) return { labels: [], series: [{ name: 'Records', values: [] }] }
  const max = Math.max(...vals)
  const n = Math.ceil((max + 1e-9) / size)
  const unit = fieldUnit(field)
  const labels = [], counts = []
  for (let i = 0; i < n; i++) {
    const lo = i * size, hi = (i + 1) * size
    labels.push(`${trim(lo)}–${trim(hi)}${unit}`)
    counts.push(vals.filter((v) => v >= lo && v < hi).length)   // half-open [lo, hi)
  }
  return { labels, series: [{ name: 'Records', values: counts }] }
}

// Heatmap — Columns × Rows grid; cell = count or an aggregate over a field. §4.5.
export function chartHeatmap(colDim, rowDim, conds, heatFn, heatField) {
  const recs = applyConds(REQUEST_RECORDS, conds)
  const cols = valuesFor(colDim), rows = valuesFor(rowDim)
  const isCount = !heatFn || heatFn === 'Count'
  const data = []; let max = 0
  rows.forEach((rv, yi) => cols.forEach((cv, xi) => {
    const cell = recs.filter((rec) => catVal(rec, colDim) === cv && catVal(rec, rowDim) === rv)
    let value = isCount ? cell.length : (numVals(cell, heatField).length ? round1(aggregate(heatFn, numVals(cell, heatField))) : 0)
    max = Math.max(max, value)
    data.push([xi, yi, value])   // a cell with no records reads 0, never a gap
  }))
  return { cols, rows, data, max, unit: isCount ? '' : fieldUnit(heatField), isCount }
}

// Map Bubble — one bubble per Site with coordinates + ≥1 matching record. §4.6.
export function chartMapBubble(mapFn, mapField, conds) {
  const recs = applyConds(REQUEST_RECORDS, conds)
  const isCount = !mapFn || mapFn === 'Count'
  const points = []; let max = 0
  valuesFor('Site').forEach((site) => {
    const coord = SITE_COORDS[site]; if (!coord) return
    const cell = recs.filter((rec) => rec.site === site)
    let value
    if (isCount) { if (!cell.length) return; value = cell.length }
    else { const vals = numVals(cell, mapField); if (!vals.length) return; value = round1(aggregate(mapFn, vals)) }
    max = Math.max(max, value)
    points.push({ name: site, coord, value })   // no matching records → no bubble at all
  })
  return { points, max, unit: isCount ? '' : fieldUnit(mapField), caption: isCount ? 'Requests' : `${mapFn} ${mapField}`, isCount }
}

// Funnel — cumulative stage counts in the field's defined order; share of the FIRST. §4.7.
export function chartFunnel(stageField, conds) {
  const recs = applyConds(REQUEST_RECORDS, conds)
  const stages = valuesFor(stageField)
  const idxOf = (rec) => stages.indexOf(catVal(rec, stageField))
  const values = stages.map((_, i) => recs.filter((rec) => idxOf(rec) >= i).length)   // reached stage i or beyond
  const first = values[0] || 1
  return { labels: stages, values, shares: values.map((c) => round1((c / first) * 100)) }
}

// Measurement — the Gauge/KPI value. Count / Aggregate / Percentage. §4.8.
export function measurement(m) {
  const base = applyConds(REQUEST_RECORDS, m?.conds)
  if (m?.mode === 'aggregate') {
    const vals = numVals(base, m.field)
    return { value: vals.length ? round1(aggregate(m.fn, vals)) : null, unit: fieldUnit(m.field), excluded: base.length - vals.length, of: vals.length }
  }
  if (m?.mode === 'percentage') {
    if (!base.length) return { value: null, empty: true, unit: '%' }
    const num = applyConds(base, m.numConds).length
    return { value: round1((num / base.length) * 100), unit: '%', num, den: base.length }
  }
  return { value: base.length, unit: '', of: REQUEST_RECORDS.length }   // count
}

// Gauge bands — thresholds → coloured arcs, clamped to Max, order flips with direction. §4.8.
const BAND_COLORS = { green: '#1f9d63', amber: '#d98a0b', red: '#e0483d' }
export function gaugeBands(max, amberFrom, badFrom, higherIsBetter) {
  const clamp = (v) => Math.max(0, Math.min(v, max))
  const a = clamp(amberFrom), b = clamp(badFrom)
  const first = higherIsBetter ? 'red' : 'green'
  const last = higherIsBetter ? 'green' : 'red'
  // [0→amberFrom]=first, [amberFrom→second]=amber, [second→max]=last
  return [
    { to: a / max, color: BAND_COLORS[first] },
    { to: b / max, color: BAND_COLORS.amber },
    { to: 1, color: BAND_COLORS[last] },
  ]
}
