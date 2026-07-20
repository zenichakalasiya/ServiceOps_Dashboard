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
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import { facts as computeFacts, confidence, anomalyFor, drillFor, drillNarrative, changesSinceLastVisit, dashboardSummaryPoints, FRESHNESS } from '../../data/aiEngine.js'
import { routeIntent, tileFromText, factFromText, specFromText, SUGGESTIONS, KINDS } from '../../data/aiAssistant.js'
import { useRouter } from 'vue-router'
import { store, toast, createDashboard } from '../../store/index.js'
import { chart, uid } from '../../data/mock.js'

const props = defineProps({ board: Object, role: String, open: Boolean })
const emit = defineEmits(['update:open', 'role', 'cite'])
const router = useRouter()

const thread = ref([])
const input = ref('')
const pending = ref(null)      // { block, action }
const bodyEl = ref(null)
let bid = 0

function scrollDown() { nextTick(() => { if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight }) }

// ---- block builders ----
function pushSummary() {
  thread.value.push({ id: ++bid, kind: 'summary', facts: computeFacts(props.board, props.role), conf: confidence(props.board) })
  scrollDown()
}
function pushUser(text) { thread.value.push({ id: ++bid, kind: 'user', text }); scrollDown() }
function pushExplain(text) {
  const tile = tileFromText(props.board, text)
  thread.value.push({ id: ++bid, kind: 'explain', tile, anomaly: anomalyFor(tile) })
  scrollDown()
}
// Spotlight the real tile on the dashboard (scroll + flash) instead of dumping a table.
function highlightWidget(fact) {
  const t = fact && props.board.tiles.find((x) => x.id === fact.tileId)
  store.ui.aiHighlight = t ? t.title : null
}
function pushDrill(text, factObj) {
  const fact = factObj || factFromText(props.board, text)
  const drill = drillFor(props.board, fact)
  const widget = props.board.tiles.find((x) => x.id === fact.tileId)?.title || drill.sourceTitle
  highlightWidget(fact)
  // Investigate now answers in WRITTEN prose + 3 suggested actions — no records table.
  thread.value.push({ id: ++bid, kind: 'drill', fact, widget, narrative: drillNarrative(props.board, fact), actions: drill.actions.slice(0, 3) })
  scrollDown()
}
function pushWidget(text) {
  const spec = specFromText(text)
  thread.value.push({ id: ++bid, kind: 'widget', spec, recommendedKind: spec.kind, added: false })
  scrollDown()
}
function pushChanges() {
  thread.value.push({ id: ++bid, kind: 'changes', data: changesSinceLastVisit(props.board) })
  scrollDown()
}
// Summarize / Ask: a visible analyzing/thinking state, then a WRITTEN prose summary.
// Mutate the REACTIVE array element (not the raw object we pushed) so the reveal re-renders.
function pushAnalyzing() {
  thread.value.push({ id: ++bid, kind: 'analyzing', phase: 'thinking', points: [] })
  const b = thread.value[thread.value.length - 1]
  scrollDown()
  setTimeout(() => { b.phase = 'done'; b.points = dashboardSummaryPoints(props.board, props.role); scrollDown() }, 1700)
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
function push(kind, extra = {}) { thread.value.push({ id: ++bid, kind, ...extra }); scrollDown(); return thread.value[thread.value.length - 1] }
const VIS = [{ v: 'public', label: 'Public — everyone' }, { v: 'private', label: 'Private — just me' }, { v: 'restricted', label: 'Restricted — chosen people' }]
const visLabel = (v) => VIS.find((x) => x.v === v)?.label || v
const otherBoards = () => store.dashboards.filter((d) => !d.archived)

function pushCreateStart() {
  // Generate-with-AI leads with the create flow — drop a lone auto-summary/preamble.
  if (thread.value.every((b) => b.kind === 'summary' || b.kind === 'user')) thread.value = []
  draft.value = {}; push('create-start')
}
// dashboard path
function startDash() { draft.value = { mode: 'dash' }; push('cd-name', { name: '' }) }
function dashName(b) { const n = (b.name || '').trim(); if (!n) return; draft.value.name = n; pushUser(n); push('cd-cat') }
function dashCat(cat) { draft.value.category = cat; pushUser(cat); push('cd-vis') }
function dashVis(v) { draft.value.access = v; pushUser(visLabel(v)); push('cd-confirm') }
function dashCreate() {
  const d = createDashboard({ name: draft.value.name, access: draft.value.access, category: draft.value.category, description: 'Created with ServiceOps AI' })
  // if we came here to place a widget, continue straight into the widget step on the new board
  if (draft.value.thenWidget) { draft.value.dash = d; draft.value.mode = 'widget'; push('cw-desc', { text: '' }) }
  else push('cd-done', { dash: d })
}
function openBoard(d) { emit('update:open', false); router.push(`/dashboard/${d.id}`) }
// widget path
function startWidget() { draft.value = { mode: 'widget' }; push('cw-dash') }
function widgetDash(d) {
  if (!d) { pushUser('A new dashboard first'); draft.value.mode = 'dash'; draft.value.thenWidget = true; push('cd-name', { name: '' }); return }
  draft.value.dash = d; pushUser(d.name); push('cw-desc', { text: '' })
}
function widgetDesc(b) { const t = (b.text || '').trim(); if (!t) return; pushUser(t); push('cw-preview', { spec: specFromText(t), group: '', newGroup: '', added: false }) }
function widgetSuggest(b, s) { b.text = s; widgetDesc(b) }
function setSpecKind(b, id) { b.spec.chart.kind = id; b.spec.kind = id }
function removeSpecChip2(b, i) { b.spec.chips.splice(i, 1) }
function widgetAdd(b) {
  const d = draft.value.dash
  const tile = chart(b.spec.title, b.spec.chart, 'Created with ServiceOps AI'); tile.prov = 'user'
  if (b.group === '__new' && (b.newGroup || '').trim()) {
    if (!d.groups) d.groups = []
    const g = { id: uid('g'), name: b.newGroup.trim(), collapsed: false }; d.groups.push(g); tile.group = g.id
  } else if (b.group && b.group !== '__new') tile.group = b.group
  d.tiles.push(tile); d.updated = new Date().toISOString()
  b.added = true
  toast(`Added “${b.spec.title}” to ${d.name}`, 'success'); scrollDown()
}

function dispatch(intent, text) {
  if (intent === 'summary') pushSummary()
  else if (intent === 'explain') pushExplain(text)
  else if (intent === 'drill') pushDrill(text)
  else if (intent === 'create') pushWidget(text)
  else if (intent === 'changes') pushChanges()
  else if (intent === 'analyzing') pushAnalyzing()
  else if (intent === 'createstart') pushCreateStart()
  else if (intent === 'note') pushNote(text)
}

// ---- contextual Follow ups (change with the block / what the user asked) ----
const CREATE_FLOW_KINDS = ['create-start', 'cd-name', 'cd-cat', 'cd-vis', 'cd-confirm', 'cd-done', 'cw-dash', 'cw-desc', 'cw-preview']
function isAnswer(b) {
  if (b.kind === 'user' || CREATE_FLOW_KINDS.includes(b.kind)) return false
  if (b.kind === 'analyzing') return b.phase === 'done'
  return true
}
function followUpsFor(b) {
  const k = b.kind
  if (k === 'analyzing' || k === 'summary') return [
    { label: 'Prioritize what needs attention', intent: 'drill' },
    { label: 'What changed since last visit', intent: 'changes' },
    { label: 'Create a widget for SLA breaches by team', intent: 'create' },
  ]
  if (k === 'changes') return [
    { label: 'Show the new P1 requests', intent: 'drill' },
    { label: 'Why did Overdue rise?', intent: 'explain' },
    { label: 'Turn this into a recovery plan', intent: 'drill' },
  ]
  if (k === 'explain') return [
    { label: `Show the records behind ${b.tile?.title || 'this'}`, intent: 'drill' },
    { label: 'Investigate the top offenders', intent: 'drill' },
    { label: 'Create an alert for this metric', intent: 'note' },
  ]
  if (k === 'drill') return [
    { label: 'Draft a status update', intent: 'summary' },
    { label: 'What changed since last visit', intent: 'changes' },
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

// ---- action bar (Find / Create / Edit / Analyze / Prioritize / Schedule) ----
const ACTIONS = [
  { key: 'find', label: 'Find', icon: 'search', prompts: [
    { label: 'Find tickets breaching SLA today', intent: 'drill' },
    { label: 'Find the P1 requests assigned to me', intent: 'drill' },
    { label: 'Search this dashboard for Overdue', intent: 'explain' },
    { label: 'Find what changed since last visit', intent: 'changes' },
  ] },
  { key: 'create', label: 'Create', icon: 'plus', prompts: [
    { label: 'Create a widget for SLA breaches by team', intent: 'create' },
    { label: 'Create a backlog trend chart', intent: 'create' },
    { label: 'Create a new dashboard', intent: 'createstart' },
    { label: 'Generate a widget from a description', intent: 'createstart' },
  ] },
  { key: 'edit', label: 'Edit', icon: 'edit', prompts: [
    { label: 'Change a chart’s type to line', intent: 'note' },
    { label: 'Group the KPI widgets together', intent: 'note' },
    { label: 'Edit the dashboard time filter', intent: 'note' },
  ] },
  { key: 'analyze', label: 'Analyze', icon: 'auto-graph', prompts: [
    { label: 'Analyze what needs attention', intent: 'summary' },
    { label: 'Why did Overdue spike?', intent: 'explain' },
    { label: 'What changed since last visit', intent: 'changes' },
    { label: 'Summarize this dashboard', intent: 'analyzing' },
  ] },
  { key: 'prioritize', label: 'Prioritize', icon: 'flag', prompts: [
    { label: 'Prioritize the P1s breaching today', intent: 'drill' },
    { label: 'Rank overdue tickets by impact', intent: 'drill' },
    { label: 'What should I work on first?', intent: 'summary' },
  ] },
  { key: 'schedule', label: 'Schedule', icon: 'calendar2', prompts: [
    { label: 'Schedule a daily summary email', intent: 'note' },
    { label: 'Block time to clear overdue work', intent: 'note' },
    { label: 'Alert me when P1 backlog exceeds 10', intent: 'note' },
  ] },
]
const actionOpen = ref(null)
const activeAction = computed(() => ACTIONS.find((a) => a.key === actionOpen.value) || null)
function toggleAction(k) { actionOpen.value = actionOpen.value === k ? null : k }
function runPrompt(p) { actionOpen.value = null; pushUser(p.label); dispatch(p.intent, p.label) }

// ---- interactions ----
function submit() {
  const text = input.value.trim(); if (!text) return
  input.value = ''
  pushUser(text)
  dispatch(routeIntent(text), text)
}
function suggest(s) { pushUser(s.label); dispatch(s.intent, s.label) }
// One action per fact: Investigate → spotlight the widget + a written briefing + 3 actions
// (the "why" is folded into the narrative, so a separate Explain link is no longer needed).
function investigate(fact) { pushUser(`Investigate: ${fact.chip}`); pushDrill(fact.chip, fact) }

// drill block: written narrative + up to 3 actions (no records table)
function runAction() { const a = pending.value.action; pending.value = null; toast(`${a.label} — done`, a.danger === false ? 'success' : 'warn') }

// widget block: editable chips + type + add
function removeSpecChip(b, i) { b.spec.chips.splice(i, 1) }
function setKind(b, id) { b.spec.chart.kind = id }
function addWidget(b) { b.added = true; toast(`Added “${b.spec.title}” to the dashboard`, 'success') }

// explain block sparkline
function spark(a) {
  const h = [...(a.history || []), a.value]; const W = 260, H = 42, pad = 4
  const min = Math.min(...h), max = Math.max(...h), span = max - min || 1
  const x = (i) => pad + (i * (W - pad * 2)) / (h.length - 1)
  const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2)
  return { W, H, line: 'M' + h.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L'), last: { x: x(h.length - 1), y: y(a.value) }, meanY: y(a.mean) }
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
      <button class="x" @click="emit('update:open', false)"><Icon name="x" :size="17" /></button>
    </div>

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

        <!-- P1 summary -->
        <template v-else-if="b.kind === 'summary'">
          <div class="blk-h"><Icon name="sparkles" :size="14" /> What needs attention <span class="updated">updated {{ FRESHNESS }}</span></div>
          <div class="facts">
            <div v-for="f in b.facts" :key="f.id" class="fact" @mouseenter="emit('cite', f.tileId)" @mouseleave="emit('cite', null)">
              <span class="dot" :class="dotClass(f.severity)" />
              <div class="fb">
                <div class="ftext">{{ f.text }}</div>
                <div class="fmeta">
                  <span class="cite"><Icon name="chart-bar" :size="11" /> {{ f.chip }}</span>
                  <button class="lnk" @click="investigate(f)">Investigate →</button>
                </div>
              </div>
            </div>
            <div v-if="!b.facts.length" class="calm"><Icon name="check" :size="16" /> Nothing unusual — all {{ board.tiles.length }} widgets are within range.</div>
          </div>
        </template>

        <!-- What changed since last visit — light-tinted cards, one per moved metric -->
        <template v-else-if="b.kind === 'changes'">
          <div class="blk-h"><Icon name="history" :size="14" /> What changed since your last visit</div>
          <div class="lastvisit"><Icon name="clock" :size="12" /> Last visit: {{ b.data.lastVisit }}</div>
          <div class="chg-grid">
            <div v-for="(it, i) in b.data.items" :key="i" class="chgc" :class="[it.severity, { hasnote: it.note }]" :title="it.note || null">
              <div class="chgc-top">
                <span class="chgc-ico" :class="it.dir"><Icon :name="it.dir === 'down' ? 'sort-desc' : 'sort-asc'" :size="13" /></span>
                <span class="chgc-delta" :class="it.dir">{{ it.delta }}</span>
              </div>
              <div class="chgc-name">{{ it.widget }}</div>
              <div class="chgc-val">Now <b>{{ it.value }}</b></div>
            </div>
          </div>
        </template>

        <!-- Summarize / Ask about this dashboard — analyzing → written summary -->
        <template v-else-if="b.kind === 'analyzing'">
          <template v-if="b.phase === 'thinking'">
            <div class="an-loading">
              <span class="an-orb"><Icon name="sparkles" :size="16" /></span>
              <span class="an-txt">Analyzing this dashboard<span class="an-dots"><i /><i /><i /></span></span>
            </div>
            <div class="an-steps">
              <div class="an-step"><span class="asd" /> Reading {{ board.tiles.length }} widgets</div>
              <div class="an-step"><span class="asd" /> Checking SLA, backlog and anomaly signals</div>
              <div class="an-step"><span class="asd" /> Writing a plain-language summary</div>
            </div>
          </template>
          <template v-else>
            <div class="reasoning"><span class="rz-dot" /> Reasoning · read {{ board.tiles.length }} widgets and ranked what matters</div>
            <div class="blk-h"><Icon name="sparkles" :size="14" /> Dashboard summary</div>
            <div v-for="(g, gi) in b.points" :key="gi" class="sum-grp">
              <div class="sum-gt">{{ g.title }}</div>
              <ul class="sum-list"><li v-for="(p, pi) in g.points" :key="pi">{{ p }}</li></ul>
            </div>
          </template>
        </template>

        <!-- P3 explain -->
        <template v-else-if="b.kind === 'explain'">
          <div class="blk-h" :class="b.anomaly ? b.anomaly.severity : ''">
            <Icon :name="b.anomaly ? 'alert' : 'info'" :size="14" /> {{ b.tile.title }}
          </div>
          <p class="say">{{ b.anomaly ? b.anomaly.text : `${b.tile.title} is ${b.tile.value}${b.tile.unit || ''}${b.tile.delta ? `, ${b.tile.delta.dir} ${b.tile.delta.pct}% vs last week` : ''} — within its normal range, not an anomaly.` }}</p>
          <div v-if="b.anomaly" class="spark">
            <svg :viewBox="`0 0 ${spark(b.anomaly).W} ${spark(b.anomaly).H}`" preserveAspectRatio="none">
              <line :x1="0" :x2="spark(b.anomaly).W" :y1="spark(b.anomaly).meanY" :y2="spark(b.anomaly).meanY" class="mean" />
              <path :d="spark(b.anomaly).line" class="sl" />
              <circle :cx="spark(b.anomaly).last.x" :cy="spark(b.anomaly).last.y" r="3.2" :class="'pt ' + b.anomaly.severity" />
            </svg>
          </div>
          <details v-if="b.anomaly" class="how"><summary><Icon name="info" :size="12" /> How was this calculated?</summary><div>{{ b.anomaly.how }}</div></details>
          <button class="mini-cta" @click="investigate({ kind: 'anomaly', chip: b.tile.title })">Investigate <Icon name="chevron-right" :size="13" /></button>
        </template>

        <!-- P2 drill — written briefing + spotlight the widget + 3 suggested actions (no table) -->
        <template v-else-if="b.kind === 'drill'">
          <div class="blk-h"><Icon name="insights" :size="14" /> {{ b.fact.text }}</div>
          <div v-if="b.widget" class="spot"><Icon name="target" :size="12" /> Spotlighted <b>“{{ b.widget }}”</b> on the dashboard</div>
          <p v-for="(line, i) in b.narrative" :key="i" class="say">{{ line }}</p>
          <div class="sub-h">Suggested actions <span class="muted">confirmed, never automatic</span></div>
          <div class="acts">
            <button v-for="a in b.actions" :key="a.id" class="act" @click="pending = { block: b, action: a }">
              <span class="aic"><Icon :name="a.icon" :size="14" /></span><span class="al">{{ a.label }}</span><Icon name="chevron-right" :size="14" class="ac" />
            </button>
          </div>
        </template>

        <!-- P4 build -->
        <template v-else-if="b.kind === 'widget'">
          <div class="blk-h"><Icon name="wand" :size="14" /> Generated widget</div>
          <div class="wprev">
            <div class="wp-h"><b>{{ b.spec.title }}</b><span class="pv">Preview</span></div>
            <ChartTile :chart="b.spec.chart" :legend="true" :height="150" />
          </div>
          <div class="sub-h">Filter <span class="muted">editable</span></div>
          <div class="chips">
            <span v-for="(c, i) in b.spec.chips" :key="i" class="dchip">
              <b>{{ c.field }}</b><span v-if="c.op" class="op">{{ c.op }}</span> {{ c.value }}
              <button class="cx" @click="removeSpecChip(b, i)"><Icon name="x" :size="11" /></button>
            </span>
          </div>
          <div class="sub-h">Chart type</div>
          <div class="kinds">
            <button v-for="k in KINDS" :key="k.id" class="kind" :class="{ on: b.spec.chart.kind === k.id }" @click="setKind(b, k.id)">
              <Icon :name="k.icon" :size="14" /> {{ k.label }}<span v-if="k.id === b.recommendedKind" class="rec">✓</span>
            </button>
          </div>
          <p class="why"><Icon name="bulb" :size="12" /> {{ b.spec.why }}</p>
          <button class="add" :disabled="b.added" @click="addWidget(b)">
            <Icon :name="b.added ? 'check' : 'plus'" :size="14" /> {{ b.added ? 'Added to dashboard' : 'Add to dashboard' }}
          </button>
        </template>

        <!-- ===== Generate with AI: conversational create flow ===== -->
        <template v-else-if="b.kind === 'create-start'">
          <div class="blk-h"><Icon name="wand" :size="14" /> Generate with AI</div>
          <p class="say">What would you like to create? I'll set it up step by step.</p>
          <div class="opts">
            <button class="opt" @click="startDash"><span class="opt-ic"><Icon name="layout" :size="16" /></span><div><b>A new dashboard</b><span>Name it, pick a category and who can see it</span></div></button>
            <button class="opt" @click="startWidget"><span class="opt-ic"><Icon name="chart-bar" :size="16" /></span><div><b>A new widget</b><span>Describe it — I'll build it and place it</span></div></button>
          </div>
        </template>

        <!-- dashboard: name -->
        <template v-else-if="b.kind === 'cd-name'">
          <div class="blk-h"><Icon name="layout" :size="14" /> New dashboard</div>
          <p class="say">What should we call it?</p>
          <div class="formrow">
            <input class="fin" v-model="b.name" placeholder="e.g. Network Operations" @keyup.enter="dashName(b)" />
            <button class="mini-cta" :disabled="!b.name.trim()" @click="dashName(b)">Continue <Icon name="chevron-right" :size="13" /></button>
          </div>
        </template>
        <!-- dashboard: category -->
        <template v-else-if="b.kind === 'cd-cat'">
          <p class="say">Which category should it live under?</p>
          <div class="chipsrow">
            <button v-for="c in store.categories.slice(0, 6)" :key="c" class="sg" @click="dashCat(c)">{{ c }}</button>
          </div>
        </template>
        <!-- dashboard: visibility -->
        <template v-else-if="b.kind === 'cd-vis'">
          <p class="say">Who can see it?</p>
          <div class="opts">
            <button v-for="o in VIS" :key="o.v" class="opt sm" @click="dashVis(o.v)">
              <span class="opt-ic"><Icon :name="o.v === 'public' ? 'globe' : o.v === 'private' ? 'lock' : 'users'" :size="15" /></span><b>{{ o.label }}</b>
            </button>
          </div>
        </template>
        <!-- dashboard: confirm -->
        <template v-else-if="b.kind === 'cd-confirm'">
          <div class="blk-h"><Icon name="check" :size="14" /> Ready to create</div>
          <div class="recap">
            <div><span>Name</span><b>{{ draft.name }}</b></div>
            <div><span>Category</span><b>{{ draft.category }}</b></div>
            <div><span>Visibility</span><b>{{ visLabel(draft.access) }}</b></div>
          </div>
          <button class="add" @click="dashCreate"><Icon name="sparkles" :size="14" /> Create dashboard</button>
        </template>
        <!-- dashboard: done -->
        <template v-else-if="b.kind === 'cd-done'">
          <div class="calm"><Icon name="check" :size="16" /> Created “{{ b.dash.name }}”.</div>
          <button class="mini-cta" @click="openBoard(b.dash)">Open it <Icon name="open-in" :size="13" /></button>
        </template>

        <!-- widget: pick dashboard -->
        <template v-else-if="b.kind === 'cw-dash'">
          <div class="blk-h"><Icon name="chart-bar" :size="14" /> New widget</div>
          <p class="say">Which dashboard should it go on?</p>
          <div class="picklist">
            <button v-for="d in otherBoards().slice(0, 5)" :key="d.id" class="pick" @click="widgetDash(d)"><Icon name="layout" :size="14" /> {{ d.name }}</button>
            <button class="pick new" @click="widgetDash(null)"><Icon name="plus" :size="14" /> A new dashboard first</button>
          </div>
        </template>
        <!-- widget: describe -->
        <template v-else-if="b.kind === 'cw-desc'">
          <p class="say">What should the widget show{{ draft.dash ? ` on “${draft.dash.name}”` : '' }}?</p>
          <div class="formrow">
            <input class="fin" v-model="b.text" placeholder="e.g. SLA breaches this week by team" @keyup.enter="widgetDesc(b)" />
            <button class="mini-cta" :disabled="!b.text.trim()" @click="widgetDesc(b)">Build <Icon name="chevron-right" :size="13" /></button>
          </div>
          <div class="chipsrow">
            <button class="sg" @click="widgetSuggest(b, 'SLA breaches this week by team')">SLA breaches by team</button>
            <button class="sg" @click="widgetSuggest(b, 'Backlog trend last 6 months')">Backlog trend</button>
            <button class="sg" @click="widgetSuggest(b, 'Open tickets by priority')">By priority</button>
          </div>
        </template>
        <!-- widget: preview + config -->
        <template v-else-if="b.kind === 'cw-preview'">
          <div class="blk-h"><Icon name="wand" :size="14" /> Live preview</div>
          <div class="wprev">
            <div class="wp-h"><b>{{ b.spec.title }}</b><span class="pv">Preview</span></div>
            <ChartTile :chart="b.spec.chart" :legend="true" :height="150" />
          </div>
          <div class="sub-h">Filter <span class="muted">editable</span></div>
          <div class="chips">
            <span v-for="(c, i) in b.spec.chips" :key="i" class="dchip"><b>{{ c.field }}</b><span v-if="c.op" class="op">{{ c.op }}</span> {{ c.value }}<button class="cx" @click="removeSpecChip2(b, i)"><Icon name="x" :size="11" /></button></span>
          </div>
          <div class="sub-h">Chart type</div>
          <div class="kinds">
            <button v-for="k in KINDS" :key="k.id" class="kind" :class="{ on: b.spec.chart.kind === k.id }" @click="setSpecKind(b, k.id)"><Icon :name="k.icon" :size="14" /> {{ k.label }}</button>
          </div>
          <div class="sub-h">Group</div>
          <div class="chipsrow">
            <button class="sg" :class="{ on: b.group === '' }" @click="b.group = ''">No group</button>
            <button v-for="g in (draft.dash?.groups || [])" :key="g.id" class="sg" :class="{ on: b.group === g.id }" @click="b.group = g.id">{{ g.name }}</button>
            <button class="sg" :class="{ on: b.group === '__new' }" @click="b.group = '__new'">＋ New group</button>
          </div>
          <input v-if="b.group === '__new'" class="fin" v-model="b.newGroup" placeholder="New group name" />
          <button class="add" :disabled="b.added" @click="widgetAdd(b)">
            <Icon :name="b.added ? 'check' : 'plus'" :size="14" /> {{ b.added ? `Added to ${draft.dash.name}` : `Add to ${draft.dash?.name || 'dashboard'}` }}
          </button>
          <button v-if="b.added && draft.dash" class="mini-cta" @click="openBoard(draft.dash)">Open the dashboard <Icon name="open-in" :size="13" /></button>
        </template>

        <!-- short templated reply (edit / schedule) -->
        <template v-else-if="b.kind === 'note'">
          <div class="blk-h"><Icon name="sparkles" :size="14" /> ServiceOps AI</div>
          <p class="say">{{ b.text }}</p>
        </template>

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

    <!-- action bar + popup (opens ABOVE the chips), then the chat input -->
    <div class="af">
      <transition name="actpop">
        <div v-if="activeAction" class="actpop">
          <div class="actpop-h"><Icon :name="activeAction.icon" :size="14" /> {{ activeAction.label }}<button class="apx" @click="actionOpen = null"><Icon name="x" :size="14" /></button></div>
          <button v-for="p in activeAction.prompts" :key="p.label" class="actprompt" @click="runPrompt(p)">
            <Icon :name="activeAction.icon" :size="14" /> {{ p.label }}
          </button>
        </div>
      </transition>
      <div class="actionbar">
        <button v-for="a in ACTIONS" :key="a.key" class="actchip" :class="{ on: actionOpen === a.key }" @click="toggleAction(a.key)">
          <Icon :name="a.icon" :size="14" /> {{ a.label }}
        </button>
      </div>
      <div class="inbox">
        <button class="attach" title="Attach"><Icon name="attach" :size="16" /></button>
        <input v-model="input" placeholder="Type your message…" @keyup.enter="submit" />
        <button class="send" :class="{ ready: input.trim() }" :disabled="!input.trim()" @click="submit"><Icon name="send" :size="15" /></button>
      </div>
    </div>

    <ConfirmDialog v-if="pending" :title="pending.action.label" :message="pending.action.confirm"
      :confirm-label="pending.action.label" :danger="pending.action.danger !== false"
      @confirm="runAction" @cancel="pending = null" />
  </aside>
</template>

<style scoped>
.asst { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.ah { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px; border-bottom: 1px solid var(--border); }
.ah-l { display: flex; gap: 10px; align-items: center; }
.spk { width: 32px; height: 32px; border-radius: 9px; flex: none; display: grid; place-items: center; background: var(--ai-grad); color: #fff; }
.ah-t { font-weight: 600; font-size: 15px; }
.ah-sub { font-size: 11.5px; color: var(--muted); }
.x { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; padding: 3px; border-radius: 7px; }
.x:hover { background: var(--surface-2); color: var(--ink); }

.ab { flex: 1; overflow: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 14px; }
.blk { animation: rise .2s ease both; }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .blk { animation: none; } }
.user { display: flex; justify-content: flex-end; }
.user span { background: var(--surface-2); color: var(--ink); font-size: 12.5px; font-weight: 500; padding: 8px 13px; border-radius: 13px 13px 3px 13px; max-width: 85%; }
.blk-h { display: flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13px; margin-bottom: 9px; }
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
.ftext { font-size: 12.5px; font-weight: 500; line-height: 1.35; }
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
/* ask → analyzing (renamed so it can't collide with the .blk.analyzing wrapper class) */
.an-loading { display: flex; align-items: center; gap: 10px; padding: 4px 0 12px; }
.narr { font-size: 13px; line-height: 1.6; color: var(--ink-2); }
.an-orb { width: 30px; height: 30px; border-radius: 9px; flex: none; display: grid; place-items: center; background: var(--ai-grad); color: #fff; animation: orbpulse 1.2s ease-in-out infinite; }
@keyframes orbpulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,.4); } 50% { box-shadow: 0 0 0 7px rgba(139,92,246,0); } }
.an-txt { font-size: 13px; font-weight: 600; color: var(--ink); display: inline-flex; align-items: baseline; }
.an-dots { display: inline-flex; gap: 2px; margin-left: 3px; }
.an-dots i { width: 3px; height: 3px; border-radius: 50%; background: var(--ai); align-self: flex-end; margin-bottom: 3px; animation: andot 1.2s infinite; }
.an-dots i:nth-child(2) { animation-delay: .2s; } .an-dots i:nth-child(3) { animation-delay: .4s; }
@keyframes andot { 0%, 60%, 100% { opacity: .2; } 30% { opacity: 1; } }
.an-steps { display: flex; flex-direction: column; gap: 8px; }
.an-step { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.asd { width: 6px; height: 6px; border-radius: 50%; background: var(--ai); flex: none; animation: andot 1.4s infinite; }
.an-step:nth-child(2) .asd { animation-delay: .3s; } .an-step:nth-child(3) .asd { animation-delay: .6s; }
@media (prefers-reduced-motion: reduce) { .an-orb, .an-dots i, .asd { animation: none; } }
/* explain */
.say { margin: 0 0 9px; font-size: 12.5px; line-height: 1.5; color: var(--ink-2); }
.say:first-of-type { color: var(--ink); }
/* "spotlighted a widget on the board" note — the written answer points AT the tile */
.spot { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 11.5px; color: var(--ai-ink); background: var(--ai-softer); border: 1px solid var(--ai-border); border-radius: var(--r-pill); padding: 4px 11px; }
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
.add { display: inline-flex; align-items: center; gap: 6px; margin-top: 11px; height: 32px; padding: 0 14px; border: none; border-radius: 8px; background: var(--ai-grad); color: #fff; font-weight: 600; font-size: 12.5px; }
.add:disabled { background: var(--green); opacity: 1; }
/* ===== create flow ===== */
.opts { display: flex; flex-direction: column; gap: 8px; }
.opt { display: flex; align-items: center; gap: 11px; text-align: left; border: 1px solid var(--border); background: var(--surface); border-radius: 10px; padding: 11px 12px; }
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
.pick { display: inline-flex; align-items: center; gap: 8px; text-align: left; border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 9px 11px; font-size: 12.5px; color: var(--ink); }
.pick:hover { border-color: var(--ai); background: var(--ai-softer); color: var(--ai-ink); }
.pick.new { color: var(--ai-ink); border-style: dashed; }
.sg.on { background: var(--ai-soft); border-color: var(--ai); color: var(--ai-ink); }
/* reasoning line */
.reasoning { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--muted); margin-bottom: 10px; }
.rz-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ai-grad); flex: none; }
/* grouped summary points */
.sum-grp { margin-bottom: 12px; }
.sum-gt { font-size: 12px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
.sum-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.sum-list li { position: relative; padding-left: 16px; font-size: 12.5px; line-height: 1.5; color: var(--ink-2); }
.sum-list li::before { content: ''; position: absolute; left: 3px; top: 8px; width: 5px; height: 5px; border-radius: 50%; background: var(--ai); }
/* contextual Follow ups (ClickUp-style vertical rows) */
.fu-sec { margin-top: 12px; }
.fu-h { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
.fu-list { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.fu { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; text-align: left; border: 1px solid var(--border); background: var(--surface); border-radius: var(--r-pill); padding: 8px 14px; font-size: 12.5px; font-weight: 500; color: var(--ink); }
.fu .fu-arrow { color: var(--muted-2); transform: rotate(0deg); flex: none; }
.fu:hover { border-color: var(--ai); background: var(--ai-softer); color: var(--ai-ink); }
.fu:hover .fu-arrow { color: var(--ai); }
/* footer input */
.af { border-top: 1px solid var(--border); padding: 10px 14px 12px; }
/* action bar */
.actionbar { display: flex; gap: 7px; overflow-x: auto; padding-bottom: 9px; scrollbar-width: none; }
.actionbar::-webkit-scrollbar { display: none; }
.actchip { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 11px; border: 1px solid var(--border); background: var(--surface); border-radius: var(--r-pill); font-size: 12px; font-weight: 600; color: var(--ink-2); flex: none; }
.actchip :deep(.ico) { color: var(--muted); }
.actchip:hover { border-color: var(--ai); color: var(--ai-ink); }
.actchip:hover :deep(.ico), .actchip.on :deep(.ico) { color: var(--ai); }
.actchip.on { border-color: var(--ai); background: var(--ai-softer); color: var(--ai-ink); }
.actpop { border: 1px solid var(--ai-border); border-radius: var(--r); background: var(--surface); box-shadow: var(--sh-pop); padding: 8px; margin-bottom: 9px; }
.actpop-enter-active, .actpop-leave-active { transition: opacity .18s ease, transform .18s ease; }
.actpop-enter-from, .actpop-leave-to { opacity: 0; transform: translateY(8px); }
.actpop-h { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; color: var(--muted); padding: 4px 6px 8px; }
.actpop-h :deep(.ico) { color: var(--ai); }
.apx { margin-left: auto; border: none; background: transparent; color: var(--muted); display: grid; place-items: center; padding: 2px; border-radius: 5px; }
.apx:hover { background: var(--surface-2); color: var(--ink); }
.actprompt { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; border: none; background: transparent; border-radius: 7px; padding: 8px 8px; font-size: 12.5px; color: var(--ink); }
.actprompt :deep(.ico) { color: var(--muted-2); flex: none; }
.actprompt:hover { background: var(--ai-softer); color: var(--ai-ink); }
.actprompt:hover :deep(.ico) { color: var(--ai); }
.chipsrow { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 9px; }
.sg { border: 1px solid var(--border); background: var(--surface); border-radius: var(--r-pill); padding: 5px 11px; font-size: 11.5px; color: var(--ink-2); }
.sg:hover { border-color: var(--primary); background: var(--primary-softer); color: var(--primary-700); }
.inbox { display: flex; align-items: center; gap: 6px; height: 44px; border: 1px solid var(--ai-border); border-radius: 11px; padding: 0 6px 0 8px; background: var(--surface); }
.inbox:focus-within { border-color: var(--ai); box-shadow: 0 0 0 3px var(--ai-soft); }
.attach { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; flex: none; }
.attach:hover { background: var(--surface-2); color: var(--ink); }
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

/* suggested next actions */
.na-h { font-size: 10.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--muted); margin: 13px 0 8px; }
.na-row .sg { background: var(--ai-grad-soft); border: 1px solid var(--ai-border); color: var(--ai-ink); }
.na-row .sg:hover { background: var(--ai-soft); border-color: var(--ai); color: var(--ai-ink); }
.grounded { display: flex; align-items: center; gap: 5px; margin-top: 8px; font-size: 10.5px; color: var(--muted); }
</style>
