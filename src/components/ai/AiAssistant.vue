<script setup>
/**
 * AiAssistant — the ONE unified AI feature (solves Problems 1–4 in a single panel).
 *
 * A docked side panel (board stays in view — the Dynatrace Assist / Power BI Copilot
 * pattern). It opens with a proactive role-ranked summary (P1); a single input +
 * suggested prompts route to explain an anomaly (P3), investigate records + act (P2),
 * or build a widget from a description (P4). Every answer is grounded (aiEngine
 * computes; this only narrates), with editable chips, citations, "how calculated",
 * confidence, thumbs, and the on-prem/no-LLM note.
 */
import { ref, computed, nextTick, watch } from 'vue'
import Icon from '../ui/Icon.vue'
import ChartTile from '../dashboard/ChartTile.vue'
import { facts as computeFacts, confidence, anomalyFor, drillFor, drillNarrative, explainTile, statusUpdate, recoveryPlan, workOrder, changesSinceLastVisit, dashboardSummaryPoints, FRESHNESS } from '../../data/aiEngine.js'
import { routeIntent, tileFromText, factFromText, resolveWidget, applyGroupBy, explicitForm, proposeDashboard, GROUP_DIMS, SUGGESTIONS } from '../../data/aiAssistant.js'
import { useRouter, useRoute } from 'vue-router'
import { store, toast, createDashboard } from '../../store/index.js'
import { chart, kpi, shortcut } from '../../data/mock.js'

const props = defineProps({ board: Object, role: String, open: Boolean })
const emit = defineEmits(['update:open', 'role', 'cite'])
const router = useRouter()
const route = useRoute()

const thread = ref([])
const input = ref('')
const bodyEl = ref(null)
let bid = 0

function scrollDown() { nextTick(() => { if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight }) }

// ============================================================================
//  A realistic AI feel — every answer THINKS before it speaks, then the content
//  arrives progressively (streamed prose, revealed items) instead of appearing
//  all at once. The numbers are still deterministic (aiEngine); only the *timing
//  and delivery* are dramatised, exactly what a grounded on-prem model would do.
// ============================================================================
const prefersReduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
// grounded reasoning steps — narrate what the engine actually does for each intent
const THINK_STEPS = {
  summary: (n) => [`Reading ${n} widgets on this board`, 'Checking SLA, backlog and anomaly signals', 'Ranking what matters for your role'],
  drill: () => ['Finding the widget behind this signal', 'Pulling the records that match', 'Ranking them by urgency', 'Writing a plain-language briefing'],
  explain: () => ['Fetching this metric’s recent history', 'Computing the z-score against its baseline', 'Deciding whether it’s a real anomaly'],
  changes: () => ['Loading your last-visit snapshot', 'Diffing every metric since then', 'Sorting by what moved the most'],
  analyzing: (n) => [`Reading ${n} widgets`, 'Checking SLA, backlog and anomaly signals', 'Composing a plain-language summary'],
}
const THINK_LABEL = { summary: 'Analyzing what needs attention', drill: 'Investigating', explain: 'Explaining this metric', changes: 'Comparing with your last visit', analyzing: 'Analyzing this dashboard', status: 'Drafting a status update', plan: 'Building a recovery plan', worklist: 'Working out what comes first' }
const thinkLabel = (b) => THINK_LABEL[b.kind] || 'Thinking'
// only the reasoning steps that have started (so transition-group animates each in)
const shownSteps = (b) => (b.steps || []).filter((s) => s.state !== 'pending')

// step through the reasoning steps (pending → active → done), then run onDone
function runThinking(b, steps, onDone) {
  b.phase = 'thinking'
  b.steps = steps.map((t) => ({ text: t, state: 'pending' }))
  if (prefersReduced) { b.steps.forEach((s) => (s.state = 'done')); b.phase = 'done'; onDone && onDone(); scrollDown(); return }
  let i = 0
  const tick = () => {
    if (i >= b.steps.length) { b.phase = 'done'; scrollDown(); onDone && onDone(); return }
    b.steps[i].state = 'active'; scrollDown()
    setTimeout(() => { b.steps[i].state = 'done'; i += 1; setTimeout(tick, 130) }, 360 + Math.random() * 240)
  }
  setTimeout(tick, 240)
}
// reveal a string word-by-word into b[key]
function streamText(b, key, text, done) {
  if (prefersReduced) { b[key] = text; done && done(); return }
  const words = String(text).split(' ')
  b[key] = ''; let i = 0
  const step = () => {
    if (i >= words.length) { done && done(); return }
    b[key] += (i ? ' ' : '') + words[i]; i += 1; scrollDown()
    setTimeout(step, 22 + Math.random() * 44)
  }
  step()
}
// tick a reveal counter b[key] from 0 → total (staggered list reveal)
function revealItems(b, key, total, delay, done) {
  b[key] = 0
  if (prefersReduced) { b[key] = total; done && done(); return }
  const step = () => {
    if (b[key] >= total) { done && done(); return }
    b[key] += 1; scrollDown(); setTimeout(step, delay)
  }
  setTimeout(step, 140)
}

// ---- block builders ----
function pushUser(text) { thread.value.push({ id: ++bid, kind: 'user', text }); scrollDown() }
/* "Build me X" typed straight into the composer is the SAME job as the guided widget
 * step, so it goes down the same road: real resolver, real tile preview, one-click
 * placement. Two builders for one intent is how the two drift apart. */
function pushWidget(text) {
  draft.value = { ...draft.value, mode: 'widget', intent: text }
  const blk = push('cw-build', { phase: 'thinking', title: '', tile: null, spec: null, chips: [], cfg: null, settled: false })
  runThinking(blk, ['Reading what you want to show', 'Matching it to fields we can query', 'Configuring the widget'], () => {
    previewOrAsk(blk, text, explicitForm(text))
  })
}
// Spotlight the real tile on the dashboard (scroll + flash) instead of dumping a table.
function highlightWidget(fact) {
  const t = fact && props.board.tiles.find((x) => x.id === fact.tileId)
  store.ui.aiHighlight = t ? t.title : null
}

// P1 — what needs attention: think, then reveal each fact one at a time
function pushSummary() {
  const b = push('summary', { phase: 'thinking', facts: [], conf: 'high', shown: 0, settled: false })
  runThinking(b, THINK_STEPS.summary(props.board.tiles.length), () => {
    b.facts = computeFacts(props.board, props.role)
    b.conf = confidence(props.board)
    revealItems(b, 'shown', b.facts.length, 200, () => { b.settled = true })
  })
}
// P3 — explain: think, then STREAM the full reasoned answer line-by-line, then the extras.
// explainTile does the reasoning for ANY widget (KPI / chart / shortcut), so an "explain"
// about a chart actually breaks the chart down instead of reciting a neighbouring KPI.
function pushExplain(text) {
  const tile = tileFromText(props.board, text)
  const b = push('explain', { phase: 'thinking', tile, anomaly: null, lines: [], shownLines: [], cur: '', showExtras: false, settled: false })
  runThinking(b, THINK_STEPS.explain(), () => {
    const ex = explainTile(tile)
    b.anomaly = ex.anomaly
    b.lines = ex.lines
    highlightWidget({ tileId: tile.id })
    streamExplain(b, 0)
  })
}
function streamExplain(b, idx) {
  if (idx >= b.lines.length) { setTimeout(() => { b.showExtras = true; b.settled = true; scrollDown() }, 200); return }
  streamText(b, 'cur', b.lines[idx], () => {
    b.shownLines.push(b.lines[idx]); b.cur = ''
    setTimeout(() => streamExplain(b, idx + 1), 140)
  })
}
// P2 — investigate: think, spotlight the widget, STREAM the briefing line-by-line.
// The "what next" belongs to the contextual Follow-ups below, so there's no separate
// suggested-actions block here (it duplicated what the follow-ups already offer).
function pushDrill(text, factObj) {
  const fact = factObj || factFromText(props.board, text)
  const b = push('drill', { phase: 'thinking', fact, widget: '', showSpot: false, shownLines: [], cur: '', lines: [], settled: false })
  runThinking(b, THINK_STEPS.drill(), () => {
    const drill = drillFor(props.board, fact)
    b.widget = props.board.tiles.find((x) => x.id === fact.tileId)?.title || drill.sourceTitle
    b.lines = drillNarrative(props.board, fact)
    highlightWidget(fact)
    setTimeout(() => { b.showSpot = true; scrollDown(); streamLines(b, 0) }, 240)
  })
}
function streamLines(b, idx) {
  if (idx >= b.lines.length) { b.settled = true; scrollDown(); return }
  streamText(b, 'cur', b.lines[idx], () => {
    b.shownLines.push(b.lines[idx]); b.cur = ''
    setTimeout(() => streamLines(b, idx + 1), 150)
  })
}
// what changed: think, then reveal the change cards one at a time
function pushChanges() {
  const b = push('changes', { phase: 'thinking', data: null, shown: 0, settled: false })
  runThinking(b, THINK_STEPS.changes(), () => {
    b.data = changesSinceLastVisit(props.board)
    revealItems(b, 'shown', b.data.items.length, 160, () => { b.settled = true })
  })
}
// "Draft a status update" — a copy-ready update, streamed like prose
function pushStatus() {
  const b = push('status', { phase: 'thinking', data: null, lines: [], shownLines: [], cur: '', settled: false })
  runThinking(b, ['Reading what needs attention', 'Checking the worklist', 'Drafting the update'], () => {
    b.data = statusUpdate(props.board, props.role)
    b.lines = b.data.body
    streamStatus(b, 0)
  })
}
function streamStatus(b, i) {
  if (i >= b.lines.length) { b.settled = true; scrollDown(); return }
  streamText(b, 'cur', b.lines[i], () => {
    b.shownLines.push(b.lines[i]); b.cur = ''
    setTimeout(() => streamStatus(b, i + 1), 150)
  })
}
// "Turn this into a recovery plan" — ordered steps revealed one at a time
function pushPlan() {
  const b = push('plan', { phase: 'thinking', data: null, shown: 0, settled: false })
  runThinking(b, ['Reading the signals', 'Ordering the work by deadline', 'Writing the plan'], () => {
    b.data = recoveryPlan(props.board, props.role)
    revealItems(b, 'shown', b.data.steps.length, 240, () => { b.settled = true })
  })
}
// "What should I work on first?" — a ranked queue
function pushWorkOrder() {
  const b = push('worklist', { phase: 'thinking', items: [], shown: 0, settled: false })
  runThinking(b, ['Ranking by deadline and impact', 'Checking what’s already owned', 'Ordering your queue'], () => {
    b.items = workOrder(props.board, props.role)
    revealItems(b, 'shown', b.items.length, 220, () => { b.settled = true })
  })
}

// Summarize / Ask: think, then the grouped written summary
function pushAnalyzing() {
  const b = push('analyzing', { phase: 'thinking', points: [], settled: false })
  runThinking(b, THINK_STEPS.analyzing(props.board.tiles.length), () => {
    b.points = dashboardSummaryPoints(props.board, props.role)
    b.settled = true
  })
}
// a short templated reply for actions we don't fully simulate (edit / schedule)
function pushNote(text) {
  const edit = /edit|change|rename|group|type/i.test(text)
  const reply = edit
    ? 'You can edit any widget from its ⋯ menu — chart type, filters or grouping. Tell me which widget and what to change, and I’ll walk you through it.'
    : 'I can set that up — scheduled digests and threshold alerts run on-prem. Confirm the cadence (daily / weekly) and I’ll draft it.'
  thread.value.push({ id: ++bid, kind: 'note', text: reply }); scrollDown()
}
// ---- P4 conversational CREATE flow (Generate with AI) ----
const draft = ref({})
// which create-flow step is waiting on the main composer (no inline inputs — the
// user always writes in the one field at the bottom, guided by what the AI just said)
const awaiting = ref(null)
function push(kind, extra = {}) { thread.value.push({ id: ++bid, kind, ...extra }); scrollDown(); return thread.value[thread.value.length - 1] }
const VIS = [{ v: 'public', label: 'Public — everyone' }, { v: 'private', label: 'Private — just me' }, { v: 'restricted', label: 'Restricted — chosen people' }]
const otherBoards = () => store.dashboards.filter((d) => !d.archived)

function pushCreateStart() {
  // Generate-with-AI leads with the create flow — drop a lone auto-summary/preamble.
  if (thread.value.every((b) => b.kind === 'summary' || b.kind === 'user')) thread.value = []
  draft.value = {}; push('create-start')
}
function openBoard(d) { emit('update:open', false); router.push(`/dashboard/${d.id}`) }

/* ============ AI-guided creation ============================================
 * The user states an INTENT in their own words; the AI drafts from it, names it
 * if they didn't, then asks only the two things it genuinely cannot infer
 * (category, visibility) as numbered question cards. Nothing else blocks them. */
// Presented in the same full-width option style as the panel's greeting, because
// this is the user's first encounter with the creation flow and the options need
// to read as the primary way in — not as afterthought chips.
const DASH_STARTERS = [
  { label: 'A service-desk board for SLA breaches and overdue work', icon: 'flag' },
  { label: 'An executive view of backlog, MTTR and CSAT', icon: 'auto-graph' },
  { label: 'A NOC wallboard for network and asset health', icon: 'layout' },
]
const WIDGET_STARTERS = [
  { label: 'SLA breaches this week by team', icon: 'chart-bar' },
  { label: 'Backlog trend over the last 6 months', icon: 'chart-line' },
  { label: 'Open tickets by priority', icon: 'chart-donut' },
]
/* "Write the prompt for me" — rather than dumping a blank template, the AI states
 * what it needs to know and offers a few ANGLES; picking one writes the whole prompt. */
const PROMPT_HELP = {
  dash: {
    intro: 'Happy to write it. A good dashboard prompt answers five things — pick the angle you think in and I’ll write the whole prompt for you.',
    needs: ['Who is it for?', 'What question should it answer every morning?', 'Which 3–4 numbers matter?', 'Over what time window?', 'What should it flag?'],
    approaches: [
      { id: 'role', title: 'Start from a role', body: 'I’ll write it around a persona — an L1 technician, a team lead or an executive.' },
      { id: 'question', title: 'Start from a question', body: 'I’ll write it around the one thing you want answered at the start of each shift.' },
      { id: 'metrics', title: 'Start from the metrics', body: 'I’ll write it around the numbers you already check every day.' },
    ],
    prompts: {
      role: 'Build a dashboard for an L1 service-desk technician who starts their shift by checking what is at risk. Track overdue requests, requests due in the next 24 hours, unassigned work and urgent open requests, broken down by priority and technician, over the last 7 days. Flag anything breaching SLA today.',
      question: 'Build a dashboard that answers “what will breach SLA today, and who is on it?”. Track SLA-breaching and due-soon requests grouped by priority and assignee, over today and the last 7 days. Flag anything that has no owner.',
      metrics: 'Build a dashboard tracking open requests, overdue requests, average resolution time and CSAT, broken down by team and priority, over the last 30 days. Flag any metric that breaks out of its normal range.',
    },
  },
  widget: {
    intro: 'Happy to write it. A widget prompt needs four things — pick how you want to frame it and I’ll write the whole prompt.',
    needs: ['What are we measuring?', 'Grouped by which field?', 'Over what time window?', 'What threshold matters?'],
    approaches: [
      { id: 'compare', title: 'Compare across groups', body: 'One measure split by team, priority or status — best read as a column chart.' },
      { id: 'trend', title: 'Track it over time', body: 'One measure across months or days — best read as a line.' },
      { id: 'share', title: 'Show the share of a whole', body: 'How a total splits across a handful of categories — best read as a doughnut.' },
    ],
    prompts: {
      compare: 'Show the count of SLA-breaching requests grouped by team, over this week, as a column chart. Highlight any team above 5.',
      trend: 'Show open request volume over the last 6 months as a line chart, so I can see whether the backlog is growing.',
      share: 'Show open requests grouped by priority as a doughnut, so I can see the urgent share at a glance.',
    },
  },
}

