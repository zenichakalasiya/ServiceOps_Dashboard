<script setup>
/**
 * AiSummaryCard — the always-upfront "AI Summary" banner (the ServiceOps reference look).
 *
 * COLLAPSED it is a one-line teaser. Clicking it EXPANDS the card in place to show the
 * dashboard summary — the card is the summary's home now, not a launcher for the panel.
 *
 * The card only has room for an OVERVIEW, so the depth is split across three CTAs:
 *   Insights with AI       → opens the chat (the old "Ask about this dashboard" behaviour)
 *   Every widget explained → the widget-by-widget read, in the panel, where it has room
 *   Add a new widget       → straight to the widget builder
 *
 * Grounded: every line is computed from the engine (no LLM invents it).
 */
import { ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { facts as computeFacts, dashboardSummaryPoints } from '../../data/aiEngine.js'

const props = defineProps({ board: { type: Object, required: true } })
const emit = defineEmits(['ask'])

const open = ref(false)

const attention = computed(() => computeFacts(props.board).filter((f) => f.severity === 'bad' || f.severity === 'warn'))
const teaser = computed(() => {
  const tiles = props.board.tiles || []
  // an empty board isn't "healthy" — it has nothing to read
  if (!tiles.length) return `“${props.board.name}” has no widgets yet — add one and I’ll start summarising it.`
  const n = attention.value.length
  if (!n) return `“${props.board.name}” looks healthy — all ${tiles.length} widgets are within range.`
  const top = attention.value[0]
  return `${n} thing${n > 1 ? 's' : ''} need attention on “${props.board.name}” — top of the list: ${top.text}.`
})

// the overview that fits the card: the same grouped points the panel uses, capped so the
// card never grows into a wall of text. The uncapped read is one CTA away.
const groups = computed(() => dashboardSummaryPoints(props.board).map((g) => ({
  title: g.title,
  points: g.points.slice(0, 3),
})))

const CTAS = [
  { label: 'Insights with AI', intent: 'open', icon: 'sparkles', primary: true },
  { label: 'Every widget explained', intent: 'widgets', icon: 'auto-graph' },
  { label: 'Add a new widget', intent: 'addwidget', icon: 'plus' },
]

function toggle() { open.value = !open.value }
</script>

<template>
  <section class="ai-card" :class="{ open }">
    <!-- the head stays exactly as it was; the whole row is the expand affordance -->
    <div class="ac-head" role="button" tabindex="0" :aria-expanded="open"
      @click="toggle" @keydown.enter.prevent="toggle" @keydown.space.prevent="toggle">
      <div class="ac-left">
        <span class="ac-spark"><Icon name="sparkles" :size="20" /></span>
        <div class="ac-copy">
          <div class="ac-title">AI Summary <span class="ac-badge" v-if="attention.length">{{ attention.length }}</span></div>
          <div class="ac-teaser">{{ teaser }}</div>
        </div>
      </div>
      <span class="ac-toggle">
        {{ open ? 'Hide' : 'Show AI Summary' }}
        <Icon :name="open ? 'chevron-up' : 'chevron-down'" :size="15" />
      </span>
    </div>

    <transition name="acx">
      <div v-if="open" class="ac-body">
        <div class="ac-groups">
          <div v-for="g in groups" :key="g.title" class="ac-grp">
            <div class="ac-grp-h">{{ g.title }}</div>
            <ul class="ac-pts"><li v-for="(p, i) in g.points" :key="i">{{ p }}</li></ul>
          </div>
        </div>
        <p class="ac-more">That’s the overview. For the reading of each widget and its numbers, open one of these.</p>
        <div class="ac-ctas">
          <button
            v-for="c in CTAS" :key="c.intent" class="ac-cta" :class="{ primary: c.primary }"
            @click.stop="emit('ask', c.intent, c.label)"
          >
            <Icon :name="c.icon" :size="15" /><span>{{ c.label }}</span>
          </button>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.ai-card {
  border: 1px solid var(--ai-border); border-radius: var(--r-lg);
  background: var(--ai-grad-card); padding: 13px 16px; margin-bottom: 14px;
}
/* the collapsed row — unchanged from the shipped look */
.ac-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; cursor: pointer; }
.ac-head:focus-visible { outline: 2px solid var(--ai); outline-offset: 3px; border-radius: 8px; }
.ac-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
.ac-spark { flex: none; width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; background: var(--ai-softer); }
.ac-spark :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.ac-copy { min-width: 0; }
.ac-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--ink); }
.ac-badge { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--ai-grad); color: #fff; font-size: 11px; font-weight: 700; }
.ac-teaser { font-size: 12.5px; color: var(--ink-2); margin-top: 2px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
/* the expand control borrows the secondary CTA's treatment so nothing new is introduced */
.ac-toggle {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; flex: none;
  border: 1px solid var(--ai-border); border-radius: var(--r-pill);
  background: var(--ai-grad-soft); color: var(--ai-ink); font-weight: 600; font-size: 12.5px;
}
.ac-head:hover .ac-toggle { border-color: var(--ai); background: var(--ai-soft); }
.ac-toggle :deep(.ico) { color: var(--ai); }

/* the expanded overview */
.ac-body { padding-top: 13px; margin-top: 13px; border-top: 1px solid var(--ai-border); }
.ac-groups { display: grid; gap: 14px 26px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.ac-grp-h { font-size: 10.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.ac-pts { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 4px; }
.ac-pts li { font-size: 12.5px; line-height: 1.5; color: var(--ink-2); }
.ac-more { margin: 13px 0 11px; font-size: 12px; color: var(--muted); }

.ac-ctas { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ac-cta {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px;
  border: 1px solid var(--ai-border); border-radius: var(--r-pill);
  background: var(--ai-grad-soft); color: var(--ai-ink); font-weight: 600; font-size: 12.5px;
}
.ac-cta :deep(.ico) { color: var(--ai); }
.ac-cta:hover { border-color: var(--ai); background: var(--ai-soft); }
/* primary: gradient border AND gradient label on a white fill */
.ac-cta.primary { border: 1.5px solid transparent; background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--ai-grad-line) border-box; }
.ac-cta.primary span, .ac-cta.primary :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.ac-cta.primary:hover { background: linear-gradient(var(--ai-soft), var(--ai-soft)) padding-box, var(--ai-grad-line) border-box; }

.acx-enter-active, .acx-leave-active { transition: opacity .16s ease; }
.acx-enter-from, .acx-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .acx-enter-active, .acx-leave-active { transition: none; } }

@media (max-width: 860px) { .ac-toggle { width: 100%; justify-content: center; } }
</style>
