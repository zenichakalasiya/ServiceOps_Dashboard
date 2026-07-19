<script setup>
/**
 * AiSummaryCard — the pinned "AI Summary" card (entry ① / the ServiceOps reference).
 *
 * Collapsed it is a slim bar (sparkle · "AI Summary" · freshness · refresh · ⋯ · ▾);
 * clicking it expands in place to a plain-language summary of THIS dashboard — what
 * data, KPIs, widgets and shortcuts it holds — plus key points, a generated-by line,
 * and the suggested next actions. Grounded: the composition is computed from the
 * board's own tiles (no LLM invents it); a real model would only rephrase it.
 *
 * The action chips are DASHBOARD-level and DATA-AWARE (the Monday/Tableau pattern):
 * the deep-dive chip names the metric the engine actually flagged ("Why is Overdue
 * up?"), so the card offers the investigation that's relevant to THIS board today.
 * Ticket-level actions (find similar / suggest KB) belong on a record, not here —
 * they moved to the drill view. Each chip emits `ask(intent, text)` → the panel.
 */
import { ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { facts as computeFacts } from '../../data/aiEngine.js'
import { store } from '../../store/index.js'

const props = defineProps({
  board: { type: Object, required: true },
  startOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['ask'])

const open = ref(props.startOpen)
const refreshing = ref(false)

// grounded: the collapsed note reports what the engine actually found, never "insights are ready"
const attention = computed(() => computeFacts(props.board).filter((f) => f.severity === 'bad' || f.severity === 'warn'))
const tiles = computed(() => props.board?.tiles || [])
const kpis = computed(() => tiles.value.filter((t) => t.type === 'kpi'))
const charts = computed(() => tiles.value.filter((t) => t.type === 'chart'))
const shortcuts = computed(() => tiles.value.filter((t) => t.type === 'shortcut'))
const names = (arr, n = 3) => {
  const t = arr.map((x) => x.title).slice(0, n)
  const extra = arr.length - t.length
  return t.join(', ') + (extra > 0 ? ` and ${extra} more` : '')
}

const summary = computed(() => {
  const parts = []
  if (kpis.value.length) parts.push(`${kpis.value.length} headline KPI${kpis.value.length > 1 ? 's' : ''}`)
  if (charts.value.length) parts.push(`${charts.value.length} chart${charts.value.length > 1 ? 's' : ''}`)
  if (shortcuts.value.length) parts.push(`${shortcuts.value.length} record list${shortcuts.value.length > 1 ? 's' : ''}`)
  const comp = parts.length ? parts.join(', ').replace(/,([^,]*)$/, ' and$1') : 'no widgets yet'
  return `“${props.board.name}” brings together ${comp}, giving a single at-a-glance view of your service desk. The KPIs track the current state, the charts trend it over time, and the list surfaces the records that need a technician’s attention.`
})

const keyPoints = computed(() => {
  const pts = []
  if (kpis.value.length) pts.push(`Headline KPIs: ${names(kpis.value)}`)
  if (charts.value.length) pts.push(`${charts.value.length} chart${charts.value.length > 1 ? 's' : ''} trending ${names(charts.value, 2)}`)
  if (shortcuts.value.length) pts.push(`Worklist: ${names(shortcuts.value, 2)} — the records to act on now`)
  if (!pts.length) pts.push('This dashboard is empty — add a KPI, widget or shortcut to summarise')
  return pts
})

function refresh() {
  refreshing.value = true
  setTimeout(() => (refreshing.value = false), 900)
}

/* Data-aware deep-dive: the top chip investigates whatever the engine flagged first
 * (an anomaly/delta metric preferred over the breach worklist), so its label reads
 * "Why is Overdue up?" on a board where Overdue spiked. */
const topSignal = computed(() => {
  const f = computeFacts(props.board)
  return f.find((x) => x.kind === 'anomaly') || f.find((x) => x.kind === 'delta') || f[0] || null
})
const topLabel = computed(() => {
  const s = topSignal.value
  if (!s) return ''
  const down = /down|drop|below|dip/.test(s.text.toLowerCase())
  return `Why is ${s.chip} ${down ? 'down' : 'up'}?`
})
/* Dashboard-level chips. RCA on the flagged metric (data-aware) → predict breaches →
 * open-ended ask. On a calm board the RCA chip drops and "about to breach" leads. */
const cardChips = computed(() => {
  const s = topSignal.value
  const chips = []
  if (s) chips.push({ label: topLabel.value, intent: 'explain', text: topLabel.value, icon: 'bulb', primary: true })
  chips.push({ label: 'Show tickets about to breach', intent: 'drill', text: 'Show tickets breaching SLA today', icon: 'alert', primary: !s })
  chips.push({ label: 'Ask about this dashboard', intent: 'open', text: '', icon: 'sparkles' })
  return chips
})
</script>

<template>
  <section class="ai-card" :class="{ open }">
    <!-- collapsed bar (always visible) -->
    <header class="ac-bar" @click="open = !open">
      <span class="ac-spark"><Icon name="sparkles" :size="18" /></span>
      <b class="ac-title">AI Summary</b>
      <div class="ac-grow" />
      <span class="ac-note">{{ open ? `Summarised from ${tiles.length} widgets` : (attention.length ? `${attention.length} need attention · updated just now` : 'All widgets within range · updated just now') }}</span>
      <button class="ac-ic" :class="{ spin: refreshing }" title="Regenerate" @click.stop="refresh"><Icon name="refresh" :size="15" /></button>
      <button class="ac-ic" title="More" @click.stop="mock('More')"><Icon name="dots-v" :size="15" /></button>
      <button class="ac-ic" :title="open ? 'Collapse' : 'Expand'" @click.stop="open = !open">
        <Icon :name="open ? 'chevron-up' : 'chevron-down'" :size="16" />
      </button>
    </header>

    <!-- expanded body -->
    <transition name="ac-exp">
      <div v-if="open" class="ac-body">
        <p class="ac-summary">{{ summary }}</p>

        <div class="ac-kp-h">Key points</div>
        <ul class="ac-kp">
          <li v-for="(p, i) in keyPoints" :key="i"><span class="kp-dot" />{{ p }}</li>
        </ul>

        <div class="ac-gen">
          <Icon name="sparkles" :size="12" /> Generated by {{ store.currentUser }} · just now
        </div>

        <div class="ac-acts">
          <button v-for="c in cardChips" :key="c.label" class="ac-cta" :class="{ primary: c.primary }" @click="emit('ask', c.intent, c.text)">
            <Icon :name="c.icon" :size="15" /> {{ c.label }}
          </button>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.ai-card {
  border: 1px solid var(--ai-border); border-radius: var(--r-lg);
  background: var(--ai-grad-soft);
  overflow: hidden; margin-bottom: 14px;
}
/* --- collapsed bar --- */
.ac-bar { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 12px 0 14px; cursor: pointer; user-select: none; }
.ac-spark { flex: none; display: grid; place-items: center; }
.ac-spark :deep(.ico) {
  background: var(--ai-grad); -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
.ac-title { font-size: 14px; font-weight: 600; color: var(--ink); }
.ac-grow { flex: 1; }
.ac-note { font-size: 12px; color: var(--muted); }
.ac-ic { flex: none; width: 28px; height: 28px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.ac-ic:hover { background: var(--ai-soft); color: var(--ai-ink); }
.ac-ic.spin :deep(.ico) { animation: acspin .9s linear; }
@keyframes acspin { to { transform: rotate(360deg); } }

/* --- expanded body --- */
.ac-body { padding: 4px 16px 16px; }
.ac-summary { margin: 0 0 14px; font-size: 13.5px; line-height: 1.55; color: var(--ink-2); }
.ac-kp-h { font-size: 10.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
.ac-kp { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ac-kp li { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; color: var(--ink-2); line-height: 1.4; }
.kp-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; margin-top: 6px; background: var(--ai-grad); }
.ac-gen { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted); margin-bottom: 14px; }
.ac-gen :deep(.ico) { color: var(--ai); }

.ac-acts { display: flex; flex-wrap: wrap; gap: 8px; }
.ac-cta {
  display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px;
  border: 1px solid var(--ai-border); border-radius: var(--r-pill);
  background: var(--surface); color: var(--ai-ink); font-weight: 600; font-size: 12.5px;
}
.ac-cta :deep(.ico) { color: var(--ai); }
.ac-cta:hover { border-color: var(--ai); background: var(--ai-soft); }
.ac-cta.primary { border-color: transparent; background: var(--surface); box-shadow: 0 0 0 1.5px var(--ai) inset; }
.ac-cta.primary:hover { background: var(--ai-soft); }

/* expand/collapse */
.ac-exp-enter-active, .ac-exp-leave-active { transition: opacity .18s ease, max-height .22s ease; overflow: hidden; }
.ac-exp-enter-from, .ac-exp-leave-to { opacity: 0; max-height: 0; }
.ac-exp-enter-to, .ac-exp-leave-from { opacity: 1; max-height: 460px; }
@media (prefers-reduced-motion: reduce) { .ac-exp-enter-active, .ac-exp-leave-active { transition: none; } }
</style>