// name the board from the intent — honouring an explicit "called X", else choosing one
function nameFromIntent(text) {
  const explicit = text.match(/\b(?:called|named|titled)\s+["“']?([^"”'\n.]{2,40})/i)
  if (explicit) return { name: explicit[1].trim(), ours: false }
  const t = text.toLowerCase()
  const hit = (re, n) => (re.test(t) ? n : null)
  const name = hit(/exec|leadership|cxo|board level/, 'Executive Overview')
    || hit(/noc|network|wallboard|uptime/, 'Network Operations')
    || hit(/asset|patch|hardware|inventory|vulnerab/, 'Asset & Patch Health')
    || hit(/sla|breach|overdue/, 'SLA & Overdue Watch')
    || hit(/change|release|deploy/, 'Change & Release')
    || hit(/csat|satisfaction|feedback|quality/, 'Service Quality')
    || hit(/backlog|volume|trend/, 'Backlog & Volume')
    || 'Service Desk Overview'
  return { name, ours: true }
}
function categoryFromIntent(text) {
  const t = text.toLowerCase()
  if (/exec|leadership|cxo/.test(t)) return 'Leadership'
  if (/noc|network|uptime/.test(t)) return 'NOC'
  if (/asset|patch|hardware|vulnerab/.test(t)) return 'Assets'
  return 'Service Desk'
}
// what the AI says it put on the board — grounded in the words the user used
function planFromIntent(text) {
  const t = text.toLowerCase()
  const plan = []
  if (/sla|breach|overdue/.test(t)) plan.push('Counters for overdue, due-soon and SLA-breaching requests')
  if (/backlog|volume|trend/.test(t)) plan.push('A backlog trend line over the selected window')
  if (/priorit|urgent|p1/.test(t)) plan.push('A priority breakdown so the urgent share is visible')
  if (/team|technician|assign/.test(t)) plan.push('Load by team/technician, ranked')
  if (/csat|satisfaction|mttr/.test(t)) plan.push('MTTR and CSAT headline numbers')
  if (/asset|patch|hardware|vulnerab/.test(t)) plan.push('Patch and asset health counters')
  if (/status/.test(t)) plan.push('A status split of open work')
  if (!plan.length) plan.push('Headline counters for open, overdue and unassigned work', 'A status and priority breakdown', 'Your worklist of records to action')
  plan.push('A worklist so the records are one click away')
  return [...new Set(plan)].slice(0, 4)
}

// ---- dashboard flow ----
function focusComposer() { nextTick(() => inputEl.value?.focus()) }
function startDash() { draft.value = { mode: 'dash' }; push('cd-intent'); awaiting.value = 'dash-intent'; focusComposer() }
function askPromptHelp(which) { push('prompt-help', { which, ...PROMPT_HELP[which] }) }
function writePrompt(b, ap) { input.value = PROMPT_HELP[b.which].prompts[ap.id]; focusComposer() }
function useDashPrompt() { askPromptHelp('dash') }
/* The fast path: read the intent once and propose the WHOLE board, so it can be
 * accepted in a single click instead of described a widget at a time. */
function dashIntent(text, variant = 0) {
  const t = (text || '').trim(); if (!t) return
  awaiting.value = null
  if (!variant) pushUser(t)
  const nm = nameFromIntent(t)
  draft.value = { ...draft.value, mode: 'dash', intent: t, name: nm.name, namedByAi: nm.ours, variant }
  const blk = push('cd-proposal', { phase: 'thinking', name: '', proposal: null, namedByAi: false, settled: false })
  runThinking(blk, ['Reading the intent behind it', 'Choosing the widgets that answer it', 'Laying out the board'], () => {
    const p = proposeDashboard(t, variant)
    draft.value.category = p.category
    draft.value.proposal = p
    blk.name = draft.value.name
    blk.namedByAi = draft.value.namedByAi
    blk.proposal = p
    blk.settled = true
    awaiting.value = 'dash-refine'   // typing still refines it
  })
}
function regenerate(b) {
  const next = ((draft.value.variant || 0) + 1) % 6
  pushUser('Regenerate')
  dashIntent(draft.value.intent, next)
}
// accept the proposal: create the board (if needed) and place every widget at once
function acceptProposal(b, target) {
  awaiting.value = null
  const p = b.proposal
  const d = target === 'current'
    ? props.board
    : createDashboard({ name: draft.value.name, access: 'private', category: draft.value.category, description: draft.value.intent })
  draft.value.dash = d
  draft.value.built = []
  const blk = push('cd-placed', { phase: 'thinking', dash: d, count: p.widgets.length, madeBoard: target !== 'current', settled: false })
  runThinking(blk, [`Building ${p.widgets.length} widgets`, 'Applying conditions and grouping', 'Placing them on the board'], () => {
    p.widgets.forEach((w) => {
      const tile = tileFromSpec(w.spec, w.text)
      d.tiles.push(tile)
      draft.value.built.push(tile)
    })
    d.updated = new Date().toISOString()
    blk.settled = true
    toast(`Added ${p.widgets.length} widgets to ${d.name}`, 'success')
    // take them straight to it — seeing the board IS the confirmation
    setTimeout(() => {
      if (route.params.id !== d.id) router.push(`/dashboard/${d.id}`)
      setTimeout(() => push('cd-recap', { dash: d, built: [...draft.value.built] }), 500)
    }, 600)
  })
}
// the user wants to refine before we commit
function refineDash(text) { const t = (text || '').trim(); if (!t) return; dashIntent(`${draft.value.intent}. Also: ${t}`) }
/* Approving the draft doesn't jump to the admin questions — most people came here to
 * BUILD something. Create the board now (with defaults) so widgets can be placed into
 * it and we can navigate to it; category and visibility are asked at the very end. */
function continueDash() {
  awaiting.value = null
  const d = createDashboard({
    name: draft.value.name, access: 'private', category: '',
    description: draft.value.intent || 'Created with ServiceOps AI',
  })
  draft.value.dash = d
  draft.value.built = []
  push('cd-widgets')
  awaiting.value = 'dash-widget'
  focusComposer()
}

// the widget vocabulary we offer — shown as a small palette, and clickable to hint a type
const WIDGET_TYPES = [
  { id: 'bar', label: 'Column', hint: 'Compare across groups' },
  { id: 'hbar', label: 'Bar', hint: 'Long category names' },
  { id: 'line', label: 'Line', hint: 'Trend over time' },
  { id: 'donut', label: 'Doughnut', hint: 'Share of a whole' },
  { id: 'kpi', label: 'KPI', hint: 'One headline number' },
  { id: 'shortcut', label: 'Shortcut', hint: 'Records as a table', icon: 'table' },
]
function preferType(id) { draft.value.preferKind = draft.value.preferKind === id ? null : id }

/* A record list must obey its own conditions. Showing an "Urgent / In Progress" row
 * under a list titled "Unassigned High-priority" is the kind of mismatch that makes
 * the whole preview untrustworthy, so the rows are filtered by the Status/Priority
 * chips and only relabelled if nothing in the pool qualifies. */
const RECORD_POOL = [
  ['VPN down for finance team', 'Arnav Desai', 'In Progress', 'Urgent'],
  ['Email delivery delayed', 'Sarah Chen', 'Open', 'High'],
  ['Payroll app 500 error', 'Neha Gupta', 'In Progress', 'High'],
  ['SSO login failing for HR', 'Rahul Shukla', 'Open', 'Medium'],
  ['Printer offline — 3rd floor', 'Divya Menon', 'Pending', 'Low'],
  ['Laptop won’t boot after update', 'Karan Mehta', 'Open', 'High'],
  ['Shared drive permissions', 'Ishita Rao', 'Pending', 'Medium'],
  ['CRM sync failing overnight', 'Ananya Iyer', 'In Progress', 'Urgent'],
]
function recordRows(spec) {
  const chip = (f) => (spec.chips || []).find((c) => c.field === f)?.value
  const status = chip('Status')
  const priority = chip('Priority')
  let rows = RECORD_POOL.filter((r) => (!status || r[2] === status) && (!priority || r[3] === priority))
  // nothing in the pool matches → take the first few and make them obey the conditions
  if (rows.length < 3) {
    rows = RECORD_POOL.slice(0, 4).map((r) => [r[0], r[1], status || r[2], priority || r[3]])
  }
  return rows.slice(0, 4)
}
// turn a resolved spec into a real tile of the right form
function tileFromSpec(spec, text) {
  let tile
  if (spec.kind === 'kpi') {
    const k = spec.kpi || { value: spec.total || 128, status: 'warn', delta: { dir: 'up', pct: 6 } }
    tile = kpi(spec.title, k.value, '', k.delta, k.status, text)
  } else if (spec.kind === 'shortcut') {
    tile = shortcut(spec.title, ['Subject', 'Requester', 'Status', 'Priority'], recordRows(spec), text)
  } else {
    tile = chart(spec.title, { ...spec.chart, kind: spec.kind }, text)
  }
  tile.prov = 'user'
  tile._chips = spec.chips || []
  return tile
}
/* "Add three widgets: X, Y and Z" should build three. Only split on separators the
 * user clearly meant as a list — a bare "and" is far more often part of one phrase
 * ("SLA breaches and overdue work") than a list boundary, so it's only trusted when
 * a count was stated. */
const NUM_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 }
function statedCount(text) {
  const d = text.match(/\b(\d+)\s+(?:more\s+)?(widgets?|kpis?|charts?|shortcuts?|tiles?)\b/i)
  if (d) return Math.min(parseInt(d[1], 10), 8)
  const w = text.match(/\b(two|three|four|five|six|seven|eight)\s+(?:more\s+)?(?:widgets?|kpis?|charts?|shortcuts?|tiles?)\b/i)
  return w ? NUM_WORDS[w[1].toLowerCase()] : null
}
function isDescriptive(s) {
  const t = s.trim().toLowerCase()
  if (t.length < 6) return false
  return !/^(widgets?|kpis?|charts?|shortcuts?|tiles?|please|thanks|them|those|these)$/.test(t)
}
function splitWidgetRequests(text) {
  // drop a leading "create 3 widgets:" style preamble
  const body = String(text).replace(
    /^\s*(?:please\s+)?(?:can you\s+)?(?:create|add|build|make|generate|put)\s+(?:me\s+)?(?:\d+|a|an|some|a few|two|three|four|five|six|seven|eight)?\s*(?:more\s+)?(?:widgets?|kpis?|charts?|shortcuts?|tiles?)?\s*(?:that|which|for|showing|to show|:|—|-)?\s*/i, '')
  const strong = /\s*(?:\r?\n+|;|•|•|\s\d+[.)]\s+)\s*/
  let parts = body.split(strong)
  // a stated count licenses comma / "and" splitting too
  if (parts.length < 2 && statedCount(text)) parts = body.split(/\s*,\s*and\s+|\s*,\s*|\s+and\s+/i)
  parts = parts.map((s) => s.trim().replace(/^[-–—]\s*/, '')).filter(isDescriptive)
  return parts.length ? parts : (isDescriptive(body) ? [body.trim()] : [])
}

// build one or many widgets straight into the new board
function dashWidget(text) {
  const t = (text || '').trim(); if (!t) return
  awaiting.value = null
  pushUser(t)
  const want = statedCount(t)
  const items = splitWidgetRequests(t)
  // asked for widgets but never said what they should show → ask rather than guess
  if (!items.length) {
    push('cd-need', { want: want || 1, have: 0 })
    awaiting.value = 'dash-widget'; focusComposer(); return
  }
  // "add 4 KPIs: a, b, c, d" names the form ONCE, in the preamble the splitter
  // removes — so carry it across the whole batch unless an item overrides it.
  draft.value.batchForm = explicitForm(t)
  buildWidgetQueue(items, 0, want && want > items.length ? want - items.length : 0)
}
// item's own wording wins, then the batch preamble, then the palette hint
function formFor(item) {
  return explicitForm(item) || draft.value.batchForm || draft.value.preferKind || null
}
function buildWidgetQueue(list, i, shortBy) {
  if (i >= list.length) {
    // built what was clear; now ask for whatever they counted but didn't describe
    if (shortBy > 0) push('cd-need', { want: shortBy, have: list.length, partial: true })
    awaiting.value = 'dash-widget'
    return
  }
  const spec = resolveWidget(list[i], formFor(list[i]))
  // it can't invent a grouping — pause the queue and ask, then resume
  if (spec.missing.length) {
    draft.value.pending = { list, i, shortBy, text: list[i], spec }
    askGroupBy(spec, list.length > 1 ? `${i + 1} of ${list.length}` : '')
    return
  }
  placeWidget(spec, list[i], list, i, shortBy)
}
function placeWidget(spec, text, list, i, shortBy) {
  const blk = push('cd-widget', {
    phase: 'thinking', tile: null, cfg: null, settled: false,
    idx: i + 1, total: list.length, last: i === list.length - 1 && shortBy === 0,
  })
  runThinking(blk, ['Reading what you want to show', 'Choosing the clearest way to draw it', 'Configuring and placing it'], () => {
    const tile = tileFromSpec(spec, text)
    const d = draft.value.dash
    d.tiles.push(tile); d.updated = new Date().toISOString()
    draft.value.built.push(tile)
    blk.tile = tile
    blk.cfg = tile.type === 'chart' ? configLines({ title: tile.title, chart: tile.chart, chips: tile._chips }) : null
    blk.settled = true
    setTimeout(() => buildWidgetQueue(list, i + 1, shortBy), 400)
  })
}
// the one thing a description often leaves out: what to group by
function askGroupBy(spec, progress) {
  awaiting.value = null
  push('ask', {
    askId: 'wgroup', step: 1, total: 1, other: '',
    q: `How should I group “${spec.title}”?`,
    sub: `That's the one thing I can't read from your description${progress ? ` · widget ${progress}` : ''}.`,
    options: GROUP_DIMS.slice(0, 6).map((d) => ({ label: `By ${d.label.toLowerCase()}`, value: d.id })),
    otherPh: 'Or name another field…', skippable: false,
  })
}
function moreWidgets() { awaiting.value = 'dash-widget'; focusComposer() }
// take them TO the board so they can see what was built, keeping the panel open
function finishWidgets() {
  awaiting.value = null
  const d = draft.value.dash
  if (d && route.params.id !== d.id) router.push(`/dashboard/${d.id}`)
  setTimeout(() => push('cd-recap', { dash: d, built: [...(draft.value.built || [])] }), 450)
}
function confirmRecap() { awaiting.value = null; askCategory() }
function changeRecap() { awaiting.value = 'dash-widget'; focusComposer() }

function askCategory() {
  awaiting.value = null
  const cats = (store.categories || []).filter(Boolean).slice(0, 4)
  push('ask', {
    askId: 'cat', step: 1, total: 2, other: '',
    q: 'Which category should this dashboard live in?',
    sub: 'Pick an existing one, or type a new category to create it.',
    options: cats.map((c) => ({ label: c, value: c })),
    otherPh: 'Create a new category…', skippable: true,
  })
}
function askVisibility() {
  awaiting.value = null
  push('ask', {
    askId: 'vis', step: 2, total: 2, other: '',
    q: 'Who should be able to see it?',
    sub: 'This is the last thing I need — then I’ll build it.',
    options: VIS.map((v) => ({ label: v.label, value: v.v })),
    otherPh: '', skippable: true,
  })
}
// The board already exists (created when the draft was approved) — this applies the
// two answers to it and closes the flow out.
function finishDashboard() {
  const d = draft.value.dash
  d.category = draft.value.category === '__skip' ? '' : draft.value.category
  d.access = draft.value.access || 'private'
  d.updated = new Date().toISOString()
  const n = (draft.value.built || []).length
  const blk = push('cd-done', { phase: 'thinking', dash: null, namedByAi: draft.value.namedByAi, built: n, settled: false })
  runThinking(blk, ['Applying category and visibility', 'Finishing up'], () => {
    blk.dash = d; blk.settled = true
    setTimeout(() => pushNextSteps(
      n
        ? `“${d.name}” is built and live with ${n} widget${n === 1 ? '' : 's'} on it.`
        : `“${d.name}” is live — it just doesn’t have any widgets yet.`,
      [
        { title: n ? 'Add another widget' : 'Add a widget', body: 'Describe what it should show and I’ll build and place it.', run: 'addwidget' },
        { title: 'Share it with your team', body: `It’s currently ${d.access}. I can open it up to a group or specific technicians.`, run: 'share' },
        { title: 'Schedule a digest', body: 'Email a snapshot of this board on a daily or weekly cadence.', run: 'schedule' },
      ],
    ), 700)
  })
}

