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
import { ref, nextTick, watch, onMounted } from 'vue'
import Icon from '../ui/Icon.vue'
import ChartTile from '../dashboard/ChartTile.vue'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import { facts as computeFacts, confidence, anomalyFor, drillFor, applyChips, ROLES, FRESHNESS } from '../../data/aiEngine.js'
import { routeIntent, tileFromText, factFromText, specFromText, SUGGESTIONS, KINDS } from '../../data/aiAssistant.js'
import { toast } from '../../store/index.js'

const props = defineProps({ board: Object, role: String, open: Boolean })
const emit = defineEmits(['update:open', 'role', 'cite'])

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
function pushDrill(text) {
  const fact = factFromText(props.board, text)
  const drill = drillFor(props.board, fact)
  thread.value.push({ id: ++bid, kind: 'drill', fact, drill, chips: [...drill.chips] })
  scrollDown()
}
function pushWidget(text) {
  const spec = specFromText(text)
  thread.value.push({ id: ++bid, kind: 'widget', spec, recommendedKind: spec.kind, added: false })
  scrollDown()
}
function dispatch(intent, text) {
  if (intent === 'summary') pushSummary()
  else if (intent === 'explain') pushExplain(text)
  else if (intent === 'drill') pushDrill(text)
  else if (intent === 'create') pushWidget(text)
}

// ---- interactions ----
function submit() {
  const text = input.value.trim(); if (!text) return
  input.value = ''
  pushUser(text)
  dispatch(routeIntent(text), text)
}
function suggest(s) { pushUser(s.label); dispatch(s.intent, s.label) }
function investigate(fact) { pushUser(`Investigate: ${fact.chip}`); pushDrill(fact.kind === 'anomaly' ? 'overdue anomaly' : 'breach') }
function explainFact(fact) { pushUser(`Explain: ${fact.chip}`); pushExplain(fact.chip) }

// drill block: editable chips + records + actions
function recordsFor(b) { return applyChips(b.drill.baseRows, b.drill.columns, b.chips) }
function removeDrillChip(b, i) { if (!b.chips[i].locked) b.chips.splice(i, 1) }
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
function pillClass(v) {
  const s = String(v).toLowerCase().trim()
  if (['open', 'pending', 'new'].includes(s)) return 'pill pill-blue'
  if (['in progress', 'active', 'on hold'].includes(s)) return 'pill pill-amber'
  if (['resolved', 'closed', 'done'].includes(s)) return 'pill pill-green'
  const m = s.match(/^p([1-4])$/); return m ? 'pill pill-p' + m[1] : ''
}

// external trigger (the showcase capability cards drive a specific mode)
function trigger(intent, label) {
  if (!thread.value.length) pushSummary()
  pushUser(label)
  dispatch(intent, label)
}
defineExpose({ trigger })

// open with a proactive summary; re-rank the (first) summary when role changes
watch(() => props.open, (v) => { if (v && !thread.value.length) pushSummary() })
watch(() => props.role, () => {
  const s = thread.value.find((b) => b.kind === 'summary')
  if (s) s.facts = computeFacts(props.board, props.role)
})
onMounted(() => { if (props.open && !thread.value.length) pushSummary() })
</script>

