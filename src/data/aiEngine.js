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
// dashboardNarrative — a WRITTEN, plain-language summary of the dashboard (what it is,
// what it shows, how it reads right now) — prose, not a list of ticket facts.
// ---------------------------------------------------------------------------
export function dashboardNarrative(board, role = 'technician') {
  const t = board.tiles || []
  const kpis = t.filter((x) => x.type === 'kpi')
  const charts = t.filter((x) => x.type === 'chart')
  const shorts = t.filter((x) => x.type === 'shortcut')
  const names = (arr, n = 3) => {
    const s = arr.map((x) => x.title).slice(0, n)
    const extra = arr.length - s.length
    return s.join(', ') + (extra > 0 ? ` and ${extra} more` : '')
  }
  const lens = role === 'exec' ? 'a leadership' : role === 'manager' ? 'a team' : 'a day-to-day'
  const parts = [
    `“${board.name}” is ${lens} view of your service desk, built from ${kpis.length} headline KPIs, ${charts.length} charts and ${shorts.length} record ${shorts.length === 1 ? 'list' : 'lists'}.`,
  ]
  if (kpis.length) parts.push(`The KPIs track ${names(kpis)}, giving you the current state at a glance.`)
  if (charts.length) parts.push(`The charts trend it over time — ${names(charts, 2)} — and the ${shorts.length ? `worklist (${names(shorts, 1)})` : 'lists'} surfaces the individual records that need a technician’s hands.`)
  const fs = facts(board, role)
  const bad = fs.filter((f) => f.severity === 'bad').length
  parts.push(fs.length
    ? `Overall it’s reading as ${bad ? 'needs-attention' : 'slightly stretched'} right now, with the most pressure on SLA and overdue work — a good place to start.`
    : 'Overall everything is sitting within its normal range right now, so there’s no immediate action to take.')
  return parts.join(' ')
}

// dashboardSummaryPoints — the written summary as grouped, relatable bullet points
// (the ClickUp-Brain style): "what this covers" + "how it reads right now".
export function dashboardSummaryPoints(board, role = 'technician') {
  const t = board.tiles || []
  const kpis = t.filter((x) => x.type === 'kpi')
  const charts = t.filter((x) => x.type === 'chart')
  const shorts = t.filter((x) => x.type === 'shortcut')
  const names = (arr, n = 3) => {
    const s = arr.map((x) => x.title).slice(0, n)
    const e = arr.length - s.length
    return s.join(', ') + (e > 0 ? ` and ${e} more` : '')
  }
  const fs = facts(board, role)
  const bad = fs.filter((f) => f.severity === 'bad')
  const warn = fs.filter((f) => f.severity === 'warn')
  const covers = [
    kpis.length && `${kpis.length} headline KPIs — ${names(kpis)}`,
    charts.length && `${charts.length} charts trending ${names(charts, 2)}`,
    shorts.length && `A worklist: ${names(shorts, 1)}`,
  ].filter(Boolean)
  const state = []
  if (bad.length) state.push(`${bad.length} thing${bad.length > 1 ? 's' : ''} need action now — top of the list is ${bad[0].chip}`)
  if (warn.length) state.push(`${warn.length} more worth watching: ${warn.map((f) => f.chip).slice(0, 2).join(', ')}`)
  if (!fs.length) state.push('Everything is within its normal range')
  state.push(bad.length ? 'Most of the pressure is on SLA and overdue work' : 'Overall the board is steady')
  return [
    { title: 'What this dashboard covers', points: covers },
    { title: 'How it reads right now', points: state },
  ]
}