/* Numbered next steps — written as prose, offered ONLY after a task that genuinely
 * leaves a decision open. Informational answers (a summary, an explanation) don't
 * get one; they keep their lighter contextual follow-ups instead. */
function pushNextSteps(intro, steps) { push('nextsteps', { intro, steps }) }
function runNextStep(s) {
  if (s.run === 'addwidget' || s.run === 'another') { pushUser(s.title); startWidget(); return }
  if (s.run === 'open') { openBoard(draft.value.targetBoard || draft.value.dash); return }
  if (s.run === 'recast') { pushUser(s.title); pushNote('Change a chart’s type'); return }
  pushUser(s.title); pushNote(s.run === 'schedule' ? 'Schedule a daily summary' : 'Share this dashboard')
}

// ---- widget flow (same shape, reachable on its own or straight after a board) ----
function startWidget() { draft.value = { ...draft.value, mode: 'widget' }; push('cw-intent'); awaiting.value = 'widget-intent'; focusComposer() }
function useWidgetPrompt() { askPromptHelp('widget') }
// The AI builds ONE widget from the description. Chart type is left as a light
// preference (minimal pills that repaint the preview) — everything else it decides.
/* The inline switch row under the preview. Every form the module supports is here —
 * a KPI and a record list are as much "a different way to draw this" as Bar vs Line,
 * so making them a switch (rather than a re-ask) is what keeps the flow one step. */
const WIDGET_KINDS = [
  { id: 'bar', label: 'Column' }, { id: 'hbar', label: 'Bar' },
  { id: 'line', label: 'Line' }, { id: 'donut', label: 'Doughnut' },
  { id: 'kpi', label: 'KPI' }, { id: 'shortcut', label: 'Table' },
]
const VIZ_WORD = { bar: 'Column chart', hbar: 'Bar chart', line: 'Line chart', donut: 'Doughnut chart', kpi: 'KPI', shortcut: 'Record list' }
// resolve → real tile, so the preview in chat is the very thing that lands on the board
function applyPreview(blk, spec, text) {
  blk.spec = spec
  blk.title = spec.title
  blk.module = spec.module || 'Requests'
  blk.chips = spec.chips || []
  blk.tile = tileFromSpec(spec, text)
  blk.cfg = configLines({ title: spec.title, chart: { kind: spec.kind, labels: spec.chart?.labels }, chips: spec.chips || [] })
  blk.settled = true
}
function widgetIntent(text) {
  const t = (text || '').trim(); if (!t) return
  awaiting.value = null
  pushUser(t)
  draft.value.intent = t
  const blk = push('cw-build', { phase: 'thinking', title: '', tile: null, spec: null, chips: [], cfg: null, settled: false })
  runThinking(blk, ['Reading what you want to show', 'Matching it to fields we can query', 'Configuring the widget'], () => {
    previewOrAsk(blk, t, explicitForm(t))
  })
}
/* Same rule as the dashboard flow: build without interruption when the description is
 * complete, and ask ONLY for the grouping, which is the one field a description
 * reliably omits and the AI cannot reasonably guess. */
function previewOrAsk(blk, text, form) {
  const spec = resolveWidget(text, form)
  if (spec.missing.length) {
    draft.value.pending = { mode: 'widget', blk, text, spec }
    askGroupBy(spec, '')
    return
  }
  applyPreview(blk, spec, text)
}
// switching form re-resolves rather than re-skinning — a KPI of a grouped query is a
// different query, and pretending otherwise is how a preview stops matching the board
function setBuildKind(b, id) {
  if (b.spec?.kind === id) return
  previewOrAsk(b, draft.value.intent || b.title, id)
}
function changeWidget() { awaiting.value = 'widget-refine'; focusComposer() }
function refineWidget(text) { const t = (text || '').trim(); if (!t) return; widgetIntent(`${draft.value.intent}. ${t}`) }
/* Almost everyone wants the widget on the board they're already looking at, so that
 * is a BUTTON, not a question — one click from preview to placed. "A new dashboard"
 * stays available beside it and is the only branch that still needs to be asked. */
function confirmWidget(b, target) {
  draft.value.build = { title: b.title, spec: b.spec, chips: b.chips || [] }
  if (target === 'new') { awaiting.value = 'newboard-name'; push('cw-newboard'); focusComposer(); return }
  awaiting.value = null
  draft.value.targetBoard = currentBoard()
  addTheWidget()
}
function currentBoard() { return draft.value.dash || props.board }
/* Spell the configuration back, so "added" is verifiable rather than a claim. Each
 * form is described as what it actually does — a record list doesn't count or group
 * anything, and a KPI has nothing to group BY, so neither should claim it. */
function configLines(build) {
  const chips = build.chips || []
  const kind = build.chart.kind
  const val = (f) => chips.find((c) => new RegExp(f, 'i').test(c.field))?.value
  const filters = chips.filter((c) => !/^group by$/i.test(c.field))
  const matching = filters.length ? ' matching the conditions below' : ''
  const groupBy = kind === 'kpi' || kind === 'shortcut'
    ? null
    : val('group by') || (build.chart.labels?.length ? 'the categories on its axis' : null)
  const out = [
    { k: 'Source', v: val('module') || 'Requests' },
    {
      k: kind === 'shortcut' ? 'Shows' : 'Measure',
      v: kind === 'shortcut' ? `The records themselves${matching}` : `Count of records${matching}`,
    },
    groupBy ? { k: 'Grouped by', v: groupBy } : null,
    kind === 'shortcut' ? { k: 'Columns', v: 'Subject, Requester, Status, Priority' } : null,
    { k: 'Window', v: val('created date') || 'the dashboard time filter' },
    { k: 'Drawn as', v: VIZ_WORD[kind] || kind },
  ].filter(Boolean)
  return { rows: out, filters }
}
// turn the built spec into a real tile on the chosen board — whatever form it is
function addTheWidget() {
  const d = draft.value.targetBoard || draft.value.dash
  const bld = draft.value.build
  const tile = tileFromSpec(bld.spec, draft.value.intent)
  d.tiles.push(tile); d.updated = new Date().toISOString()
  const cfg = configLines({ ...bld, chart: { kind: bld.spec.kind, labels: bld.spec.chart?.labels } })
  const blk = push('cw-done', { phase: 'thinking', tile: null, dash: d, cfg: null, settled: false })
  runThinking(blk, ['Applying the conditions', 'Configuring the widget', 'Placing it on the board'], () => {
    blk.tile = tile; blk.cfg = cfg; blk.settled = true
    toast(`Added “${tile.title}” to ${d.name}`, 'success')
    setTimeout(() => pushNextSteps(
      `That’s “${tile.title}” on “${d.name}” — the preview above is exactly how it renders on the board.`,
      [
        { title: 'Add another widget', body: 'Keep building the board out while the context is fresh.', run: 'another' },
        { title: 'Change how it’s drawn', body: 'Switch it between a chart, a KPI or a record list.', run: 'recast' },
        { title: 'Open the dashboard', body: 'See it in place alongside the other widgets.', run: 'open' },
      ],
    ), 700)
  })
}

// ---- one handler for every question card ----
function answerAsk(b, opt, custom) {
  const val = custom === '__skip' ? '__skip' : (opt ? opt.value : (custom || '').trim())
  if (!val) return
  b.answered = custom === '__skip' ? 'Skipped' : (opt ? opt.label : custom)
  pushUser(b.answered)
  if (b.askId === 'cat') { draft.value.category = val === '__skip' ? '' : val; setTimeout(askVisibility, 350); return }
  if (b.askId === 'vis') { draft.value.access = val === '__skip' ? 'private' : val; setTimeout(finishDashboard, 400); return }
  if (b.askId === 'wgroup') {
    const p = draft.value.pending
    if (!p) return
    draft.value.pending = null
    const dim = GROUP_DIMS.find((d) => d.id === val) || GROUP_DIMS.find((d) => d.label.toLowerCase() === String(val).toLowerCase())
    const spec = dim ? applyGroupBy(p.spec, dim.id, p.text) : { ...p.spec, missing: [] }
    // the single-widget flow answers back into its own preview; the batch resumes its queue
    if (p.mode === 'widget') setTimeout(() => applyPreview(p.blk, spec, p.text), 350)
    else setTimeout(() => placeWidget(spec, p.text, p.list, p.i, p.shortBy), 350)
    return
  }
  if (b.askId === 'wdash') {
    // "a new dashboard" with no name yet → ask for the name in the composer
    if (val === '__new') { awaiting.value = 'newboard-name'; focusComposer(); setTimeout(() => push('cw-newboard'), 250); return }
    let target = store.dashboards.find((d) => d.id === val)
    // typed a name rather than picking → create that dashboard and use it
    if (!target) target = makeBoardFor(b.answered)
    draft.value.targetBoard = target
    setTimeout(addTheWidget, 350)
  }
}
// create the board the widget is about to land on
function makeBoardFor(name) {
  const d = createDashboard({ name: (name || '').trim() || 'New dashboard', access: 'private', category: '', description: 'Created with ServiceOps AI' })
  draft.value.dash = d
  draft.value.createdBoard = true
  return d
}
function newBoardNamed(text) {
  const t = (text || '').trim(); if (!t) return
  awaiting.value = null
  pushUser(t)
  draft.value.targetBoard = makeBoardFor(t)
  setTimeout(addTheWidget, 350)
}

function dispatch(intent, text) {
  if (intent === 'summary') pushSummary()
  else if (intent === 'explain') pushExplain(text)
  else if (intent === 'drill') pushDrill(text)
  else if (intent === 'create') pushWidget(text)
  else if (intent === 'changes') pushChanges()
  else if (intent === 'analyzing') pushAnalyzing()
  else if (intent === 'createstart') pushCreateStart()
  else if (intent === 'status') pushStatus()
  else if (intent === 'plan') pushPlan()
  else if (intent === 'worklist') pushWorkOrder()
  else if (intent === 'note') pushNote(text)
}

// ---- contextual Follow ups (change with the block / what the user asked) ----
const CREATE_FLOW_KINDS = ['create-start', 'cd-intent', 'cd-draft', 'cd-proposal', 'cd-placed', 'cd-widgets', 'cd-widget', 'cd-need', 'cd-recap', 'cd-done', 'cw-intent', 'cw-build', 'cw-newboard', 'cw-done', 'ask', 'nextsteps', 'prompt-help']
/* Follow-ups are for answers that INVITE a next question — a summary, a diff, an
 * explanation, an investigation. A templated note or a generated widget already
 * ends with its own actions, so piling generic follow-ups underneath is noise. */
const FOLLOWUP_KINDS = ['summary', 'changes', 'analyzing', 'explain', 'drill', 'status', 'plan', 'worklist']
function isAnswer(b) {
  if (!FOLLOWUP_KINDS.includes(b.kind)) return false
  if (b.phase && b.phase !== 'done') return false   // still thinking
  if (b.settled === false) return false              // still streaming/revealing
  return true
}
/* Feedback sits under a finished ANSWER, never under a question or a prompt that's
 * still waiting on the user — rating something you haven't been told yet is noise. */
const NO_FEEDBACK = ['user', 'ask', 'create-start', 'cd-intent', 'cw-intent', 'cd-widgets', 'cw-newboard', 'cd-need']
function hasFeedback(b) {
  if (NO_FEEDBACK.includes(b.kind)) return false
  if (b.phase && b.phase !== 'done') return false
  if (b.settled === false) return false
  return true
}
// the readable text of a block, for Copy
function blockText(b) {
  if (b.shownLines?.length || b.cur) return [...(b.shownLines || []), b.cur].filter(Boolean).join('\n')
  if (b.points?.length) return b.points.map((g) => `${g.title}\n${g.points.map((p) => `- ${p}`).join('\n')}`).join('\n\n')
  if (b.facts?.length) return b.facts.map((f) => `- ${f.text} (${f.chip})`).join('\n')
  if (b.data?.items) return b.data.items.map((i) => `- ${i.widget}: ${i.delta}, now ${i.value}`).join('\n')
  if (b.kind === 'nextsteps') return [b.intro, ...b.steps.map((s, i) => `${i + 1}. ${s.title} — ${s.body}`)].join('\n')
  if (b.kind === 'cd-draft') return [`${b.name}`, ...(b.plan || []).map((p) => `- ${p}`)].join('\n')
  if (b.kind === 'cd-recap') return `${b.dash.name}\n${b.built.map((t) => `- ${t.title}`).join('\n')}`
  if (b.tile) return b.tile.title
  if (b.dash) return b.dash.name
  return b.text || ''
}
function rate(b, v) {
  b.rated = b.rated === v ? null : v
  if (b.rated) toast(v === 'up' ? 'Thanks — noted for this answer' : 'Thanks — I’ll take that into account', v === 'up' ? 'success' : 'warn')
}
function copyBlock(b) {
  const t = blockText(b)
  if (!t) return
  navigator.clipboard?.writeText(t)
  b.copied = true
  setTimeout(() => { b.copied = false }, 1600)
  toast('Copied to clipboard', 'success')
}

function followUpsFor(b) {
  const k = b.kind
  if (k === 'analyzing' || k === 'summary') return [
    { label: 'What should I work on first?', intent: 'worklist' },
    { label: 'What changed since last visit', intent: 'changes' },
    { label: 'Draft a status update', intent: 'status' },
  ]
  if (k === 'changes') return [
    { label: 'Show the new P1 requests', intent: 'drill' },
    { label: 'Why did Overdue rise?', intent: 'explain' },
    { label: 'Turn this into a recovery plan', intent: 'plan' },
  ]
  if (k === 'status') return [
    { label: 'Turn this into a recovery plan', intent: 'plan' },
    { label: 'What should I work on first?', intent: 'worklist' },
    { label: 'Schedule this as a daily digest', intent: 'note' },
  ]
  if (k === 'plan') return [
    { label: 'What should I work on first?', intent: 'worklist' },
    { label: 'Draft a status update', intent: 'status' },
    { label: 'What changed since last visit', intent: 'changes' },
  ]
  if (k === 'worklist') return [
    { label: 'Turn this into a recovery plan', intent: 'plan' },
    { label: 'Draft a status update', intent: 'status' },
    { label: 'What needs attention', intent: 'summary' },
  ]
  if (k === 'explain') return [
    { label: `Show the records behind ${b.tile?.title || 'this'}`, intent: 'drill' },
    { label: 'Investigate the top offenders', intent: 'drill' },
    { label: 'Create an alert for this metric', intent: 'note' },
  ]
  if (k === 'drill') return [
    { label: 'Draft a status update', intent: 'status' },
    { label: 'What should I work on first?', intent: 'worklist' },
    { label: 'Schedule a follow-up check', intent: 'note' },
  ]
  if (k === 'widget') return [
    { label: 'Add another widget', intent: 'create' },
    { label: 'Create a dashboard for this', intent: 'createstart' },
  ]
  if (k === 'note') return [
    { label: 'Summarize this dashboard', intent: 'analyzing' },
    { label: 'What needs attention', intent: 'summary' },
  ]
  return [{ label: 'What needs attention', intent: 'summary' }, { label: 'What changed since last visit', intent: 'changes' }]
}