<template>
  <aside class="asst card" v-if="open">
    <!-- header -->
    <div class="ah">
      <div class="ah-l"><span class="spk"><Icon name="sparkles" :size="16" /></span>
        <div><div class="ah-t">AI Assistant</div><div class="ah-sub">{{ board.name }} · {{ board.tiles.length }} widgets</div></div>
      </div>
      <button class="x" @click="emit('update:open', false)"><Icon name="x" :size="17" /></button>
    </div>
    <div class="ah2">
      <div class="role-seg">
        <button v-for="r in ROLES" :key="r.key" class="rseg" :class="{ on: role === r.key }" @click="emit('role', r.key)">{{ r.label.split(' ')[0] }}</button>
      </div>
      <span class="conf" :class="confidence(board)"><Icon name="verified" :size="12" /> {{ confidence(board) }} confidence</span>
    </div>

    <!-- thread -->
    <div ref="bodyEl" class="ab">
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
                  <button class="lnk" @click="explainFact(f)">Explain</button>
                  <button class="lnk" @click="investigate(f)">Investigate →</button>
                </div>
              </div>
            </div>
            <div v-if="!b.facts.length" class="calm"><Icon name="check" :size="16" /> Nothing unusual — all {{ board.tiles.length }} widgets are within range.</div>
          </div>
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

        <!-- P2 drill -->
        <template v-else-if="b.kind === 'drill'">
          <div class="blk-h"><Icon name="insights" :size="14" /> {{ b.fact.text }}</div>
          <div class="sub-h">Scope <span class="muted">editable</span></div>
          <div class="chips">
            <span v-for="(c, i) in b.chips" :key="i" class="dchip" :class="{ locked: c.locked }">
              <b>{{ c.field }}</b><span v-if="c.op" class="op">{{ c.op }}</span> {{ c.value }}
              <button v-if="!c.locked" class="cx" @click="removeDrillChip(b, i)"><Icon name="x" :size="11" /></button>
              <Icon v-else name="lock" :size="10" class="cl" />
            </span>
          </div>
          <p v-if="b.drill.tierNote" class="tier"><Icon name="info" :size="11" /> {{ b.drill.tierNote }}</p>
          <div class="sub-h">{{ recordsFor(b).length }} record{{ recordsFor(b).length === 1 ? '' : 's' }} <span class="muted">from “{{ b.drill.sourceTitle }}”</span></div>
          <div class="rtbl">
            <table><thead><tr><th v-for="c in b.drill.columns" :key="c">{{ c }}</th></tr></thead>
              <tbody><tr v-for="(r, i) in recordsFor(b)" :key="i"><td v-for="(cell, j) in r" :key="j">
                <span v-if="pillClass(cell)" :class="pillClass(cell)">{{ cell }}</span>
                <span v-else-if="/^[A-Z]{2,4}-\d/.test(String(cell))" class="idl">{{ cell }}</span>
                <template v-else>{{ cell }}</template>
              </td></tr>
              <tr v-if="!recordsFor(b).length"><td :colspan="b.drill.columns.length" class="none">No records match this scope.</td></tr></tbody>
            </table>
          </div>
          <div class="sub-h">Suggested actions <span class="muted">confirmed, never automatic</span></div>
          <div class="acts">
            <button v-for="a in b.drill.actions" :key="a.id" class="act" @click="pending = { block: b, action: a }">
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
      </div>
    </div>

    <!-- input -->
    <div class="af">
      <div class="chipsrow">
        <button v-for="s in SUGGESTIONS" :key="s.label" class="sg" @click="suggest(s)">{{ s.label }}</button>
      </div>
      <div class="inbox">
        <Icon name="sparkles" :size="15" class="ib-ic" />
        <input v-model="input" placeholder="Ask about your dashboard, or describe a widget…" @keyup.enter="submit" />
        <button class="send" :disabled="!input.trim()" @click="submit"><Icon name="open-in" :size="16" /></button>
      </div>
      <div class="grounded"><Icon name="lock" :size="11" /> Grounded · runs on-prem · no data leaves your perimeter</div>
    </div>

    <ConfirmDialog v-if="pending" :title="pending.action.label" :message="pending.action.confirm"
      :confirm-label="pending.action.label" :danger="pending.action.danger !== false"
      @confirm="runAction" @cancel="pending = null" />
  </aside>
</template>

<style scoped>
.asst { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.ah { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px 10px; }
.ah-l { display: flex; gap: 10px; align-items: center; }
.spk { width: 32px; height: 32px; border-radius: 9px; flex: none; display: grid; place-items: center; background: var(--ai-grad); color: #fff; }
.ah-t { font-weight: 600; font-size: 15px; }
.ah-sub { font-size: 11.5px; color: var(--muted); }
.x { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; padding: 3px; border-radius: 7px; }
.x:hover { background: var(--surface-2); color: var(--ink); }
.ah2 { display: flex; align-items: center; justify-content: space-between; padding: 0 14px 11px; border-bottom: 1px solid var(--border); }
.role-seg { display: inline-flex; gap: 2px; background: var(--surface-2); padding: 2px; border-radius: var(--r-pill); }
.rseg { height: 24px; padding: 0 10px; border: none; background: transparent; border-radius: var(--r-pill); font-size: 11.5px; font-weight: 500; color: var(--muted); }
.rseg.on { background: var(--surface); color: var(--primary-700); box-shadow: var(--sh-sm); }
.conf { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; }
.conf.high { color: var(--green); } .conf.medium { color: var(--amber); } .conf.low { color: var(--muted); }

.ab { flex: 1; overflow: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 14px; }
.blk { animation: rise .2s ease both; }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .blk { animation: none; } }
.user { display: flex; justify-content: flex-end; }
.user span { background: var(--primary); color: #fff; font-size: 12.5px; font-weight: 500; padding: 7px 12px; border-radius: 13px 13px 3px 13px; max-width: 85%; }
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
/* explain */
.say { margin: 0 0 9px; font-size: 12.5px; line-height: 1.45; }
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
.add { display: inline-flex; align-items: center; gap: 6px; margin-top: 11px; height: 32px; padding: 0 14px; border: none; border-radius: 8px; background: var(--primary); color: #fff; font-weight: 600; font-size: 12.5px; }
.add:disabled { background: var(--green); opacity: 1; }
/* footer input */
.af { border-top: 1px solid var(--border); padding: 10px 14px 12px; }
.chipsrow { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 9px; }
.sg { border: 1px solid var(--border); background: var(--surface); border-radius: var(--r-pill); padding: 5px 11px; font-size: 11.5px; color: var(--ink-2); }
.sg:hover { border-color: var(--primary); background: var(--primary-softer); color: var(--primary-700); }
.inbox { display: flex; align-items: center; gap: 8px; height: 42px; border: 1.5px solid var(--ai); border-radius: var(--r); padding: 0 6px 0 11px; box-shadow: 0 0 0 3px var(--ai-soft); }
.ib-ic { color: var(--ai); flex: none; }
.inbox input { flex: 1; border: none; outline: none; background: transparent; font-size: 13px; font-family: inherit; color: var(--ink); }
.send { width: 32px; height: 32px; border: none; border-radius: 7px; background: var(--ai-grad); color: #fff; display: grid; place-items: center; flex: none; }
.send:disabled { opacity: .45; }
.grounded { display: flex; align-items: center; gap: 5px; margin-top: 8px; font-size: 10.5px; color: var(--muted); }
</style>
