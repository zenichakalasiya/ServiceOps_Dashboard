/**
 * aiEngine — the deterministic, GROUNDED, no-LLM core behind the AI showcase.
 *
 * Principle (from the research): the model never computes numbers. A deterministic
 * layer computes every fact — breach counts, week-over-week deltas, z-score
 * outliers — and a language layer only PHRASES them. In this prototype that
 * language layer is a set of JS string templates (no real LLM), which is exactly
 * the "graceful no-LLM fallback" every feature must degrade to on-prem. Swapping
 * in a 7B model later changes the phrasing, not the numbers.
 *
 * Shared by P1-D (Focus summary), P3-B (Anomaly badge) and P2-A (Deep-dive).
 */

// ---------------------------------------------------------------------------
// Anomaly — a robust z-score over a KPI's own recent history.
// A value is flagged only when it sits > THRESH standard deviations from its
// trailing mean. THRESH is set so the demo's Overdue spike trips while the SLA
// near-miss deliberately does NOT (the restraint proof — no crying wolf).
// ---------------------------------------------------------------------------
const THRESH = 3.0

export function anomalyFor(tile) {
  if (tile.type !== 'kpi' || !Array.isArray(tile.history) || tile.history.length < 4) return null
  const h = tile.history
  const mean = h.reduce((a, b) => a + b, 0) / h.length
  const sd = Math.sqrt(h.reduce((a, b) => a + (b - mean) ** 2, 0) / h.length) || 1
  const value = Number(tile.value)
  const z = (value - mean) / sd
  if (Math.abs(z) < THRESH) return null
  const pctVsMean = Math.round(((value - mean) / mean) * 100)
  return {
    z: +z.toFixed(1),
    dir: z > 0 ? 'up' : 'down',
    mean: +mean.toFixed(mean < 100 ? 0 : 0),
    value,
    pctVsMean,
    // severity: a "bad"-status KPI that spikes is bad; otherwise scale by z
    severity: tile.status === 'bad' ? 'bad' : Math.abs(z) > 5 ? 'bad' : 'warn',
    // templated narration (the LLM's job in production; a template here)
    text: `${tile.title} is ${value}${tile.unit || ''} — ${z > 0 ? 'well above' : 'well below'} its recent range (avg ${Math.round(mean)}${tile.unit || ''}). That's ${Math.abs(z).toFixed(1)}× the normal week-to-week swing.`,
    how: `z-score over the last ${h.length} periods: (value − mean) ÷ std-dev = (${value} − ${mean.toFixed(1)}) ÷ ${sd.toFixed(1)} = ${z.toFixed(1)}. Flagged because |z| ≥ ${THRESH}.`,
    history: h,
  }
}

export function anomalies(board) {
  return board.tiles.map((t) => ({ tile: t, anomaly: anomalyFor(t) })).filter((x) => x.anomaly)
}

// ---------------------------------------------------------------------------
// Role-aware ranking — the heart of "for your role".
// Each fact type is weighted differently per persona; a technician cares most
// about imminent breaches, an exec about trend deltas.
// ---------------------------------------------------------------------------
export const ROLE_WEIGHTS = {
  technician: { breach: 1.4, anomaly: 1.1, delta: 0.8, backlog: 0.7 },
  manager: { breach: 1.0, anomaly: 1.2, delta: 1.1, backlog: 1.1 },
  exec: { breach: 0.7, anomaly: 1.0, delta: 1.4, backlog: 1.2 },
}
export const ROLES = [
  { key: 'technician', label: 'L1/L2 Technician' },
  { key: 'manager', label: 'Service-desk Manager' },
  { key: 'exec', label: 'Executive' },
]
const SEV = { bad: 3, warn: 2, good: 1 }

// ---------------------------------------------------------------------------
// Facts — everything worth surfacing, computed deterministically from the board.
// ---------------------------------------------------------------------------
export function facts(board, role = 'technician') {
  const out = []

  // 1. Breach imminence — from the P1 worklist (records due Today).
  const wl = board.tiles.find((t) => t.type === 'shortcut')
  if (wl) {
    const dueIdx = wl.columns.indexOf('Due')
    const prIdx = wl.columns.indexOf('Priority')
    const due = wl.rows.filter((r) => /today/i.test(r[dueIdx] || '') && /p1/i.test(r[prIdx] || ''))
    if (due.length) {
      out.push({
        id: 'breach', kind: 'breach', tileId: wl.id, severity: 'bad',
        text: `${due.length} P1 request${due.length > 1 ? 's' : ''} breach SLA today`,
        chip: 'My Open P1 Requests', base: 100,
        how: `Count of rows in “${wl.title}” where Priority = P1 and Due is today (${due.length} of ${wl.rows.length}).`,
      })
    }
  }

  // 2. Anomalies — a spiking/dropping KPI vs its own history.
  for (const { tile, anomaly } of anomalies(board)) {
    out.push({
      id: 'anom-' + (tile.metric || tile.id), kind: 'anomaly', tileId: tile.id, severity: anomaly.severity,
      text: `${tile.title} spiked to ${anomaly.value}${tile.unit || ''} — ${anomaly.pctVsMean > 0 ? '+' : ''}${anomaly.pctVsMean}% vs its ${anomaly.mean}${tile.unit || ''} average`,
      chip: tile.title, base: 80, how: anomaly.how,
    })
  }

  // 3. Notable week-over-week deltas (warn/bad KPIs not already an anomaly).
  for (const t of board.tiles.filter((t) => t.type === 'kpi' && t.delta)) {
    if (out.some((f) => f.tileId === t.id)) continue
    if (t.status === 'good') continue
    out.push({
      id: 'delta-' + (t.metric || t.id), kind: 'delta', tileId: t.id, severity: t.status === 'bad' ? 'bad' : 'warn',
      text: `${t.title} ${t.delta.dir === 'up' ? 'up' : 'down'} ${t.delta.pct}% week-over-week`,
      chip: t.title, base: 50,
      how: `Change vs the prior window for “${t.title}”: ${t.delta.dir === 'up' ? '+' : '−'}${t.delta.pct}%.`,
    })
  }

  // score & rank by role
  const W = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.technician
  out.forEach((f) => { f.score = f.base * (W[f.kind] || 1) * SEV[f.severity] })
  return out.sort((a, b) => b.score - a.score)
}