// ---- commands (reached from the composer's + button, or by typing "/") ----
// Each carries the placeholder the composer adopts once it's picked, plus the
// suggestion list that opens with it — and hides again the moment the user types.
const ACTIONS = [
  { key: 'find', label: 'Find', icon: 'search', hint: 'Search records & changes', placeholder: 'Find tickets, records or changes…', prompts: [
    { label: 'Find tickets breaching SLA today', intent: 'drill' },
    { label: 'Find the P1 requests assigned to me', intent: 'drill' },
    { label: 'Search this dashboard for Overdue', intent: 'explain' },
    { label: 'Find what changed since last visit', intent: 'changes' },
  ] },
  { key: 'create', label: 'Create', icon: 'plus', hint: 'Build a widget or dashboard', placeholder: 'Describe the dashboard or widget to build…', prompts: [
    { label: 'Create a widget for SLA breaches by team', intent: 'create' },
    { label: 'Create a backlog trend chart', intent: 'create' },
    { label: 'Create a new dashboard', intent: 'createstart' },
    { label: 'Generate a widget from a description', intent: 'createstart' },
  ] },
  { key: 'edit', label: 'Edit', icon: 'edit', hint: 'Change a widget or layout', placeholder: 'Tell me what to change…', prompts: [
    { label: 'Change a chart’s type to line', intent: 'note' },
    { label: 'Group the KPI widgets together', intent: 'note' },
    { label: 'Edit the dashboard time filter', intent: 'note' },
  ] },
  { key: 'analyze', label: 'Analyze', icon: 'auto-graph', hint: 'Explain what the data shows', placeholder: 'What should I analyze?', prompts: [
    { label: 'Analyze what needs attention', intent: 'summary' },
    { label: 'Why did Overdue spike?', intent: 'explain' },
    { label: 'What changed since last visit', intent: 'changes' },
    { label: 'Summarize this dashboard', intent: 'analyzing' },
  ] },
  { key: 'prioritize', label: 'Prioritize', icon: 'flag', hint: 'Rank what to work on', placeholder: 'What should I prioritize?', prompts: [
    { label: 'What should I work on first?', intent: 'worklist' },
    { label: 'Prioritize the P1s breaching today', intent: 'drill' },
    { label: 'Turn this into a recovery plan', intent: 'plan' },
  ] },
  { key: 'schedule', label: 'Schedule', icon: 'calendar2', hint: 'Digests, alerts & reminders', placeholder: 'What should I schedule?', prompts: [
    { label: 'Schedule a daily summary email', intent: 'note' },
    { label: 'Block time to clear overdue work', intent: 'note' },
    { label: 'Alert me when P1 backlog exceeds 10', intent: 'note' },
  ] },
]
// ---- panel ⋯ menu (ServiceOps-appropriate set) ----
const menuOpen = ref(false)
const PANEL_MENU = [
  { key: 'history', label: 'History', icon: 'history' },
  { key: 'share', label: 'Share', icon: 'share' },
  { key: 'copy', label: 'Copy as Markdown', icon: 'copy' },
  { key: 'export', label: 'Export chat', icon: 'download' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
  { key: 'clear', label: 'Clear conversation', icon: 'trash', danger: true },
]
// what the thread reads as in Markdown — used by both Copy and Export
function threadMarkdown() {
  const lines = [`# ServiceOps AI · ${props.board.name}`, '']
  thread.value.forEach((b) => {
    if (b.kind === 'user') { lines.push(`**You:** ${b.text}`, ''); return }
    if (b.shownLines?.length) { lines.push(...b.shownLines.map((l) => `> ${l}`), ''); return }
    if (b.points?.length) { b.points.forEach((g) => { lines.push(`### ${g.title}`); g.points.forEach((p) => lines.push(`- ${p}`)); lines.push('') }); return }
    if (b.facts?.length) { b.facts.forEach((f) => lines.push(`- ${f.text} _(${f.chip})_`)); lines.push(''); return }
    if (b.text) { lines.push(`> ${b.text}`, '') }
  })
  return lines.join('\n')
}
function runPanelMenu(m) {
  menuOpen.value = false
  if (m.key === 'clear') { thread.value = []; activeAction.value = null; showSuggest.value = false; toast('Conversation cleared'); return }
  if (m.key === 'copy') { navigator.clipboard?.writeText(threadMarkdown()); toast('Copied the conversation as Markdown', 'success'); return }
  if (m.key === 'export') { toast('Exporting this conversation…'); return }
  if (m.key === 'history') { toast('Chat history runs on-prem — opening your past conversations'); return }
  if (m.key === 'share') { toast('Share this conversation with a technician or group'); return }
  toast('AI settings — model, grounding and on-prem options')
}

const DEFAULT_PH = 'Ask, build and act across your stack'
// which intent a typed prompt takes once a command is selected
const CMD_INTENT = { find: 'drill', create: 'create', edit: 'note', analyze: 'explain', prioritize: 'drill', schedule: 'note' }

const cmdOpen = ref(false)        // the command palette (+ button / "/")
const cmdIndex = ref(0)           // keyboard highlight in the palette
const sugIndex = ref(0)           // …and in the picked command's suggestions
const activeAction = ref(null)    // the picked command — shows as a chip in the composer
const showSuggest = ref(false)    // its suggestion list; hides as soon as the user types
const inputEl = ref(null)

// the composer speaks for whatever the flow is waiting on
const AWAIT_PH = {
  'dash-intent': 'Describe what this dashboard is for…',
  'dash-refine': 'Tell me what to add or change…',
  'widget-intent': 'Describe the widget and the data it should show…',
  'widget-refine': 'Tell me what to change about it…',
  'newboard-name': 'Name the new dashboard…',
  'dash-widget': 'Describe a widget to add to this dashboard…',
}
const placeholder = computed(() => AWAIT_PH[awaiting.value] || activeAction.value?.placeholder || DEFAULT_PH)
// exactly one popup at a time: the palette wins, else the picked command's suggestions
const popupOpen = computed(() => cmdOpen.value || !!(activeAction.value && showSuggest.value))
// typing "/find" filters the palette down as you go
const slashQuery = computed(() => (input.value.startsWith('/') ? input.value.slice(1).trim().toLowerCase() : ''))
const cmdList = computed(() => {
  const q = slashQuery.value
  return q ? ACTIONS.filter((a) => a.label.toLowerCase().startsWith(q) || a.key.startsWith(q)) : ACTIONS
})

function toggleCmd() {
  cmdOpen.value = !cmdOpen.value; cmdIndex.value = 0
  if (cmdOpen.value) { showSuggest.value = false; nextTick(() => inputEl.value?.focus()) }
}
function pickCommand(a) {
  activeAction.value = a
  cmdOpen.value = false
  input.value = ''             // drop the "/query" that opened the palette
  showSuggest.value = true     // its suggestions open with it…
  sugIndex.value = 0           // …with the first one already under the keyboard
  nextTick(() => inputEl.value?.focus())
}
function clearCommand() { activeAction.value = null; showSuggest.value = false; nextTick(() => inputEl.value?.focus()) }

function onInput() {
  if (input.value.startsWith('/')) { cmdOpen.value = true; cmdIndex.value = 0; return }
  cmdOpen.value = false
  // …and fade away the moment the user starts writing their own prompt
  if (input.value.trim()) showSuggest.value = false
}
/* The keyboard carries all the way through: "/" opens the palette, ↑↓ + ↵ picks a
 * command, then ↑↓ + ↵ runs one of THAT command's suggestions — never breaking to
 * the mouse mid-flow. Enter is handled here (not on keyup) so one keypress can't
 * both pick a suggestion and submit the composer. */
function onKeydown(e) {
  // 1 — the command palette
  if (cmdOpen.value && cmdList.value.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdIndex.value = (cmdIndex.value + 1) % cmdList.value.length; return }
    if (e.key === 'ArrowUp') { e.preventDefault(); cmdIndex.value = (cmdIndex.value - 1 + cmdList.value.length) % cmdList.value.length; return }
    if (e.key === 'Enter') { e.preventDefault(); pickCommand(cmdList.value[cmdIndex.value]); return }
    if (e.key === 'Escape') { e.preventDefault(); cmdOpen.value = false; return }
    return
  }
  // 2 — the picked command's suggestions
  const prompts = activeAction.value?.prompts || []
  if (showSuggest.value && prompts.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sugIndex.value = (sugIndex.value + 1) % prompts.length; return }
    if (e.key === 'ArrowUp') { e.preventDefault(); sugIndex.value = (sugIndex.value - 1 + prompts.length) % prompts.length; return }
    if (e.key === 'Enter') { e.preventDefault(); runPrompt(prompts[sugIndex.value]); return }
    if (e.key === 'Escape') { e.preventDefault(); showSuggest.value = false; return }
  }
  // 3 — plain composer
  if (e.key === 'Enter') { e.preventDefault(); submit(); return }
  if (e.key === 'Escape') { showSuggest.value = false; return }
  // backspace on an empty composer pops the command chip off
  if (e.key === 'Backspace' && !input.value && activeAction.value) clearCommand()
}
function runPrompt(p) { showSuggest.value = false; activeAction.value = null; pushUser(p.label); dispatch(p.intent, p.label) }

// ---- interactions ----
function submit() {
  const text = input.value.trim()
  if (!text || text.startsWith('/')) return
  const cmd = activeAction.value
  input.value = ''
  showSuggest.value = false
  activeAction.value = null
  // a create-flow step is waiting on this message — it owns the input
  if (awaiting.value === 'dash-intent') { dashIntent(text); return }
  if (awaiting.value === 'dash-refine') { refineDash(text); return }
  if (awaiting.value === 'widget-intent') { widgetIntent(text); return }
  if (awaiting.value === 'widget-refine') { awaiting.value = null; refineWidget(text); return }
  if (awaiting.value === 'newboard-name') { newBoardNamed(text); return }
  if (awaiting.value === 'dash-widget') { dashWidget(text); return }
  pushUser(cmd ? `${cmd.label}: ${text}` : text)
  dispatch(cmd ? CMD_INTENT[cmd.key] : routeIntent(text), text)
}
function suggest(s) { pushUser(s.label); dispatch(s.intent, s.label) }
// One action per fact: Investigate → spotlight the widget + a written briefing + 3 actions
// (the "why" is folded into the narrative, so a separate Explain link is no longer needed).
function investigate(fact) { pushUser(`Investigate: ${fact.chip}`); pushDrill(fact.chip, fact) }

// widget block: editable chips + type + add

// explain block sparkline
function spark(a) {
  const h = [...(a.history || []), a.value]; const W = 260, H = 42, pad = 4
  const min = Math.min(...h), max = Math.max(...h), span = max - min || 1
  const x = (i) => pad + (i * (W - pad * 2)) / (h.length - 1)
  const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2)
  return { W, H, line: 'M' + h.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L'), last: { x: x(h.length - 1), y: y(a.value) }, meanY: y(a.mean) }
}
/* Emphasise the load-bearing parts of a sentence — counts, percentages and the
 * widget names in quotes — so a paragraph can be skimmed rather than read whole.
 * The text is engine-generated (never user input), and is escaped first regardless. */
function hl(s) {
  return String(s == null ? '' : s)
    .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
    .replace(/“([^”]+)”/g, '<b>“$1”</b>')
    .replace(/(^|[\s(])([+−-]?\d[\d,.]*\s?%?)(?=$|[\s,.;:)])/g, '$1<b>$2</b>')
}
const dotClass = (s) => (s === 'bad' ? 'bad' : s === 'warn' ? 'warn' : 'info')

// external trigger — no auto-summary; the panel opens to the greeting empty state.
function trigger(intent, label) {
  pushUser(label)
  dispatch(intent, label)
}
defineExpose({ trigger })

// The empty-state greeting + starter CTAs (dashboard context — mirrors the ticket chat).
const firstName = computed(() => (store.currentUser || 'there').split(' ')[0])
const EMPTY_CTAS = [
  { label: 'Summarize this dashboard', intent: 'analyzing', icon: 'bulb' },
  { label: 'What changed since last visit', intent: 'changes', icon: 'history' },
  { label: 'What needs attention', intent: 'summary', icon: 'auto-graph' },
  { label: 'Generate a widget', intent: 'createstart', icon: 'wand' },
]

watch(() => props.role, () => {
  const s = thread.value.find((b) => b.kind === 'summary')
  if (s) s.facts = computeFacts(props.board, props.role)
})
</script>

