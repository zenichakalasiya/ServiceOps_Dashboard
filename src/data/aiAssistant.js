/**
 * aiAssistant — the brain of the ONE unified AI Assistant.
 *
 * Everything the assistant can do (summarize · explain · investigate · build) is
 * a mode routed from a single input, so the four research problems (P1–P4) are
 * solved by one feature, not four surfaces. Grounded + no-LLM: a deterministic
 * layer (aiEngine) computes; this module only routes intent and maps a
 * description → widget spec against a governed catalog.
 */
import { anomalies } from './aiEngine.js'

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
  // these read like "summarise" but are different questions, so they go first
  if (/status (?:update|report)|draft an update|write an update|comms update/.test(t)) return 'status'
  if (/recovery plan|action plan|remediation plan|get (?:us |this )?back on track|plan to (?:fix|recover)/.test(t)) return 'plan'
  if (/work on first|start with|where do i start|what should i do first|order my|my queue/.test(t)) return 'worklist'
  // "create" must need a build verb — matching a bare "by priority" used to hijack
  // "explain the trend in Open Requests By Priority" into the widget builder.
  if (/^(create|build|make|add|generate|draft)\b|new widget|a widget|widget for|trend chart|chart (of|for)/.test(t)) return 'create'
  if (/investigate|breach|overdue|\blist\b|\bshow\b|which|drill|\bp1\b|due today|records|top offenders/.test(t)) return 'drill'
  if (/\bwhy\b|explain|anomal|spike|spiked|drop|surge|cause|\btrend\b|\bhow\b|tell me about|break ?down/.test(t)) return 'explain'
  if (/attention|summar|focus|going on|what.?s wrong|status|overview/.test(t)) return 'summary'
  return 'explain'   // a question about a widget explains it, rather than dumping a generic summary
}

// ---- explain / drill helpers: figure out which tile a prompt is about ----
export function tileFromText(board, text) {
  const t = (text || '').toLowerCase()
  // Prefer the MOST SPECIFIC title match: "Open Requests By Priority" must win over
  // "Open Requests", or explaining a chart silently explains the KPI beside it.
  const hits = board.tiles.filter((x) => x.title && t.includes(x.title.toLowerCase()))
  if (hits.length) return hits.sort((a, b) => b.title.length - a.title.length)[0]
  return board.tiles.find((x) => x.metric && t.includes(x.metric))
    || anomalies(board)[0]?.tile
    || board.tiles.find((x) => x.type === 'kpi')
}

export function factFromText(board, text) {
  const t = (text || '').toLowerCase()
  if (/overdue|anomal|spike|spiked|surge/.test(t)) {
    const a = anomalies(board)[0]
    if (a) return { kind: 'anomaly', tileId: a.tile.id, chip: a.tile.title, text: a.anomaly.text, severity: a.anomaly.severity }
  }
  return { kind: 'breach', chip: 'My Open P1 Requests', text: 'P1 requests breaching SLA today', severity: 'bad' }
}

/* ============================================================================
 * resolveWidget — turn a plain description into a REAL, configured widget.
 *
 * Reads the module, the filters, the grouping dimension, the time window and the
 * form from the user's own words, then generates data shaped like that dimension
 * (a priority split descends; a month series trends; a team split is uneven).
 * Whatever it genuinely cannot infer comes back in `missing`, so the flow can ask
 * instead of guessing. Deterministic: the same sentence always builds the same
 * widget — a language model would only rephrase the title.
 * ========================================================================== */
