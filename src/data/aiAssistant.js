/**
 * aiAssistant — the brain of the ONE unified AI Assistant.
 *
 * Everything the assistant can do (summarize · explain · investigate · build) is
 * a mode routed from a single input, so the four research problems (P1–P4) are
 * solved by one feature, not four surfaces. Grounded + no-LLM: a deterministic
 * layer (aiEngine) computes; this module only routes intent and maps a
 * description → widget spec against a governed catalog.
 */
import { anomalies, facts } from './aiEngine.js'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

// Governed catalog (Q3) — the only fields the assistant may reference. Anything
// outside it is flagged, never invented.
export const CATALOG = ['Priority', 'Status', 'SLA', 'Team', 'Type', 'Backlog', 'Created date', 'Assignee', 'Module']

export const KINDS = [
  { id: 'bar', label: 'Column', icon: 'chart-bar' },
  { id: 'line', label: 'Line', icon: 'chart-line' },
  { id: 'donut', label: 'Doughnut', icon: 'chart-donut' },
]

// Suggested prompts — one per problem, so the demo shows one feature covering all four.
export const SUGGESTIONS = [
  { label: 'What needs my attention?', intent: 'summary' },
  { label: 'Why did Overdue spike?', intent: 'explain' },
  { label: 'Show the P1s breaching today', intent: 'drill' },
  { label: 'Create: SLA breaches this week by team', intent: 'create' },
]

// ---- intent routing (keyword-based; a small on-prem model swaps in later) ----
export function routeIntent(text) {
  const t = text.toLowerCase().trim()
  if (/^create|^build|^make|^add |describe|new widget|\bby (team|priority|type|month|day)\b|\btrend\b/.test(t)) return 'create'
  if (/\bwhy\b|explain|anomal|spike|spiked|drop|surge|cause/.test(t)) return 'explain'
  if (/breach|overdue|\blist\b|\bshow\b|which|drill|\bp1\b|due today|records/.test(t)) return 'drill'
  if (/attention|summar|focus|urgent|going on|what.?s wrong|status|overview/.test(t)) return 'summary'
  return 'summary'
}

// ---- explain / drill helpers: figure out which tile a prompt is about ----
export function tileFromText(board, text) {
  const t = (text || '').toLowerCase()
  return board.tiles.find((x) => x.title && t.includes(x.title.toLowerCase()))
    || board.tiles.find((x) => x.metric && t.includes(x.metric))
    || anomalies(board)[0]?.tile
    || board.tiles.find((x) => x.type === 'kpi')
}

export function factFromText(board, text) {
  const t = (text || '').toLowerCase().trim()
  // Exact/substring match against the deterministically-ranked facts first, so an
  // "Investigate" launched from the summary card resolves to that same fact (right
  // tile to spotlight, right kind to narrate) rather than defaulting to the breach.
  const fs = facts(board)
  const hit = fs.find((f) => f.text.toLowerCase() === t)
    || (t && fs.find((f) => t.includes(f.chip.toLowerCase()) || f.text.toLowerCase().includes(t)))
  if (hit) return hit
  if (/overdue|anomal|spike|spiked|surge/.test(t)) {
    const a = anomalies(board)[0]
    if (a) return { kind: 'anomaly', tileId: a.tile.id, chip: a.tile.title, text: a.anomaly.text, severity: a.anomaly.severity }
  }
  return { kind: 'breach', chip: 'My Open P1 Requests', text: 'P1 requests breaching SLA today', severity: 'bad' }
}

// ---- P4: description → widget spec, grounded to the catalog (no-LLM matcher) ----
const clone = (o) => JSON.parse(JSON.stringify(o))
const SPECS = {
  sla: {
    title: 'P1 breaching SLA · by team', kind: 'bar',
    chips: [{ field: 'Priority', op: '=', value: 'P1' }, { field: 'SLA', op: 'is', value: 'Breaching' }, { field: 'Created date', op: 'in', value: 'This week' }, { field: 'Group by', op: '', value: 'Team' }],
    chart: { kind: 'bar', labels: ['Helpdesk', 'Network', 'Apps', 'Infra'], series: [{ name: 'Breaching', values: [6, 4, 2, 1] }] },
    why: 'A column chart compares one value across a few named groups — the clearest read for “by team”.',
  },
  backlog: {
    title: 'Backlog trend · last 6 months', kind: 'line',
    chips: [{ field: 'Backlog', op: '=', value: 'Open' }, { field: 'Created date', op: 'in', value: 'Last 6 months' }],
    chart: { kind: 'line', labels: MON, series: [{ name: 'Backlog', values: [180, 210, 198, 240, 232, 248] }] },
    why: 'A line chart shows movement over time — the right choice for a trend across months.',
  },
  priority: {
    title: 'Open tickets · by priority', kind: 'donut',
    chips: [{ field: 'Status', op: '=', value: 'Open' }, { field: 'Group by', op: '', value: 'Priority' }],
    chart: { kind: 'donut', labels: ['P1', 'P2', 'P3', 'P4'], series: [{ name: 'Priority', values: [18, 64, 120, 46] }] },
    why: 'A doughnut shows parts of a whole — ideal for a share across four priorities.',
  },
  asset: {
    title: 'Assets · by type', kind: 'bar',
    chips: [{ field: 'Module', op: '=', value: 'Asset' }, { field: 'Group by', op: '', value: 'Type' }],
    chart: { kind: 'bar', labels: ['Laptop', 'Desktop', 'Server', 'Mobile', 'Network'], series: [{ name: 'Assets', values: [2100, 1200, 320, 900, 300] }] },
    why: 'A column chart compares counts across categories.',
  },
}
export function specFromText(text) {
  const t = (text || '').toLowerCase()
  if (/sla|breach/.test(t)) return clone(SPECS.sla)
  if (/backlog|trend|month/.test(t)) return clone(SPECS.backlog)
  if (/priorit/.test(t)) return clone(SPECS.priority)
  if (/asset/.test(t)) return clone(SPECS.asset)
  return {
    title: (text || 'New widget').replace(/^create:?\s*/i, '').slice(0, 42) || 'New widget', kind: 'bar',
    chips: [{ field: 'Module', op: '=', value: 'Request' }, { field: 'Created date', op: 'in', value: 'Last 30 days' }],
    chart: { kind: 'bar', labels: ['A', 'B', 'C', 'D'], series: [{ name: 'Count', values: [24, 38, 19, 30] }] },
    why: 'A column chart is a safe default for comparing counts; refine the fields below.',
  }
}