<template>
  <aside class="asst card" v-if="open">
    <!-- header -->
    <div class="ah">
      <div class="ah-l"><span class="spk"><Icon name="sparkles" :size="16" /></span>
        <div><div class="ah-t">ServiceOps AI</div><div class="ah-sub">{{ board.name }} · {{ board.tiles.length }} widgets</div></div>
      </div>
      <div class="ah-r">
        <button class="x" title="More" @click.stop="menuOpen = !menuOpen"><Icon name="dots-v" :size="17" /></button>
        <button class="x" title="Close" @click="emit('update:open', false)"><Icon name="x" :size="17" /></button>
        <transition name="actpop">
          <div v-if="menuOpen" class="ahmenu" @click.stop>
            <button v-for="m in PANEL_MENU" :key="m.key" class="ahm-item" :class="{ danger: m.danger }" @click="runPanelMenu(m)">
              <Icon :name="m.icon" :size="15" /> {{ m.label }}
            </button>
          </div>
        </transition>
      </div>
    </div>
    <div v-if="menuOpen" class="ahmenu-back" @click="menuOpen = false" />

    <!-- thread -->
    <div ref="bodyEl" class="ab">
      <!-- greeting empty state (mirrors the ServiceOps ticket chat) -->
      <div v-if="!thread.length" class="empty-ai">
        <span class="ea-orb"><Icon name="sparkles" :size="26" /></span>
        <h3>Hello {{ firstName }}, how can we help?</h3>
        <p>Ask ServiceOps AI anything about this dashboard, or get help with insights, changes and building widgets.</p>
        <div class="ea-ctas">
          <button v-for="c in EMPTY_CTAS" :key="c.label" class="ea-cta" @click="suggest(c)">
            <Icon :name="c.icon" :size="16" /> <span>{{ c.label }}</span>
          </button>
        </div>
      </div>

      <div v-for="b in thread" :key="b.id" class="blk" :class="b.kind">
        <!-- user echo -->
        <div v-if="b.kind === 'user'" class="user"><span>{{ b.text }}</span></div>

        <!-- SHARED thinking phase — any answer block still reasoning -->
        <template v-else-if="b.phase === 'thinking'">
          <div class="think">
            <span class="think-orb"><Icon name="sparkles" :size="15" /></span>
            <div class="think-main">
              <div class="think-t">{{ thinkLabel(b) }}<span class="think-dots"><i /><i /><i /></span></div>
              <transition-group name="tstep" tag="div" class="think-steps">
                <div v-for="s in shownSteps(b)" :key="s.text" class="tstep" :class="s.state">
                  <span class="tstep-ic">
                    <Icon v-if="s.state === 'done'" name="check" :size="12" />
                    <span v-else class="tspin" />
                  </span>
                  <span class="tstep-x">{{ s.text }}</span>
                </div>
              </transition-group>
            </div>
          </div>
        </template>

        <!-- P1 summary — facts revealed one at a time -->
        <template v-else-if="b.kind === 'summary'">
          <div class="reasoning"><span class="rz-dot" /> Reasoned in {{ b.steps ? b.steps.length : 3 }} steps · ranked for your role</div>
          <div class="blk-h"><Icon name="sparkles" :size="14" /> What needs attention <span class="updated">updated {{ FRESHNESS }}</span></div>
          <div class="facts">
            <template v-for="(f, fi) in b.facts" :key="f.id">
              <div v-if="fi < b.shown" class="fact reveal" @mouseenter="emit('cite', f.tileId)" @mouseleave="emit('cite', null)">
                <span class="dot" :class="dotClass(f.severity)" />
                <div class="fb">
                  <div class="ftext" v-html="hl(f.text)" />
                  <div class="fmeta">
                    <span class="cite"><Icon name="chart-bar" :size="11" /> {{ f.chip }}</span>
                    <button class="lnk" @click="investigate(f)">Investigate →</button>
                  </div>
                </div>
              </div>
            </template>
            <div v-if="b.settled && !b.facts.length" class="calm"><Icon name="check" :size="16" /> Nothing unusual — all {{ board.tiles.length }} widgets are within range.</div>
          </div>
        </template>

        <!-- What changed since last visit — compact cards revealed one at a time -->
        <template v-else-if="b.kind === 'changes'">
          <div class="reasoning"><span class="rz-dot" /> Diffed every metric against your last visit</div>
          <div class="blk-h"><Icon name="history" :size="14" /> What changed since your last visit</div>
          <div class="lastvisit"><Icon name="clock" :size="12" /> Last visit: {{ b.data.lastVisit }}</div>
          <div class="chg-grid">
            <template v-for="(it, i) in b.data.items" :key="i">
              <div v-if="i < b.shown" class="chgc reveal" :class="[it.severity, { hasnote: it.note }]" :title="it.note || null">
                <div class="chgc-top">
                  <span class="chgc-ico" :class="it.dir"><Icon :name="it.dir === 'down' ? 'sort-desc' : 'sort-asc'" :size="13" /></span>
                  <span class="chgc-delta" :class="it.dir">{{ it.delta }}</span>
                </div>
                <div class="chgc-name">{{ it.widget }}</div>
                <div class="chgc-val">Now <b>{{ it.value }}</b></div>
              </div>
            </template>
          </div>
        </template>

        <!-- Summarize / Ask about this dashboard — written summary (post-thinking) -->
        <template v-else-if="b.kind === 'analyzing'">
          <div class="reasoning"><span class="rz-dot" /> Read {{ board.tiles.length }} widgets and ranked what matters</div>
          <div class="blk-h"><Icon name="sparkles" :size="14" /> Dashboard summary</div>
          <div v-for="(g, gi) in b.points" :key="gi" class="sum-grp">
            <div class="sum-gt">{{ g.title }}</div>
            <ul class="sum-list"><li v-for="(p, pi) in g.points" :key="pi" v-html="hl(p)" /></ul>
          </div>
        </template>

        <!-- Draft a status update — a copy-ready update, not a metric list -->
        <template v-else-if="b.kind === 'status'">
          <div class="reasoning"><span class="rz-dot" /> Written from what needs attention right now</div>
          <div class="blk-h"><Icon name="file-text" :size="14" /> Status update</div>
          <div class="subj"><span>Subject</span><b>{{ b.data.subject }}</b></div>
          <p v-for="(line, i) in b.shownLines" :key="i" class="say" v-html="hl(line)" />
          <p v-if="b.cur" class="say"><span v-html="hl(b.cur)" /><span class="caret" /></p>
        </template>

        <!-- Turn this into a recovery plan — ordered, each step with its reason -->
        <template v-else-if="b.kind === 'plan'">
          <div class="reasoning"><span class="rz-dot" /> Ordered by which deadline lands first</div>
          <div class="blk-h"><Icon name="clipboard" :size="14" /> Recovery plan</div>
          <p class="say">{{ b.data.intro }}</p>
          <ol class="nsteps">
            <template v-for="(s, si) in b.data.steps" :key="si">
              <li v-if="si < b.shown" class="reveal"><b>{{ s.title }}</b> — <span v-html="hl(s.body)" /></li>
            </template>
          </ol>
        </template>

        <!-- What should I work on first — a ranked queue with the why -->
        <template v-else-if="b.kind === 'worklist'">
          <div class="reasoning"><span class="rz-dot" /> Ranked for your role · deadline first</div>
          <div class="blk-h"><Icon name="flag" :size="14" /> Work on this first</div>
          <template v-for="(it, i) in b.items" :key="i">
            <div v-if="i < b.shown" class="wq reveal">
              <span class="wq-n" :class="dotClass(it.severity)">{{ it.rank }}</span>
              <div class="wq-b">
                <div class="wq-t" v-html="hl(it.text)" />
                <div class="wq-w">{{ it.why }}</div>
                <button class="lnk" @click="investigate({ kind: 'delta', tileId: it.tileId, chip: it.chip, text: it.text })">Investigate →</button>
              </div>
            </div>
          </template>
          <div v-if="b.settled && !b.items.length" class="calm"><Icon name="check" :size="16" /> Nothing is competing for your attention — the board is within range.</div>
        </template>

        <!-- P3 explain — the verdict streams in, then the sparkline/how/CTA reveal -->
        <template v-else-if="b.kind === 'explain'">
          <div class="reasoning"><span class="rz-dot" /> {{ b.anomaly ? 'Compared it against its own recent history' : 'Checked it against its normal range' }}</div>
          <div class="blk-h" :class="b.anomaly ? b.anomaly.severity : ''">
            <Icon :name="b.anomaly ? 'alert' : 'info'" :size="14" /> {{ b.tile.title }}
          </div>
          <p v-for="(line, i) in b.shownLines" :key="i" class="say" v-html="hl(line)" />
          <p v-if="b.cur" class="say"><span v-html="hl(b.cur)" /><span class="caret" /></p>
          <transition name="reveal">
            <div v-if="b.showExtras">
              <div v-if="b.anomaly" class="spark">
                <svg :viewBox="`0 0 ${spark(b.anomaly).W} ${spark(b.anomaly).H}`" preserveAspectRatio="none">
                  <line :x1="0" :x2="spark(b.anomaly).W" :y1="spark(b.anomaly).meanY" :y2="spark(b.anomaly).meanY" class="mean" />
                  <path :d="spark(b.anomaly).line" class="sl" />
                  <circle :cx="spark(b.anomaly).last.x" :cy="spark(b.anomaly).last.y" r="3.2" :class="'pt ' + b.anomaly.severity" />
                </svg>
              </div>
              <details v-if="b.anomaly" class="how"><summary><Icon name="info" :size="12" /> How was this calculated?</summary><div>{{ b.anomaly.how }}</div></details>
              <!-- carry the real tile through, or the drill has no widget to spotlight and renders empty -->
              <button class="mini-cta" @click="investigate({ kind: b.anomaly ? 'anomaly' : 'delta', tileId: b.tile.id, chip: b.tile.title, text: `The records behind ${b.tile.title}` })">Investigate <Icon name="chevron-right" :size="13" /></button>
            </div>
          </transition>
        </template>

        <!-- P2 drill — spotlight, then the briefing streams line-by-line, then actions reveal -->
        <template v-else-if="b.kind === 'drill'">
          <div class="blk-h"><Icon name="insights" :size="14" /> {{ b.fact.text }}</div>
          <transition name="reveal">
            <div v-if="b.showSpot && b.widget" class="spot"><Icon name="target" :size="12" /> Spotlighted <b>“{{ b.widget }}”</b> on the dashboard</div>
          </transition>
          <p v-for="(line, i) in b.shownLines" :key="i" class="say" v-html="hl(line)" />
          <p v-if="b.cur" class="say"><span v-html="hl(b.cur)" /><span class="caret" /></p>
        </template>

        <!-- ===== Generate with AI: conversational create flow ===== -->
        <template v-else-if="b.kind === 'create-start'">
          <div class="blk-h"><Icon name="wand" :size="14" /> Generate with AI</div>
          <p class="say">What would you like to build? Just tell me what it's for — I'll handle the rest and only ask what I genuinely need.</p>
          <div class="opts">
            <button class="opt" @click="startDash"><span class="opt-ic"><Icon name="layout" :size="16" /></span><div><b>A new dashboard</b><span>Describe the intent — I'll draft and name it</span></div></button>
            <button class="opt" @click="startWidget"><span class="opt-ic"><Icon name="chart-bar" :size="16" /></span><div><b>A new widget</b><span>Describe the data — I'll configure and place it</span></div></button>
          </div>
        </template>

        <!-- dashboard: state the intent (AI leads, user writes freely) -->
        <template v-else-if="b.kind === 'cd-intent'">
          <div class="blk-h"><Icon name="layout" :size="14" /> New dashboard</div>
          <p class="say">Tell me what this dashboard is <b>for</b> — the question you want it to answer every morning. Write it in the box below and I’ll draft it; if you don’t name it, I’ll name it for you.</p>
          <div class="ea-ctas starters">
            <button v-for="s in DASH_STARTERS" :key="s.label" class="ea-cta wrap" @click="dashIntent(s.label)">
              <Icon :name="s.icon" :size="16" /> <span>{{ s.label }}</span>
            </button>
          </div>
          <button class="lnk-row" @click="useDashPrompt()"><Icon name="wand" :size="13" /> Write the prompt for me</button>
        </template>

        <!-- dashboard: the whole board proposed at once, accepted in one click -->
        <template v-else-if="b.kind === 'cd-proposal'">
          <div class="prop">
            <div class="prop-h">Here’s my proposal — <b>{{ b.name }}</b></div>
            <span class="prop-match">{{ b.proposal.match }}% match</span>
            <div class="prop-meta">Category {{ b.proposal.category }} · {{ b.proposal.widgets.length }} widgets · design guidelines applied</div>
            <div class="prop-list">
              <div v-for="(w, wi) in b.proposal.widgets" :key="wi" class="prop-row">
                <span class="prop-mod">{{ w.module }}</span>
                <span class="prop-name">{{ w.name }}</span>
                <span class="prop-viz">{{ w.viz }}</span>
              </div>
            </div>
            <div class="prop-acts">
              <button class="pact go" @click="acceptProposal(b, 'new')">Create new dashboard</button>
              <button class="pact" @click="acceptProposal(b, 'current')">Add to current</button>
              <button class="pact" @click="regenerate(b)">Regenerate</button>
            </div>
          </div>
          <p class="say muted-say">Or tell me what to change and I’ll re-propose it.</p>
        </template>

        <!-- dashboard: everything placed in one go -->
        <template v-else-if="b.kind === 'cd-placed'">
          <div class="calm">
            <Icon name="check" :size="16" />
            <span>Added <b class="nm">{{ b.count }}</b> widgets to <b>{{ b.dash.name }}</b><span v-if="b.madeBoard"> — a new dashboard</span>.</span>
          </div>
        </template>

        <!-- dashboard: what the AI drafted, with the name it chose highlighted -->
        <template v-else-if="b.kind === 'cd-draft'">
          <div class="reasoning"><span class="rz-dot" /> Drafted from your intent</div>
          <div class="blk-h"><Icon name="wand" :size="14" /> Here’s what I’ll build</div>
          <ul class="sum-list">
            <li v-for="(p, pi) in b.plan" :key="pi">{{ p }}</li>
          </ul>
          <p class="say named">
            I’ve called it <b class="nm">{{ b.name }}</b>
            <span v-if="b.namedByAi" class="nm-note">— my suggestion, rename it any time.</span>
          </p>
          <div class="chipsrow mini">
            <button class="sg go" @click="continueDash()">Looks good — continue</button>
            <button class="sg" @click="focusComposer()">Something’s missing</button>
          </div>
        </template>

        <!-- dashboard: build its widgets, before any admin questions -->
        <template v-else-if="b.kind === 'cd-widgets'">
          <div class="blk-h"><Icon name="chart-bar" :size="14" /> Now let’s fill it</div>
          <p class="say">“<b>{{ draft.name }}</b>” is created. Tell me what to put on it — describe a widget and I’ll pick the clearest way to draw it. You can add as many as you like, one message at a time.</p>
          <div class="sub-h">What I can build <span class="muted">tap one to prefer it</span></div>
          <div class="wtypes">
            <button
              v-for="w in WIDGET_TYPES" :key="w.id" class="wtype" :class="{ on: draft.preferKind === w.id }"
              @click="preferType(w.id)"
            >
              <Icon v-if="w.icon" :name="w.icon" :size="18" class="wt-i" />
              <span v-else class="wt-g" :class="w.id" />
              <span class="wt-l">{{ w.label }}</span>
              <span class="wt-h">{{ w.hint }}</span>
            </button>
          </div>
          <div class="chipsrow mini">
            <button class="sg" @click="finishWidgets()">Skip — no widgets for now</button>
          </div>
        </template>

        <!-- dashboard: I need more before I can build what was asked for -->
        <template v-else-if="b.kind === 'cd-need'">
          <div class="blk-h"><Icon name="info" :size="14" /> I need a bit more</div>
          <p v-if="b.partial" class="say">That’s the {{ b.have }} I could read clearly. You asked for <b>{{ b.want }}</b> more — tell me what {{ b.want === 1 ? 'it' : 'they' }} should show and I’ll build {{ b.want === 1 ? 'it' : 'them' }} too.</p>
          <p v-else class="say">Happy to build {{ b.want === 1 ? 'it' : `all ${b.want}` }} — I just need to know what {{ b.want === 1 ? 'it' : 'each one' }} should show. Describe {{ b.want === 1 ? 'it' : 'them' }} below, one per line.</p>
          <p class="say muted-say">For example: “overdue requests by team”, “backlog trend over 6 months”, “a list of the open P1s”.</p>
        </template>

        <!-- dashboard: a widget just built into it -->
        <template v-else-if="b.kind === 'cd-widget'">
          <div class="calm">
            <Icon name="check" :size="16" />
            <span>Added <b class="nm">{{ b.tile.title }}</b> to the board.</span>
            <span v-if="b.total > 1" class="ofn">{{ b.idx }} of {{ b.total }}</span>
          </div>
          <div class="wprev">
            <div class="wp-h"><b>{{ b.tile.title }}</b><span class="pv">Live preview</span></div>
            <ChartTile v-if="b.tile.type === 'chart'" :chart="b.tile.chart" :legend="true" :height="150" />
            <div v-else-if="b.tile.type === 'kpi'" class="kpiprev"><b>{{ b.tile.value }}{{ b.tile.unit }}</b><span>{{ b.tile.title }}</span></div>
            <div v-else class="tblprev">
              <table>
                <thead><tr><th v-for="c in b.tile.columns" :key="c">{{ c }}</th></tr></thead>
                <tbody><tr v-for="(r, ri) in b.tile.rows.slice(0, 3)" :key="ri"><td v-for="(cell, ci) in r" :key="ci">{{ cell }}</td></tr></tbody>
              </table>
            </div>
          </div>
          <div v-if="b.cfg" class="cfg">
            <div class="cfg-h">How it’s configured</div>
            <div v-for="(r, ri) in b.cfg.rows" :key="ri" class="cfg-r"><span>{{ r.k }}</span><b>{{ r.v }}</b></div>
          </div>
          <!-- only after the LAST of a batch, so a 3-widget request doesn't repeat these -->
          <div v-if="b.last" class="chipsrow mini">
            <button class="sg" @click="moreWidgets()">Add another widget</button>
            <button class="sg go" @click="finishWidgets()">That’s everything — show me the dashboard</button>
          </div>
        </template>

        <!-- dashboard: everything built, on the board itself -->
        <template v-else-if="b.kind === 'cd-recap'">
          <div class="reasoning"><span class="rz-dot" /> You’re looking at it now</div>
          <div class="blk-h"><Icon name="check" :size="14" /> Here’s what I built</div>
          <p class="say">“<b>{{ b.dash.name }}</b>” now has <b>{{ b.built.length }}</b> widget{{ b.built.length === 1 ? '' : 's' }} on it:</p>
          <ul class="sum-list">
            <li v-for="(t, ti) in b.built" :key="ti"><b>{{ t.title }}</b> — {{ t.type === 'chart' ? `${t.chart.kind} chart` : t.type === 'kpi' ? 'headline number' : 'record list' }}</li>
            <li v-if="!b.built.length">Nothing yet — it’s an empty board for now.</li>
          </ul>
          <p class="say muted-say">Have a look at the canvas behind this panel. If anything’s off, tell me and I’ll change it — otherwise I just need two last things.</p>
          <div class="chipsrow mini">
            <button class="sg go" @click="confirmRecap()">Looks good — finish setup</button>
            <button class="sg" @click="changeRecap()">Change something</button>
          </div>
        </template>

        <!-- dashboard: created -->
        <template v-else-if="b.kind === 'cd-done'">
          <div class="calm"><Icon name="check" :size="16" /> <span><b class="nm">{{ b.dash.name }}</b> is set up<span v-if="b.built"> with {{ b.built }} widget{{ b.built === 1 ? '' : 's' }}</span>.</span></div>
          <p v-if="b.namedByAi" class="say muted-say">I named it for you — open it and rename from the board header if you'd like something else.</p>
          <div class="doneacts">
            <button class="add" @click="openBoard(b.dash)"><Icon name="open-in" :size="14" /><span>Open it</span></button>
            <button class="mini-cta" @click="startWidget">Add a widget with AI <Icon name="chevron-right" :size="13" /></button>
          </div>
        </template>

        <!-- widget: state the intent -->
        <template v-else-if="b.kind === 'cw-intent'">
          <div class="blk-h"><Icon name="chart-bar" :size="14" /> New widget</div>
          <p class="say">Describe what it should show and which data it should come from{{ draft.dash ? ` on “${draft.dash.name}”` : '' }} — write it below and I’ll configure it.</p>
          <div class="ea-ctas starters">
            <button v-for="s in WIDGET_STARTERS" :key="s.label" class="ea-cta wrap" @click="widgetIntent(s.label)">
              <Icon :name="s.icon" :size="16" /> <span>{{ s.label }}</span>
            </button>
          </div>
          <button class="lnk-row" @click="useWidgetPrompt()"><Icon name="wand" :size="13" /> Write the prompt for me</button>
        </template>

        <!-- widget: the one the AI built — preview, chart-type preference, add or change -->
        <!-- only once resolved: an unsettled block is one paused on the grouping question -->
        <template v-else-if="b.kind === 'cw-build' && b.settled">
          <div class="reasoning"><span class="rz-dot" /> Configured from your description</div>
          <div class="blk-h"><Icon name="wand" :size="14" /> Here’s a preview — {{ b.title }}</div>
          <div class="wmeta">{{ b.module }} · {{ b.spec.kind === 'shortcut' ? 'Records' : 'Count' }} · {{ VIZ_WORD[b.spec.kind] || b.spec.kind }}</div>
          <div class="wprev">
            <div class="wp-h"><b>{{ b.title }}</b><span class="pv">Preview</span></div>
            <ChartTile v-if="b.tile.type === 'chart'" :chart="b.tile.chart" :legend="true" :height="150" />
            <div v-else-if="b.tile.type === 'kpi'" class="kpiprev"><b>{{ b.tile.value }}{{ b.tile.unit }}</b><span>{{ b.tile.title }}</span></div>
            <div v-else class="tblprev">
              <table>
                <thead><tr><th v-for="c in b.tile.columns" :key="c">{{ c }}</th></tr></thead>
                <tbody><tr v-for="(r, ri) in b.tile.rows.slice(0, 3)" :key="ri"><td v-for="(cell, ci) in r" :key="ci">{{ cell }}</td></tr></tbody>
              </table>
            </div>
          </div>
          <!-- one-tap re-draw: every form the data supports, switched in place -->
          <div class="chipsrow mini kindrow">
            <button
              v-for="k in WIDGET_KINDS" :key="k.id" class="sg" :class="{ go: b.spec.kind === k.id }"
              @click="setBuildKind(b, k.id)"
            >{{ k.label }}</button>
          </div>
          <div v-if="b.cfg" class="cfg">
            <div class="cfg-h">How it’s configured</div>
            <div v-for="(r, ri) in b.cfg.rows" :key="ri" class="cfg-r"><span>{{ r.k }}</span><b>{{ r.v }}</b></div>
            <template v-if="b.cfg.filters.length">
              <div class="cfg-h cond">Conditions</div>
              <div class="chips">
                <span v-for="(c, ci) in b.cfg.filters" :key="ci" class="dchip">
                  <b>{{ c.field }}</b><span v-if="c.op" class="op">{{ c.op }}</span> {{ c.value }}
                </span>
              </div>
            </template>
          </div>
          <div class="doneacts">
            <button class="add" @click="confirmWidget(b)">
              <Icon name="plus" :size="14" /><span>Add to “{{ currentBoard().name }}”</span>
            </button>
            <button class="mini-cta" @click="confirmWidget(b, 'new')">New dashboard</button>
            <button class="mini-cta" @click="changeWidget()">Change something <Icon name="chevron-right" :size="13" /></button>
          </div>
        </template>

        <!-- widget: name the new board it should land on -->
        <template v-else-if="b.kind === 'cw-newboard'">
          <p class="say">What should the new dashboard be called? I’ll create it and drop the widget straight in.</p>
        </template>

        <!-- widget: added — with the real thing previewed inline, as it renders on the board -->
        <template v-else-if="b.kind === 'cw-done'">
          <div class="calm">
            <Icon name="check" :size="16" />
            <span>Added <b class="nm">{{ b.tile.title }}</b> to <b>{{ b.dash.name }}</b><span v-if="draft.createdBoard"> — a new dashboard I created for it</span>.</span>
          </div>
          <div class="wprev">
            <div class="wp-h"><b>{{ b.tile.title }}</b><span class="pv">Live preview</span></div>
            <ChartTile v-if="b.tile.type === 'chart'" :chart="b.tile.chart" :legend="true" :height="150" />
            <div v-else-if="b.tile.type === 'kpi'" class="kpiprev"><b>{{ b.tile.value }}{{ b.tile.unit }}</b><span>{{ b.tile.title }}</span></div>
            <div v-else class="tblprev">
              <table>
                <thead><tr><th v-for="c in b.tile.columns" :key="c">{{ c }}</th></tr></thead>
                <tbody><tr v-for="(r, ri) in b.tile.rows.slice(0, 3)" :key="ri"><td v-for="(cell, ci) in r" :key="ci">{{ cell }}</td></tr></tbody>
              </table>
            </div>
          </div>
          <!-- spell the configuration back so "added" is checkable, not just claimed -->
          <div v-if="b.cfg" class="cfg">
            <div class="cfg-h">How it’s configured</div>
            <div v-for="(r, ri) in b.cfg.rows" :key="ri" class="cfg-r"><span>{{ r.k }}</span><b>{{ r.v }}</b></div>
            <template v-if="b.cfg.filters.length">
              <div class="cfg-h cond">Conditions</div>
              <div class="chips">
                <span v-for="(c, ci) in b.cfg.filters" :key="ci" class="dchip">
                  <b>{{ c.field }}</b><span v-if="c.op" class="op">{{ c.op }}</span> {{ c.value }}
                </span>
              </div>
            </template>
          </div>
        </template>

        <!-- numbered next steps, written as prose (only after a task that leaves a decision) -->
        <template v-else-if="b.kind === 'nextsteps'">
          <p class="say">{{ b.intro }}</p>
          <p class="say">Would you like me to take any of these next steps?</p>
          <ol class="nsteps">
            <li v-for="(s, si) in b.steps" :key="si">
              <button class="nstep" @click="runNextStep(s)">
                <b>{{ s.title }}</b><span> — {{ s.body }}</span>
              </button>
            </li>
          </ol>
          <p class="say muted-say">What would you like to do next?</p>
        </template>

        <!-- "write the prompt for me" — the questions we need, and angles to answer them -->
        <template v-else-if="b.kind === 'prompt-help'">
          <div class="blk-h"><Icon name="wand" :size="14" /> Let me write it</div>
          <p class="say">{{ b.intro }}</p>
          <div class="needs">
            <div v-for="(n, ni) in b.needs" :key="ni" class="need"><span class="need-n">{{ ni + 1 }}</span>{{ n }}</div>
          </div>
          <ol class="nsteps">
            <li v-for="ap in b.approaches" :key="ap.id">
              <button class="nstep" @click="writePrompt(b, ap)">
                <b>{{ ap.title }}</b><span> — {{ ap.body }}</span>
              </button>
            </li>
          </ol>
          <p class="say muted-say">Pick one and I’ll drop the finished prompt into the box below — edit it however you like before sending.</p>
        </template>

        <!-- the one question card used by every mandatory question -->
        <template v-else-if="b.kind === 'ask'">
          <div class="askc" :class="{ done: b.answered }">
            <div class="ask-h">
              <div class="ask-qs"><span class="ask-q">{{ b.q }}</span><span v-if="b.sub && !b.answered" class="ask-sub">{{ b.sub }}</span></div>
              <span class="ask-step">{{ b.step }} of {{ b.total }}</span>
            </div>
            <template v-if="!b.answered">
              <button v-for="(o, oi) in b.options" :key="o.value" class="ask-opt" @click="answerAsk(b, o)">
                <span class="ask-n">{{ oi + 1 }}</span>
                <span class="ask-l">{{ o.label }}</span>
                <Icon name="chevron-right" :size="14" class="ask-arrow" />
              </button>
              <div class="ask-foot">
                <span class="ask-other">
                  <Icon name="edit" :size="13" />
                  <input v-model="b.other" :placeholder="b.otherPh || 'Something else'" @keyup.enter="answerAsk(b, null, b.other)" />
                </span>
                <button v-if="b.skippable" class="ask-skip" @click="answerAsk(b, null, '__skip')">Skip</button>
              </div>
            </template>
            <div v-else class="ask-answered"><Icon name="check" :size="13" /> {{ b.answered }}</div>
          </div>
        </template>

        <!-- short templated reply (edit / schedule) -->
        <template v-else-if="b.kind === 'note'">
          <div class="blk-h"><Icon name="sparkles" :size="14" /> ServiceOps AI</div>
          <p class="say">{{ b.text }}</p>
        </template>

        <!-- rate / copy this answer -->
        <div v-if="hasFeedback(b)" class="fb-row">
          <button class="fbtn" :class="{ on: b.rated === 'up' }" title="Good answer" @click="rate(b, 'up')"><Icon name="thumb-up" :size="14" /></button>
          <button class="fbtn" :class="{ on: b.rated === 'down' }" title="Not helpful" @click="rate(b, 'down')"><Icon name="thumb-down" :size="14" /></button>
          <button class="fbtn" :class="{ ok: b.copied }" :title="b.copied ? 'Copied' : 'Copy'" @click="copyBlock(b)">
            <Icon :name="b.copied ? 'check' : 'copy'" :size="14" />
          </button>
        </div>

        <!-- contextual Follow ups (change with the answer) -->
        <div v-if="isAnswer(b)" class="fu-sec">
          <div class="fu-h">Follow ups</div>
          <div class="fu-list">
            <button v-for="f in followUpsFor(b)" :key="f.label" class="fu" @click="suggest(f)">
              <Icon name="chevron-right" :size="14" class="fu-arrow" /> <span>{{ f.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- composer: + / "/" command palette, the picked command's suggestions, then the input -->
    <div class="af">
      <!-- ONE popup slot: the command palette, or the picked command's suggestions.
           Sharing a single transitioned element keeps them mutually exclusive and
           avoids two sibling transitions racing each other on rapid toggles. -->
      <transition name="actpop">
        <div v-if="popupOpen" class="actpop" :class="{ cmdpop: cmdOpen }">
          <!-- command palette (from + or typing "/") — icon + name, nothing else -->
          <template v-if="cmdOpen">
            <button
              v-for="(a, i) in cmdList" :key="a.key" class="cmditem" :class="{ sel: i === cmdIndex }"
              @click="pickCommand(a)" @mouseenter="cmdIndex = i"
            >
              <Icon :name="a.icon" :size="15" />
              <span class="cmd-l">{{ a.label }}</span>
            </button>
            <div v-if="!cmdList.length" class="cmd-none">No match for “{{ slashQuery }}”</div>
          </template>

          <!-- the picked command's suggestions — fade out once the user writes their own -->
          <template v-else>
            <div class="actpop-h"><Icon :name="activeAction.icon" :size="14" /> {{ activeAction.label }}<button class="apx" @click="showSuggest = false"><Icon name="x" :size="14" /></button></div>
            <button
              v-for="(p, si) in activeAction.prompts" :key="p.label" class="actprompt"
              :class="{ sel: si === sugIndex }" @click="runPrompt(p)" @mouseenter="sugIndex = si"
            >
              <Icon :name="activeAction.icon" :size="14" /> {{ p.label }}
            </button>
          </template>
        </div>
      </transition>

      <div class="inbox">
        <button class="plusbtn" :class="{ on: cmdOpen }" title="Commands" @click="toggleCmd"><Icon name="plus" :size="17" /></button>
        <span v-if="activeAction" class="cmdchip">
          <Icon :name="activeAction.icon" :size="12" /> {{ activeAction.label }}
          <button class="ccx" title="Remove command" @click="clearCommand"><Icon name="x" :size="11" /></button>
        </span>
        <input
          ref="inputEl" v-model="input" :placeholder="placeholder"
          @input="onInput" @keydown="onKeydown"
        />
        <button class="send" :class="{ ready: input.trim() }" :disabled="!input.trim()" @click="submit"><Icon name="send" :size="15" /></button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.asst { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--surface); }
.ah { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px; border-bottom: 1px solid var(--border); }
.ah-l { display: flex; gap: 10px; align-items: center; }
/* AI icons are gradient GLYPHS on a soft tile, not white-on-solid orbs */
.spk { width: 32px; height: 32px; border-radius: 9px; flex: none; display: grid; place-items: center; background: var(--ai-softer); }
.spk :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.ah-t { font-weight: 600; font-size: 15px; }
.ah-sub { font-size: 11.5px; color: var(--muted); }
.x { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; padding: 3px; border-radius: 7px; }
.x:hover { background: var(--surface-2); color: var(--ink); }
/* header ⋯ menu */
.ah-r { position: relative; display: flex; align-items: center; gap: 2px; }
.ahmenu-back { position: fixed; inset: 0; z-index: 40; }
.ahmenu { position: absolute; top: calc(100% + 6px); right: 0; z-index: 50; min-width: 194px; padding: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh-pop); display: flex; flex-direction: column; }
.ahm-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: none; background: transparent; border-radius: 7px; padding: 8px 9px; font-size: 12.5px; color: var(--ink); }
.ahm-item :deep(.ico) { color: var(--muted); flex: none; }
.ahm-item:hover { background: var(--ai-softer); color: var(--ai-ink); }
.ahm-item:hover :deep(.ico) { color: var(--ai); }
.ahm-item.danger { color: var(--red); }
.ahm-item.danger :deep(.ico) { color: var(--red); }
.ahm-item.danger:hover { background: var(--red-soft); color: var(--red); }