export const GROUP_DIMS = [
  { id: 'priority', label: 'Priority', labels: ['Low', 'Medium', 'High', 'Urgent'] },
  { id: 'status', label: 'Status', labels: ['Open', 'In Progress', 'Pending', 'Resolved', 'Closed'] },
  { id: 'team', label: 'Team', labels: ['Helpdesk', 'Network', 'Apps', 'Infra', 'Field Ops'] },
  { id: 'technician', label: 'Technician', labels: ['yash', 'Juli Gopani', 'ahmedraza', 'Keya', 'Stuti', 'Unassigned'] },
  { id: 'category', label: 'Category', labels: ['Hardware', 'Software', 'Network', 'Access', 'Email'] },
  { id: 'site', label: 'Site', labels: ['Ahmedabad', 'Pune', 'Bengaluru', 'Remote'] },
  { id: 'month', label: 'Month', labels: MON },
  { id: 'day', label: 'Day of week', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
]
const DIM_RE = {
  priority: /\bby priority|per priority|priority (?:split|breakdown|wise)|across priorit/i,
  status: /\bby status|per status|status (?:split|breakdown|wise)/i,
  team: /\bby team|per team|across teams|team ?wise|by group/i,
  technician: /\bby (?:technician|assignee|agent|engineer)|per (?:technician|assignee|agent)|who is working/i,
  category: /\bby category|per category|by type|category ?wise/i,
  site: /\bby (?:site|location|office|region)|per (?:site|location|office)/i,
  month: /\bby month|per month|monthly|over (?:the )?(?:last|past) \d+ months?|month ?wise|over time/i,
  day: /\bby day|per day|daily|day of week|weekday/i,
}
const MODULES = [
  { id: 'asset', label: 'Assets', re: /\basset|hardware|laptop|desktop|server|device|patch|vulnerab/i },
  { id: 'change', label: 'Changes', re: /\bchange|release|deploy|rollout/i },
  { id: 'problem', label: 'Problems', re: /\bproblem|root cause/i },
  { id: 'task', label: 'Tasks', re: /\btask/i },
  { id: 'request', label: 'Requests', re: /.*/ },
]
const FILTERS = [
  { re: /overdue|past due/i, word: 'Overdue', chip: { field: 'Due', op: 'is', value: 'Overdue' } },
  { re: /breach|\bsla\b/i, word: 'SLA-breaching', chip: { field: 'SLA', op: 'is', value: 'Breaching' } },
  { re: /unassigned|no owner|nobody/i, word: 'Unassigned', chip: { field: 'Assignee', op: 'is', value: 'Unassigned' } },
  { re: /\bp1\b|urgent|critical/i, word: 'Urgent', chip: { field: 'Priority', op: '=', value: 'Urgent' } },
  { re: /\bopen\b|outstanding|backlog/i, word: 'Open', chip: { field: 'Status', op: '=', value: 'Open' } },
  { re: /resolved|closed|completed/i, word: 'Resolved', chip: { field: 'Status', op: '=', value: 'Resolved' } },
]
const WINDOWS = [
  { re: /today/i, value: 'Today' },
  { re: /this week|last 7 days/i, value: 'This week' },
  { re: /this month|last 30 days/i, value: 'Last 30 days' },
  { re: /(?:last|past) (\d+) months?/i, value: (m) => `Last ${m[1]} months` },
  { re: /this (?:quarter|year)/i, value: 'This year' },
]
// a stable pseudo-random from the text, so the same prompt always builds the same widget
function seedOf(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff; return h }
function valuesFor(dimId, labels, seed) {
  const r = (i) => (seed >> (i % 11)) * (i + 7) % 97
  if (dimId === 'priority') return labels.map((_, i) => Math.max(6, 130 - i * 34 + (r(i) % 17)))
  if (dimId === 'status') return [96, 54, 30, 42, 26].map((v, i) => Math.max(5, v + (r(i) % 15) - 7))
  if (dimId === 'month' || dimId === 'day') {
    let v = 90 + (seed % 60)
    return labels.map((_, i) => { v = Math.max(12, v + ((r(i) % 29) - 12)); return v })
  }
  // team / technician / category / site — an uneven spread with a clear leader
  return labels.map((_, i) => Math.max(3, 62 - i * 8 + (r(i) % 21)))
}
function detectDim(t) { return GROUP_DIMS.find((d) => DIM_RE[d.id] && DIM_RE[d.id].test(t)) || null }
/* A form the user named OUTRIGHT, as opposed to one we inferred. Needed because
 * "add 4 KPIs: a, b, c, d" states the form once in the preamble — which the
 * splitter strips — so each item would otherwise fall back to a bar chart. */
export function explicitForm(text) {
  const t = String(text || '')
  if (/\bkpis?\b|headline|single number|\bcounters?\b/i.test(t)) return 'kpi'
  if (/\bshortcuts?\b|\btables?\b|\blists?\b|records|rows|worklist/i.test(t)) return 'shortcut'
  if (/\bline chart\b|\btrend line\b/i.test(t)) return 'line'
  if (/\bdoughnut\b|\bdonut\b|\bpie\b/i.test(t)) return 'donut'
  if (/\bbar chart\b/i.test(t)) return 'hbar'
  if (/\bcolumn chart\b/i.test(t)) return 'bar'
  return null
}
// how a KPI of each kind typically reads, so four counters don't all show 128
const KPI_SHAPE = {
  Overdue: { base: 14, spread: 26, status: 'bad', dir: 'up' },
  'SLA-breaching': { base: 8, spread: 18, status: 'bad', dir: 'up' },
  Unassigned: { base: 6, spread: 15, status: 'warn', dir: 'down' },
  Urgent: { base: 4, spread: 13, status: 'bad', dir: 'up' },
  Open: { base: 160, spread: 130, status: 'warn', dir: 'up' },
  Resolved: { base: 90, spread: 110, status: 'good', dir: 'up' },
}
function kpiFacts(filters, seed) {
  const s = KPI_SHAPE[filters[0]?.word] || { base: 40, spread: 90, status: 'warn', dir: 'up' }
  return { value: s.base + (seed % s.spread), status: s.status, delta: { dir: s.dir, pct: 2 + (seed % 19) } }
}
function detectForm(t, dim) {
  if (/\bkpi\b|headline|how many|total number|single number|counter|^count\b/i.test(t)) return 'kpi'
  if (/\blist\b|\btable\b|records|rows|worklist|shortcut/i.test(t)) return 'shortcut'
  if (dim && (dim.id === 'month' || dim.id === 'day')) return 'line'
  if (/trend|over time|growth/i.test(t)) return 'line'
  if (/share|split|proportion|breakdown|percentage|pie|doughnut|donut/i.test(t)) return 'donut'
  if (dim && dim.id === 'priority') return 'donut'
  return 'bar'
}
export function resolveWidget(text, preferKind) {
  const t = String(text || '').trim()
  const mod = MODULES.find((m) => m.re.test(t))
  const filters = FILTERS.filter((f) => f.re.test(t))
  const dim = detectDim(t)
  const form = preferKind || detectForm(t, dim)
  const winHit = WINDOWS.find((w) => w.re.test(t))
  const win = winHit ? (typeof winHit.value === 'function' ? winHit.value(t.match(winHit.re)) : winHit.value) : null
  const measure = [...new Set(filters.map((f) => f.word))].join(' ')
  const subject = `${measure} ${mod.label}`.trim()
  const needsGroup = ['bar', 'hbar', 'line', 'donut'].includes(form)
  const missing = needsGroup && !dim ? ['groupBy'] : []

  const chips = [
    { field: 'Module', op: '=', value: mod.label },
    ...filters.map((f) => f.chip),
    win ? { field: 'Created date', op: 'in', value: win } : null,
    dim ? { field: 'Group by', op: '', value: dim.label } : null,
  ].filter(Boolean)

  const title = dim
    ? `${subject} by ${dim.label.toLowerCase()}`
    : form === 'kpi' ? subject : `${subject}${win ? ` · ${win.toLowerCase()}` : ''}`

  const spec = {
    title, kind: form, module: mod.label, groupBy: dim ? dim.id : null,
    window: win, filters, chips, missing,
    why: form === 'line' ? 'A line chart shows movement over time.'
      : form === 'donut' ? 'A doughnut shows parts of a whole.'
      : form === 'kpi' ? 'A single number, when the level is what matters.'
      : form === 'shortcut' ? 'The records themselves, as a list you can act on.'
      : 'A column chart compares one value across named groups.',
  }
  if (dim) {
    const seed = seedOf(t + dim.id)
    spec.chart = { kind: form === 'kpi' || form === 'shortcut' ? 'bar' : form, labels: [...dim.labels], series: [{ name: subject || 'Count', values: valuesFor(dim.id, dim.labels, seed) }] }
    spec.total = spec.chart.series[0].values.reduce((a, b) => a + b, 0)
  }
  // an ungrouped KPI still needs a believable number — and one that DIFFERS per
  // condition, or four counters all read the same
  if (form === 'kpi') {
    const k = kpiFacts(filters, seedOf(t))
    spec.kpi = dim ? { value: spec.total, status: k.status, delta: k.delta } : k
  }
  return spec
}
// apply an answer for something the description didn't say
export function applyGroupBy(spec, dimId, text) {
  const dim = GROUP_DIMS.find((d) => d.id === dimId)
  if (!dim) return spec
  const next = resolveWidget(`${text} by ${dim.label}`, spec.kind)
  next.missing = []
  return next
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