// ---------------------------------------------------------------------------
// widgetBrief — a tiny grounded summary + two type-specific suggestive actions for a
// single tile, shown on hover of its AI sparkle. Works on any real tile (KPI / chart /
// shortcut), degrading gracefully when history/delta aren't present.
// ---------------------------------------------------------------------------
export function widgetBrief(tile) {
  const t = tile || {}
  if (t.type === 'kpi') {
    const a = anomalyFor(t)
    const base = `${t.title} is ${t.value}${t.unit || ''}`
    const wow = t.delta ? `, ${t.delta.dir} ${t.delta.pct}% vs last week` : ''
    const summary = a
      ? `${base} — ${a.pctVsMean > 0 ? 'well above' : 'well below'} its ~${a.mean}${t.unit || ''} average (${a.pctVsMean > 0 ? '+' : ''}${a.pctVsMean}%). A clear outlier worth a look.`
      : t.status === 'bad' ? `${base}${wow} — flagged as needing attention.`
        : t.status === 'warn' ? `${base}${wow} — worth keeping an eye on.`
          : t.delta ? `${base}${wow} — within its normal range.`
            : `${base}.`
    const statusLabel = t.status === 'bad' ? 'Needs attention' : t.status === 'warn' ? 'Watch' : t.status === 'good' ? 'Healthy' : '—'
    const details = [
      { label: 'Value', value: `${t.value}${t.unit || ''}` },
      t.delta && { label: 'WoW change', value: `${t.delta.dir === 'up' ? '▲' : t.delta.dir === 'down' ? '▼' : ''} ${t.delta.pct}%` },
      { label: 'Status', value: statusLabel },
      a && { label: 'vs average', value: `${a.pctVsMean > 0 ? '+' : ''}${a.pctVsMean}% (≈${a.mean}${t.unit || ''})` },
    ].filter(Boolean)
    return { summary, details, actions: [
      { label: 'Why did it change?', intent: 'explain', text: `Why did ${t.title} change?` },
      { label: 'Show the records', intent: 'drill', text: `Show the records behind ${t.title}` },
    ] }
  }
  if (t.type === 'shortcut') {
    const rows = t.rows || []
    const cols = t.columns || []
    const prIdx = cols.indexOf('Priority')
    const p1 = prIdx >= 0 ? rows.filter((r) => /p1/i.test(r[prIdx] || '')).length : 0
    const summary = `${rows.length} record${rows.length === 1 ? '' : 's'}${p1 ? ` · ${p1} are P1` : ''}. ${p1 ? 'The highest-priority work is at the top.' : 'Sorted by most recent.'}`
    const byPr = {}
    if (prIdx >= 0) rows.forEach((r) => { const p = (r[prIdx] || '').toUpperCase().trim(); if (p) byPr[p] = (byPr[p] || 0) + 1 })
    const prStr = Object.entries(byPr).map(([k, v]) => `${k}×${v}`).join(', ')
    const details = [
      { label: 'Records', value: String(rows.length) },
      prStr && { label: 'By priority', value: prStr },
      { label: 'Columns', value: cols.join(', ') },
    ].filter(Boolean)
    return { summary, details, actions: [
      { label: 'Prioritize these', intent: 'drill', text: `Prioritize ${t.title}` },
      { label: 'Find similar tickets', intent: 'drill', text: `Find tickets similar to those in ${t.title}` },
    ] }
  }
  // chart — list every series' data, or every slice's value + share (capped for very wide charts)
  const ch = t.chart || {}
  const series = ch.series || []
  const labels = ch.labels || []
  let summary
  let details = []
  if (['pie', 'donut'].includes(ch.kind)) {
    const vals = series[0]?.values || []
    const total = vals.reduce((a, b) => a + b, 0) || 1
    const maxI = vals.indexOf(Math.max(...vals))
    summary = `${labels[maxI] || 'The top slice'} leads at ${Math.round((vals[maxI] / total) * 100)}% across ${vals.length} categories.`
    details = labels.slice(0, 6).map((l, i) => ({ label: l, value: `${vals[i]} · ${Math.round((vals[i] / total) * 100)}%` }))
    if (labels.length > 6) details.push({ label: `+${labels.length - 6} more`, value: '' })
  } else if (series.length >= 2) {
    summary = `${series[0].name} vs ${series[1].name} across ${labels.length} points — the gap is the story.`
    if (labels.length) details.push({ label: 'Categories', value: labels.join(', ') })
    series.forEach((s) => details.push({ label: s.name, value: (s.values || []).join(', ') }))
  } else if (series[0]) {
    const v = series[0].values || []
    const trend = v.length > 1 ? (v[v.length - 1] >= v[0] ? 'rising' : 'falling') : 'flat'
    summary = `${series[0].name} is ${trend} over ${v.length} points.`
    if (labels.length) details.push({ label: 'Points', value: labels.join(', ') })
    details.push({ label: series[0].name, value: v.join(', ') })
  } else summary = `${t.title}.`
  return { summary, details, actions: [
    { label: 'Explain the trend', intent: 'explain', text: `Explain the trend in ${t.title}` },
    { label: 'Break it down', intent: 'drill', text: `Break down ${t.title} by category` },
  ] }
}