/* generous rhythm — the thread is read, not scanned, so answers need room */
.ab { flex: 1; overflow: auto; padding: 18px 16px 22px; display: flex; flex-direction: column; gap: 22px; }
.blk { animation: rise .2s ease both; }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .blk { animation: none; } }
.user { display: flex; justify-content: flex-end; }
.user span { background: var(--surface-2); color: var(--ink); font-size: 12.5px; font-weight: 500; padding: 8px 13px; border-radius: 13px 13px 3px 13px; max-width: 85%; }
.blk-h { display: flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13px; margin-bottom: 12px; }
.blk-h.bad > :first-child { color: var(--red); } .blk-h.warn > :first-child { color: var(--amber); }
.blk-h > :first-child { color: var(--ai); }
.updated { margin-left: auto; font-size: 10.5px; font-weight: 400; color: var(--muted); }
/* summary facts */
.facts { display: flex; flex-direction: column; gap: 2px; }
.fact { display: flex; gap: 9px; padding: 9px; border-radius: 9px; }
.fact:hover { background: var(--primary-softer); }
.dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex: none; }
.dot.bad { background: var(--red); } .dot.warn { background: var(--amber); } .dot.info { background: var(--blue); }
.fb { flex: 1; min-width: 0; }
.ftext { font-size: 12.5px; font-weight: 500; line-height: 1.45; }
.ftext b { color: var(--ink); font-weight: 600; }
.fmeta { display: flex; align-items: center; gap: 10px; margin-top: 5px; }
.cite { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--border); padding: 1px 7px; border-radius: var(--r-pill); }
.lnk { border: none; background: transparent; color: var(--primary-700); font-weight: 600; font-size: 11.5px; padding: 0; }
.lnk:hover { text-decoration: underline; }
.calm { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--muted); padding: 8px; }
.calm > :first-child { color: var(--green); }
/* what changed since last visit */
.lastvisit { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); margin-bottom: 11px; }
/* compact 2-up change cards — one mini stat card per moved metric; the explanatory
   note rides in a hover tooltip so the digest stays small. Severity gives the wash. */