// Confidence is deterministic (data completeness), NOT model-derived.
export function confidence(board) {
  const kpis = board.tiles.filter((t) => t.type === 'kpi')
  const withHist = kpis.filter((t) => Array.isArray(t.history) && t.history.length >= 4).length
  const ratio = kpis.length ? withHist / kpis.length : 0
  return ratio >= 0.75 ? 'high' : ratio >= 0.4 ? 'medium' : 'low'
}

// A stable "updated N min ago" without Date.now() (blocked in some contexts); the
// showcase is a demo, so a fixed freshness label reads honestly enough.
export const FRESHNESS = 'just now'

// ---------------------------------------------------------------------------
// Deep-dive (P2-A). Given a fact, derive: editable scope chips, the record set
// behind it, and 1–3 next-best-actions. The "3-tier honest drill" — because most
// tiles have no per-record rows in mock, we degrade gracefully:
//   tier 1  records      → the fact maps to a worklist; show its filtered rows
//   tier 2  sibling rows → a KPI has no rows; show the related worklist + a note
//   tier 3  scoped chart → nothing to list; scope the chart (not needed in demo)
// ---------------------------------------------------------------------------
export function applyChips(rows, columns, chips) {
  return rows.filter((r) => chips.every((c) => {
    const idx = columns.indexOf(c.field)
    if (idx < 0) return true                 // chip isn't a table column (e.g. Metric) → informational only
    const cell = String(r[idx]).toLowerCase()
    return cell.includes(String(c.value).toLowerCase())
  }))
}

// Record/drill-level next-best-actions (catalog section C). The last two — find-similar
// and suggest-KB — are the ticket-level actions that used to sit (wrongly) on the
// dashboard card; they belong HERE, once you've drilled into the records.
const RESOLVE_ACTIONS = [
  { id: 'similar', icon: 'copy', label: 'Find similar tickets', confirm: 'Pull resolved look-alikes and the fixes that worked?', danger: false },
  { id: 'kb', icon: 'file-text', label: 'Suggest resolution / KB', confirm: 'Surface the likely root cause and steps from resolved tickets?', danger: false },
]
function actionsFor(fact) {
  if (fact.kind === 'breach') return [
    { id: 'reassign', icon: 'team', label: 'Reassign stalled P1s to on-call', confirm: 'Reassign the stalled P1 requests to the on-call technician?' },
    { id: 'escalate', icon: 'trend', label: 'Escalate all to Major Incident', confirm: 'Escalate these P1 requests to the Major Incident process?' },
    { id: 'notify', icon: 'mail', label: 'Notify affected stakeholders', confirm: 'Send a status note to the affected stakeholders?', danger: false },
    ...RESOLVE_ACTIONS,
  ]
  if (fact.kind === 'anomaly') return [
    { id: 'problem', icon: 'alert', label: 'Open a problem record for the spike', confirm: 'Open a problem record to investigate this spike?' },
    { id: 'escalate', icon: 'trend', label: 'Escalate to the shift lead', confirm: 'Escalate this anomaly to the current shift lead?' },
    { id: 'snooze', icon: 'clock', label: 'Snooze this anomaly for 24h', confirm: 'Snooze this anomaly alert for 24 hours?', danger: false },
    ...RESOLVE_ACTIONS,
  ]
  return [
    { id: 'review', icon: 'eye', label: 'Review in the source module', confirm: 'Open this insight in its source module?', danger: false },
    ...RESOLVE_ACTIONS,
  ]
}

export function drillFor(board, fact) {
  const wl = board.tiles.find((t) => t.type === 'shortcut')
  const columns = wl ? wl.columns : []
  const baseRows = wl ? wl.rows : []
  let chips = []
  let tier = 3
  let tierNote = ''

  if (fact.kind === 'breach') {
    chips = [
      { field: 'Priority', op: '=', value: 'P1', locked: true },
      { field: 'Status', op: 'is', value: 'Open' },
      { field: 'Due', op: '=', value: 'Today' },
    ]
    tier = 1
  } else if (fact.kind === 'anomaly') {
    chips = [
      { field: 'Metric', op: '=', value: fact.chip, locked: true },
      { field: 'Priority', op: '=', value: 'P1' },
    ]
    tier = 2
    tierNote = `“${fact.chip}” is a single number with no record list of its own — showing the related P1 worklist so you can act on it.`
  } else {
    chips = [{ field: 'Priority', op: '=', value: 'P1' }]
    tier = 2
    tierNote = 'Showing the related worklist for this insight.'
  }
  return { chips, baseRows, columns, tier, tierNote, actions: actionsFor(fact), sourceTitle: wl?.title || '' }
}