// ---------------------------------------------------------------------------
// "What changed since your last visit" — grounded in each KPI's own delta + status,
// plus a worklist change. A fixed last-visit label keeps the demo honest without a clock.
// This is the ITSM flow: a technician returning to their board sees, at a glance, which
// metrics moved and which need action — no re-scanning every widget.
// ---------------------------------------------------------------------------
export function changesSinceLastVisit(board) {
  const items = board.tiles
    .filter((t) => t.type === 'kpi' && t.delta)
    .map((t) => ({
      widget: t.title,
      dir: t.delta.dir,
      delta: `${t.delta.dir === 'up' ? '+' : t.delta.dir === 'down' ? '−' : ''}${t.delta.pct}%`,
      value: `${t.value}${t.unit || ''}`,
      severity: t.status,                       // good | warn | bad
      note: t.status === 'bad'
        ? `${t.title} broke out of its normal range while you were away`
        : '',
    }))
  // the worklist gained new records — the thing a technician most needs to know
  const wl = board.tiles.find((t) => t.type === 'shortcut')
  if (wl) items.push({
    widget: wl.title, dir: 'up', delta: '+4 new', value: `${wl.rows.length} open`,
    severity: 'bad', note: '4 new P1 requests were assigned to you since your last visit',
  })
  // rank so the things that need action lead
  const rank = { bad: 0, warn: 1, good: 2 }
  items.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3))
  return { lastVisit: '2 days ago · Mon, 18 Jul at 9:12 AM', items }
}

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

// drillNarrative — the WRITTEN, plain-language answer for an "Investigate" (replaces the
// records table). Grounded: it counts the same rows the table would have shown and phrases
// them — how many, the priority/status split, which records are closest to breaching, and
// (for an anomaly) the z-score reasoning folded in. Degrades to a short line when a fact has
// no worklist behind it. Returns an array of sentences so the UI can render them as prose.
export function drillNarrative(board, fact) {
  const wl = board.tiles.find((t) => t.type === 'shortcut')
  const anomaly = fact.kind === 'anomaly' ? anomalyFor(board.tiles.find((t) => t.id === fact.tileId)) : null
  const out = []

  // Lead with the "why" when this is an anomaly, so Investigate also answers Explain.
  if (anomaly) out.push(anomaly.text)

  if (!wl) {
    out.push('There is no record list behind this metric to open, so act on it from its source module.')
    return out
  }
  const cols = wl.columns
  const iOf = (c) => cols.indexOf(c)
  const prIdx = iOf('Priority'), stIdx = iOf('Status'), dueIdx = iOf('Due'), subjIdx = iOf('Subject'), reqIdx = iOf('Requester')
  const rows = wl.rows

  // Scope the rows the same way the table would have (by fact kind).
  let scoped = rows
  if (fact.kind === 'breach') scoped = rows.filter((r) => /p1/i.test(r[prIdx] || ''))
  const dueToday = dueIdx >= 0 ? scoped.filter((r) => /today/i.test(r[dueIdx] || '')) : []
  const p1 = prIdx >= 0 ? scoped.filter((r) => /p1/i.test(r[prIdx] || '')).length : 0
  const inProg = stIdx >= 0 ? scoped.filter((r) => /in progress/i.test(r[stIdx] || '')).length : 0
  const open = stIdx >= 0 ? scoped.filter((r) => /^open$/i.test((r[stIdx] || '').trim())).length : 0

  // Sentence 1 — the shape of the record set.
  const parts = [`${scoped.length} record${scoped.length === 1 ? '' : 's'} sit behind this in “${wl.title}”`]
  if (p1) parts.push(`${p1} at P1`)
  if (dueToday.length) parts.push(`${dueToday.length} due today`)
  out.push(parts.join(', ') + '.')

  // Sentence 2 — name the ones closest to breaching (the actionable detail).
  const top = (dueToday.length ? dueToday : scoped).slice(0, 2).map((r) => {
    const s = subjIdx >= 0 ? r[subjIdx] : 'a request'
    const who = reqIdx >= 0 && r[reqIdx] ? ` (${r[reqIdx]})` : ''
    return `${s}${who}`
  })
  if (top.length) out.push(`${dueToday.length ? 'Closest to breach' : 'Top of the list'}: ${top.join(' and ')}.`)

  // Sentence 3 — the status split, so it reads like a briefing not a dump.
  if (inProg || open) {
    const bits = []
    if (inProg) bits.push(`${inProg} already in progress`)
    if (open) bits.push(`${open} still unactioned`)
    out.push(bits.join(', ') + ' — ' + (inProg >= open ? 'work is under way but not finished.' : 'most have not been picked up yet.'))
  }
  return out
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