.chg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.chgc { display: flex; flex-direction: column; gap: 5px; min-width: 0; border: 1px solid var(--border); border-radius: 11px; padding: 9px 10px; background: var(--surface-2); }
.chgc.bad { background: var(--red-soft); border-color: color-mix(in srgb, var(--red) 22%, transparent); }
.chgc.warn { background: var(--amber-soft); border-color: color-mix(in srgb, var(--amber) 24%, transparent); }
.chgc.good { background: var(--green-soft); border-color: color-mix(in srgb, var(--green) 24%, transparent); }
.chgc.hasnote { cursor: help; }
.chgc-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.chgc-ico { flex: none; width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; background: var(--surface); color: var(--muted); box-shadow: 0 1px 2px rgba(0,0,0,.05); }
.chgc.bad .chgc-ico { color: var(--red); } .chgc.warn .chgc-ico { color: var(--amber); } .chgc.good .chgc-ico { color: var(--green); }
.chgc-delta { flex: none; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; padding: 1px 7px; border-radius: var(--r-pill); background: var(--surface); }
.chgc.bad .chgc-delta { color: var(--red); } .chgc.warn .chgc-delta { color: var(--amber); } .chgc.good .chgc-delta { color: var(--green); }
.chgc-name { font-size: 12px; font-weight: 600; color: var(--ink); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.chgc-val { font-size: 11px; color: var(--muted); }
.chgc-val b { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
/* a faint marker that a hover note exists */
.chgc.hasnote .chgc-val::after { content: "ⓘ"; color: var(--muted-2); font-weight: 400; margin-left: 5px; font-size: 10.5px; }
/* ===== realistic "thinking" phase — pulsing orb + reasoning steps ===== */
.think { display: flex; gap: 11px; padding: 4px 0 6px; }
.think-orb { width: 30px; height: 30px; border-radius: 9px; flex: none; display: grid; place-items: center; background: var(--ai-softer); animation: orbpulse 1.3s ease-in-out infinite; }
.think-orb :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
@keyframes orbpulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,.42); } 50% { box-shadow: 0 0 0 8px rgba(139,92,246,0); } }
.think-main { flex: 1; min-width: 0; padding-top: 2px; }
/* the label shimmers left→right in the AI gradient while it's thinking */
.think-t { font-size: 13px; font-weight: 600; display: inline-flex; align-items: baseline;
  background: linear-gradient(90deg, var(--muted) 0%, var(--muted) 20%, #731efb 42%, #f911e3 52%, var(--muted) 74%, var(--muted) 100%);
  background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: shimmer 2.1s linear infinite; }
@keyframes shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
@media (prefers-reduced-motion: reduce) { .think-t { animation: none; color: var(--ink); background: none; -webkit-text-fill-color: currentColor; } }
.think-dots { display: inline-flex; gap: 3px; margin-left: 5px; align-self: flex-end; margin-bottom: 4px; }
.think-dots i { width: 3px; height: 3px; border-radius: 50%; background: var(--ai); animation: andot 1.2s infinite; }
.think-dots i:nth-child(2) { animation-delay: .2s; } .think-dots i:nth-child(3) { animation-delay: .4s; }
@keyframes andot { 0%, 60%, 100% { opacity: .2; } 30% { opacity: 1; } }
.think-steps { display: flex; flex-direction: column; gap: 7px; margin-top: 9px; }
.tstep { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.tstep.active { color: var(--ink-2); } .tstep.done { color: var(--ink-2); }
.tstep-ic { width: 16px; height: 16px; flex: none; display: grid; place-items: center; }
.tstep.done .tstep-ic { color: var(--green); }
.tspin { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--ai-soft); border-top-color: var(--ai); animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.tstep-enter-active { transition: opacity .25s ease, transform .25s ease; }
.tstep-enter-from { opacity: 0; transform: translateY(4px); }
/* streaming caret + progressive reveal */
.caret { display: inline-block; width: 2px; height: 1em; margin-left: 2px; vertical-align: -2px; background: var(--ai); border-radius: 1px; animation: blink 1s steps(2) infinite; }
@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
.reveal { animation: rise .28s ease both; }
.reveal-enter-active { transition: opacity .28s ease, transform .28s ease; }
.reveal-enter-from { opacity: 0; transform: translateY(6px); }
@media (prefers-reduced-motion: reduce) { .think-orb, .think-dots i, .tspin, .caret, .reveal { animation: none; } }
/* explain */
.say { margin: 0 0 12px; font-size: 12.5px; line-height: 1.62; color: var(--ink-2); }
.say b { color: var(--ink); font-weight: 600; }
.say:first-of-type { color: var(--ink); }
/* "spotlighted a widget on the board" note — the written answer points AT the tile */
.spot { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 11.5px; color: var(--ai-ink); background: var(--ai-grad-soft); border: 1px solid var(--ai-border); border-radius: var(--r-pill); padding: 4px 11px; }
.spot :deep(.ico) { color: var(--ai); }
.spot b { font-weight: 600; }
.spark svg { width: 100%; height: 42px; display: block; margin-bottom: 8px; }
.sl { fill: none; stroke: var(--muted-2); stroke-width: 1.5; }
.mean { stroke: var(--border-strong); stroke-width: 1; stroke-dasharray: 3 3; }
.pt.bad { fill: var(--red); } .pt.warn { fill: var(--amber); }
.how summary { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); cursor: pointer; list-style: none; }
.how summary::-webkit-details-marker { display: none; }
.how > div { margin-top: 6px; font-size: 11px; color: var(--ink-2); background: var(--surface-2); border-radius: 7px; padding: 7px 9px; line-height: 1.45; }
.mini-cta { display: inline-flex; align-items: center; gap: 1px; margin-top: 9px; border: none; background: var(--primary-soft); color: var(--primary-700); font-weight: 600; font-size: 12px; height: 28px; padding: 0 11px; border-radius: 7px; }
.mini-cta:hover { background: var(--primary); color: #fff; }
/* shared chips */
.sub-h { display: flex; align-items: baseline; gap: 7px; font-size: 12px; font-weight: 600; margin: 12px 0 8px; }
.sub-h .muted { font-weight: 400; font-size: 10.5px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dchip { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-pill); padding: 3px 8px; color: var(--ink-2); }
.dchip b { color: var(--ink); font-weight: 600; }
.dchip .op { color: var(--muted); }
.dchip.locked { background: var(--primary-softer); border-color: transparent; }
.cx { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; padding: 0; border-radius: 3px; }
.cx:hover { background: var(--red-soft); color: var(--red); }
.cl { color: var(--muted-2); }
.tier { display: flex; align-items: flex-start; gap: 4px; margin: 8px 0 0; font-size: 11px; background: var(--amber-soft); color: var(--amber); border-radius: 7px; padding: 7px 9px; line-height: 1.4; }
.rtbl { border: 1px solid var(--border); border-radius: var(--r); overflow: auto; max-height: 200px; }
table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
th { text-align: left; font-weight: 600; color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .3px; padding: 6px 8px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); }
td { padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
tr:last-child td { border-bottom: none; }
.none { text-align: center; color: var(--muted); padding: 12px; }
.idl { color: var(--primary-700); font-weight: 600; }
.pill { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; border-radius: 999px; font-size: 10px; font-weight: 600; }
.pill-blue { background: var(--blue-soft); color: var(--blue); } .pill-amber { background: var(--amber-soft); color: var(--amber); }
.pill-green { background: var(--green-soft); color: var(--green); } .pill-red { background: var(--red-soft); color: var(--red); }
.pill-p1 { background: var(--red-soft); color: var(--red); } .pill-p2 { background: var(--amber-soft); color: var(--amber); }
.pill-p3 { background: var(--blue-soft); color: var(--blue); } .pill-p4 { background: var(--surface-2); color: var(--muted); }
.acts { display: flex; flex-direction: column; gap: 6px; }
.act { display: flex; align-items: center; gap: 9px; text-align: left; border: 1px solid var(--border); background: var(--surface); border-radius: 9px; padding: 9px 10px; }
.act:hover { border-color: var(--primary); background: var(--primary-softer); }
.aic { width: 26px; height: 26px; border-radius: 7px; flex: none; display: grid; place-items: center; background: var(--surface-2); color: var(--ink-2); }
.act:hover .aic { background: var(--primary-soft); color: var(--primary-700); }
.al { flex: 1; font-size: 12px; font-weight: 500; }
.ac { color: var(--muted-2); }
/* widget */
.wprev { border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; }
.wp-h { display: flex; align-items: center; justify-content: space-between; padding: 8px 11px; border-bottom: 1px solid var(--border); }
.wp-h b { font-size: 12.5px; }
.pv { font-size: 9.5px; font-weight: 600; color: var(--primary-700); background: var(--primary-soft); border-radius: 4px; padding: 1px 6px; }
.kinds { display: flex; gap: 6px; }
.kind { position: relative; display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); background: var(--surface); border-radius: 7px; padding: 6px 9px; font-size: 11.5px; color: var(--ink-2); }
.kind.on { border-color: var(--primary); background: var(--primary-softer); color: var(--primary-700); font-weight: 600; }
.rec { color: var(--green); font-weight: 700; }
.why { display: flex; align-items: flex-start; gap: 5px; margin: 9px 0 0; font-size: 11.5px; color: var(--ink-2); background: var(--surface-2); border-radius: 7px; padding: 8px 10px; line-height: 1.45; }
.why > :first-child { color: var(--amber); flex: none; margin-top: 1px; }
/* Primary AI CTA — a gradient BORDER and gradient label on a white fill, never a
   solid gradient slab. The label needs its own <span> because the border trick
   already owns the button's `background`. */
.add { display: inline-flex; align-items: center; gap: 7px; margin-top: 11px; height: 34px; padding: 0 16px; font-weight: 600; font-size: 12.5px;
  border: 1.5px solid transparent; border-radius: var(--r-pill);
  background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--ai-grad-line) border-box; }
.add span, .add :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.add:hover { background: linear-gradient(var(--ai-softer), var(--ai-softer)) padding-box, var(--ai-grad-line) border-box; }
.add:disabled { background: linear-gradient(var(--green-soft), var(--green-soft)) padding-box, linear-gradient(var(--green), var(--green)) border-box; opacity: 1; }
.add:disabled span, .add:disabled :deep(.ico) { background: none; -webkit-text-fill-color: var(--green); color: var(--green); }
/* ===== create flow ===== */
/* the AI-chosen name, called out in the sentence that announces it */
.nm { color: var(--ai-ink); font-weight: 700; background: var(--ai-grad-soft); border: 1px solid var(--ai-border); border-radius: 6px; padding: 1px 7px; }
.named { margin-top: 10px; }
.nm-note { color: var(--muted); font-size: 11.5px; margin-left: 5px; }
.ofn { margin-left: auto; font-size: 10.5px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; }
.muted-say { color: var(--muted); font-size: 11.5px; margin-top: -2px; }
.doneacts { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-top: 10px; }
.doneacts .add, .doneacts .mini-cta { margin-top: 0; }
.lnk-row { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; border: none; background: transparent; color: var(--ai-ink); font-weight: 600; font-size: 11.5px; padding: 4px 0; }
.lnk-row :deep(.ico) { color: var(--ai); }
.lnk-row:hover { text-decoration: underline; }

/* numbered next steps / prompt angles — prose list, each line actionable */
.nsteps { margin: 4px 0 8px; padding-left: 20px; display: flex; flex-direction: column; gap: 7px; }
.nsteps li { font-size: 12.5px; line-height: 1.5; color: var(--ink-2); }
.nsteps li::marker { color: var(--muted); font-weight: 600; }
.nstep { display: block; width: 100%; text-align: left; border: none; background: transparent; padding: 3px 6px 3px 2px; border-radius: 7px; font: inherit; font-size: 12.5px; line-height: 1.5; color: var(--ink-2); cursor: pointer; }
.nstep b { color: var(--ink); font-weight: 600; }
.nstep:hover { background: var(--ai-softer); }
.nstep:hover b { color: var(--ai-ink); }
/* what the AI needs to know before it can write a prompt */
.needs { display: flex; flex-direction: column; gap: 5px; margin: 8px 0 12px; padding: 9px 11px; background: var(--surface-2); border-radius: 9px; }
.need { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--ink-2); }
.need-n { flex: none; width: 16px; height: 16px; border-radius: 5px; display: grid; place-items: center; background: var(--surface); color: var(--muted); font-size: 9.5px; font-weight: 700; }
/* the whole-board proposal — scannable rows, accepted in one click */
.prop { border: 1px solid var(--ai-border); border-radius: 12px; background: var(--surface); padding: 13px; }
.prop-h { font-size: 13px; color: var(--ink-2); }
.prop-h b { color: var(--ink); font-weight: 700; }
.prop-match { display: inline-flex; margin-top: 7px; padding: 2px 9px; border-radius: var(--r-pill); background: var(--ai-grad-soft); border: 1px solid var(--ai-border); color: var(--ai-ink); font-size: 10.5px; font-weight: 700; }
.prop-meta { margin-top: 7px; font-size: 11px; color: var(--muted); }
.prop-list { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; }
.prop-row { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); }
.prop-mod { flex: none; padding: 1px 7px; border-radius: 5px; background: var(--ai-soft); color: var(--ai-ink); font-size: 9.5px; font-weight: 700; letter-spacing: .2px; }
.prop-name { flex: 1; min-width: 0; font-size: 12px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prop-viz { flex: none; padding: 1px 7px; border-radius: 5px; border: 1px solid var(--ai-border); color: var(--ai-ink); font-size: 9.5px; font-weight: 700; }
.prop-acts { display: flex; flex-wrap: wrap; gap: 7px; }
.pact { height: 32px; padding: 0 13px; border: 1px solid var(--border); background: var(--surface); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--ink-2); }
.pact:hover { border-color: var(--ai); color: var(--ai-ink); background: var(--ai-softer); }
.pact.go { border: 1.5px solid transparent; background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--ai-grad-line) border-box; color: var(--ai-ink); }
/* the widget vocabulary — a small, clean palette rather than a form */
.wtypes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-bottom: 10px; }
.wtype { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 9px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); text-align: left; }
.wtype:hover { border-color: var(--ai-border); background: var(--ai-softer); }
.wtype.on { border-color: var(--ai); background: var(--ai-softer); }
.wt-l { font-size: 11.5px; font-weight: 600; color: var(--ink); }
.wt-h { font-size: 9.5px; color: var(--muted); line-height: 1.3; }
/* a tiny glyph that hints at each form, drawn in CSS so it costs nothing */
.wt-g { width: 26px; height: 16px; margin-bottom: 2px; opacity: .85; }
.wt-g.bar { background: linear-gradient(to top, var(--ai) 40%, transparent 40%), linear-gradient(to top, var(--ai) 70%, transparent 70%), linear-gradient(to top, var(--ai) 55%, transparent 55%); background-size: 6px 100%, 6px 100%, 6px 100%; background-position: 0 100%, 10px 100%, 20px 100%; background-repeat: no-repeat; }
.wt-g.hbar { background: linear-gradient(to right, var(--ai) 60%, transparent 60%), linear-gradient(to right, var(--ai) 90%, transparent 90%), linear-gradient(to right, var(--ai) 40%, transparent 40%); background-size: 100% 4px, 100% 4px, 100% 4px; background-position: 0 1px, 0 7px, 0 13px; background-repeat: no-repeat; }
.wt-g.line { background: linear-gradient(45deg, transparent 45%, var(--ai) 45%, var(--ai) 58%, transparent 58%); }
.wt-g.donut { width: 16px; height: 16px; border-radius: 50%; border: 4px solid var(--ai); }
.wt-g.kpi { font-size: 0; position: relative; }
.wt-g.kpi::after { content: '128'; font-size: 11px; font-weight: 700; color: var(--ai); letter-spacing: -.3px; }
/* a real table glyph reads better than anything drawable in CSS */
.wt-i { height: 16px; margin-bottom: 2px; color: var(--ai); display: grid; place-items: center; }
/* the configuration, spelled back after adding */
.cfg { margin-top: 11px; padding: 10px 12px; background: var(--surface-2); border-radius: 10px; display: flex; flex-direction: column; gap: 5px; }
.cfg-h { font-size: 10px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
.cfg-h.cond { margin-top: 7px; }
.cfg-r { display: flex; align-items: baseline; gap: 10px; font-size: 11.5px; }
.cfg-r span { flex: none; width: 74px; color: var(--muted); }
.cfg-r b { flex: 1; min-width: 0; color: var(--ink); font-weight: 600; }
/* chart-type preference pills sit tight under the preview */
.kindrow { margin-top: 9px; }
.wmeta { font-size: 11px; color: var(--muted); margin: -4px 0 9px; font-family: var(--mono, inherit); }
/* inline previews of what was just built */
.kpiprev { padding: 20px 14px; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.kpiprev b { font-size: 34px; font-weight: 500; letter-spacing: -1px; color: var(--ink); }
.kpiprev span { font-size: 11.5px; color: var(--muted); }
.tblprev { padding: 4px 10px 10px; overflow-x: auto; }
.tblprev table { width: 100%; font-size: 11px; }
.tblprev th { font-size: 9.5px; }
.tblprev td { padding: 5px 7px; }

/* ===== the question card (one per mandatory question) ===== */
.askc { border: 1px solid var(--ai-border); border-radius: 12px; background: var(--surface); box-shadow: var(--sh-sm); padding: 11px; display: flex; flex-direction: column; gap: 6px; }
.askc.done { background: var(--surface-2); border-color: var(--border); }
.ask-h { display: flex; align-items: flex-start; gap: 10px; padding: 1px 2px 6px; }
.ask-qs { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ask-q { font-size: 12.5px; font-weight: 700; color: var(--ink); line-height: 1.35; }
.ask-sub { font-size: 11px; color: var(--muted); }
.ask-step { flex: none; font-size: 10.5px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; }
.ask-opt { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: 1px solid var(--border); background: var(--surface); border-radius: 9px; padding: 8px 10px; }
.ask-opt:hover { border-color: var(--ai); background: var(--ai-softer); }
.ask-n { flex: none; width: 20px; height: 20px; border-radius: 5px; display: grid; place-items: center; background: var(--surface-2); color: var(--ink-2); font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ask-opt:hover .ask-n { background: var(--ai-grad); color: #fff; }
.ask-l { flex: 1; min-width: 0; font-size: 12.5px; color: var(--ink); }
.ask-arrow { color: var(--muted-2); flex: none; }
.ask-opt:hover .ask-arrow { color: var(--ai); }
.ask-foot { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.ask-other { flex: 1; min-width: 0; display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 10px; border: 1px dashed var(--border-strong); border-radius: 9px; color: var(--muted); }
.ask-other:focus-within { border-style: solid; border-color: var(--ai); background: var(--ai-softer); }
.ask-other input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 12px; color: var(--ink); }
.ask-skip { flex: none; height: 32px; padding: 0 13px; border: 1px solid var(--border); background: var(--surface); border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--ink-2); }
.ask-skip:hover { border-color: var(--ai); color: var(--ai-ink); }
.ask-answered { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ai-ink); }
.ask-answered :deep(.ico) { color: var(--green); }

.opts { display: flex; flex-direction: column; gap: 8px; }
.opt { display: flex; align-items: center; gap: 11px; text-align: left; border: 1px solid var(--ai-border); background: var(--ai-grad-soft); border-radius: 10px; padding: 11px 12px; }
.opt:hover { border-color: var(--ai); background: var(--ai-softer); }
.opt.sm { padding: 9px 11px; }
.opt-ic { width: 30px; height: 30px; border-radius: 8px; flex: none; display: grid; place-items: center; background: var(--ai-soft); color: var(--ai-ink); }
.opt > div { display: flex; flex-direction: column; }
.opt b { font-size: 13px; color: var(--ink); }
.opt > div > span { font-size: 11px; color: var(--muted); }
.formrow { display: flex; gap: 7px; align-items: center; margin-top: 4px; }
.fin { flex: 1; height: 34px; border: 1.5px solid var(--ai); border-radius: 8px; padding: 0 11px; font: inherit; font-size: 13px; color: var(--ink); background: var(--surface); box-shadow: 0 0 0 3px var(--ai-soft); }
.fin:focus { outline: none; }
.recap { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.recap > div { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; padding: 6px 9px; background: var(--surface-2); border-radius: 7px; }
.recap span { color: var(--muted); } .recap b { color: var(--ink); }
.picklist { display: flex; flex-direction: column; gap: 6px; }
.pick { display: inline-flex; align-items: center; gap: 8px; text-align: left; border: 1px solid var(--ai-border); background: var(--ai-grad-soft); border-radius: 8px; padding: 9px 11px; font-size: 12.5px; color: var(--ink); }
.pick:hover { border-color: var(--ai); background: var(--ai-softer); color: var(--ai-ink); }
.pick.new { color: var(--ai-ink); border-style: dashed; }
.sg.on { background: var(--ai-soft); border-color: var(--ai); color: var(--ai-ink); }
/* reasoning line */
.reasoning { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--muted); margin-bottom: 12px; }
.rz-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ai-grad); flex: none; }
/* grouped summary points */
.sum-grp { margin-bottom: 16px; }
.sum-gt { font-size: 12px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
.sum-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.sum-list li { position: relative; padding-left: 16px; font-size: 12.5px; line-height: 1.62; color: var(--ink-2); }
.sum-list li b { color: var(--ink); font-weight: 600; }
.sum-list li::before { content: ''; position: absolute; left: 3px; top: 8px; width: 5px; height: 5px; border-radius: 50%; background: var(--ai); }
/* status update — the subject line reads like an email header */
.subj { display: flex; align-items: baseline; gap: 9px; padding: 8px 11px; margin-bottom: 11px; background: var(--surface-2); border-radius: 9px; font-size: 12.5px; }
.subj span { flex: none; font-size: 10px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--muted); }
.subj b { color: var(--ink); font-weight: 600; }
/* ranked work queue */
.wq { display: flex; gap: 10px; padding: 9px 0; }
.wq + .wq { border-top: 1px solid var(--border); }
.wq-n { flex: none; width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #fff; background: var(--muted-2); }
.wq-n.bad { background: var(--red); } .wq-n.warn { background: var(--amber); } .wq-n.info { background: var(--blue); }
.wq-b { flex: 1; min-width: 0; }
.wq-t { font-size: 12.5px; font-weight: 500; color: var(--ink); line-height: 1.4; }
.wq-t b { font-weight: 600; }
.wq-w { font-size: 11.5px; color: var(--muted); margin-top: 3px; line-height: 1.45; }
.wq-b .lnk { margin-top: 5px; }
/* rate / copy — quiet until you reach for them */
.fb-row { display: flex; align-items: center; gap: 2px; margin-top: 10px; }
.fbtn { width: 26px; height: 26px; border: none; background: transparent; color: var(--muted-2); border-radius: 6px; display: grid; place-items: center; }
.fbtn:hover { background: var(--surface-2); color: var(--ink-2); }
.fbtn.on { color: var(--ai); background: var(--ai-softer); }
.fbtn.ok { color: var(--green); }
/* contextual Follow ups (ClickUp-style vertical rows) */
.fu-sec { margin-top: 16px; }
.fu-h { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
.fu-list { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
/* follow-ups stay monochrome — colour here competes with the answer above it */
.fu { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; text-align: left; border: 1px solid var(--border); background: var(--surface-2); border-radius: var(--r-pill); padding: 8px 14px; font-size: 12.5px; font-weight: 500; color: var(--ink-2); }
.fu .fu-arrow { color: var(--muted-2); transform: rotate(0deg); flex: none; }
.fu:hover { border-color: var(--border-strong); background: var(--surface); color: var(--ink); }
.fu:hover .fu-arrow { color: var(--ink-2); }
/* footer input */
.af { border-top: 1px solid var(--border); padding: 10px 14px 12px; }
/* command palette — compact: icon + name, sized to its content, not the panel */
.actpop.cmdpop { width: max-content; min-width: 168px; max-width: 230px; padding: 5px; }
.cmditem { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; border: none; background: transparent; border-radius: 7px; padding: 7px 9px; cursor: pointer; }
.cmditem :deep(.ico) { color: var(--muted); flex: none; }
.cmditem.sel { background: var(--ai-softer); }
.cmditem.sel :deep(.ico) { color: var(--ai); }
.cmd-l { font-size: 12.5px; font-weight: 500; color: var(--ink); }
.cmditem.sel .cmd-l { color: var(--ai-ink); font-weight: 600; }
.cmd-none { padding: 9px; font-size: 12px; color: var(--muted); white-space: nowrap; }
.actpop { border: 1px solid var(--ai-border); border-radius: var(--r); background: var(--surface); box-shadow: var(--sh-pop); padding: 8px; margin-bottom: 9px; }
.actpop-enter-active, .actpop-leave-active { transition: opacity .18s ease, transform .18s ease; }
.actpop-enter-from, .actpop-leave-to { opacity: 0; transform: translateY(8px); }
.actpop-h { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; color: var(--muted); padding: 4px 6px 8px; }
.actpop-h :deep(.ico) { color: var(--ai); }
.apx { margin-left: auto; border: none; background: transparent; color: var(--muted); display: grid; place-items: center; padding: 2px; border-radius: 5px; }
.apx:hover { background: var(--surface-2); color: var(--ink); }
.actprompt { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; border: none; background: transparent; border-radius: 7px; padding: 8px 8px; font-size: 12.5px; color: var(--ink); }
.actprompt :deep(.ico) { color: var(--muted-2); flex: none; }
.actprompt:hover, .actprompt.sel { background: var(--ai-softer); color: var(--ai-ink); }
.actprompt:hover :deep(.ico), .actprompt.sel :deep(.ico) { color: var(--ai); }
.chipsrow { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 9px; }
.sg { border: 1px solid var(--ai-border); background: var(--ai-grad-soft); border-radius: var(--r-pill); padding: 5px 11px; font-size: 11.5px; color: var(--ink-2); }
/* minimal suggestive actions — plain outline; the AI accent only on hover */
.chipsrow.mini { gap: 6px; margin-bottom: 6px; }
.chipsrow.mini .sg { background: transparent; border-color: var(--border); color: var(--ink-2); font-size: 11.5px; padding: 5px 11px; font-weight: 500; text-align: left; }
.chipsrow.mini .sg:hover { border-color: var(--ai); background: var(--ai-softer); color: var(--ai-ink); }
.chipsrow.mini .sg.go { border-color: var(--ai); color: var(--ai-ink); font-weight: 600; }
.sg:hover { border-color: var(--primary); background: var(--primary-softer); color: var(--primary-700); }
/* composer — a light sweep rides the top edge so the field reads as "live" */
.inbox { position: relative; display: flex; align-items: center; gap: 6px; min-height: 46px; border: 1px solid var(--ai-border); border-radius: 12px; padding: 6px 6px 6px 7px; background: var(--surface); }
.inbox::before {
  content: ''; position: absolute; top: -1px; left: 18%; right: 18%; height: 2px; border-radius: 2px;
  background: var(--ai-grad); filter: blur(2.5px); pointer-events: none;
  animation: sweep 3.4s ease-in-out infinite;
}
@keyframes sweep { 0%, 100% { opacity: .18; transform: scaleX(.55); } 50% { opacity: .9; transform: scaleX(1); } }
.inbox:focus-within { border-color: var(--ai); box-shadow: 0 0 0 3px var(--ai-soft); }
.inbox:focus-within::before { opacity: 1; animation: none; }
.plusbtn { width: 32px; height: 32px; border: 1px solid var(--border); background: var(--surface); color: var(--ink-2); border-radius: 50%; display: grid; place-items: center; flex: none; transition: border-color .14s, background .14s, color .14s; }
.plusbtn:hover, .plusbtn.on { border-color: var(--ai); background: var(--ai-softer); color: var(--ai-ink); }
/* the picked command sits in the field as a chip, ahead of what you type */
.cmdchip { display: inline-flex; align-items: center; gap: 5px; flex: none; height: 24px; padding: 0 5px 0 9px; border-radius: var(--r-pill); background: var(--ai-grad-soft); border: 1px solid var(--ai-border); color: var(--ai-ink); font-size: 11.5px; font-weight: 600; }
.cmdchip :deep(.ico) { color: var(--ai); }
.ccx { border: none; background: transparent; color: var(--ai-ink); display: grid; place-items: center; padding: 2px; border-radius: 4px; opacity: .65; }
.ccx:hover { opacity: 1; background: var(--ai-soft); }
@media (prefers-reduced-motion: reduce) { .inbox::before { animation: none; opacity: .5; } }
.inbox input { flex: 1; border: none; outline: none; background: transparent; font-size: 13px; font-family: inherit; color: var(--ink); }
.send { width: 32px; height: 32px; border: none; border-radius: 8px; background: var(--surface-2); color: var(--muted); display: grid; place-items: center; flex: none; transition: background .14s, color .14s; }
.send.ready { background: var(--ai-grad); color: #fff; }

/* greeting empty state */
.empty-ai { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 30px 18px 12px; }
.ea-orb :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; margin-bottom: 12px; }
.empty-ai h3 { font-size: 20px; font-weight: 600; margin: 4px 0 8px; color: var(--ink); letter-spacing: -.2px; }
.empty-ai p { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0 0 20px; max-width: 300px; }
.ea-ctas { display: flex; flex-direction: column; gap: 9px; width: 100%; }
.ea-cta { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 14px; border: none; border-radius: 10px; background: var(--ai-grad-soft); color: var(--ink); font-weight: 500; font-size: 13px; text-align: left; }
.ea-cta :deep(.ico) { color: var(--ai); flex: none; }
.ea-cta:hover { background: var(--ai-soft); }
/* same option style reused at creation time; starters wrap since they're sentences */
.ea-ctas.starters { margin: 10px 0 6px; gap: 8px; }
.ea-cta.wrap { height: auto; min-height: 44px; padding: 11px 14px; line-height: 1.4; align-items: flex-start; }
.ea-cta.wrap :deep(.ico) { margin-top: 1px; }

/* suggested next actions */
.na-h { font-size: 10.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--muted); margin: 13px 0 8px; }
.na-row .sg { background: var(--ai-grad-soft); border: 1px solid var(--ai-border); color: var(--ai-ink); }
.na-row .sg:hover { background: var(--ai-soft); border-color: var(--ai); color: var(--ai-ink); }
.grounded { display: flex; align-items: center; gap: 5px; margin-top: 8px; font-size: 10.5px; color: var(--muted); }
</style>
