<script setup>
/**
 * AiSummaryCard — the always-upfront "AI Summary" banner (the ServiceOps reference look).
 *
 * A compact card: the AI Summary identity on the left with a grounded one-liner, and the
 * three deep-dive CTAs on the right. Each CTA opens the ServiceOps AI side panel to a
 * different behaviour:
 *   Show AI Summary            → the full role-ranked dashboard summary + next actions
 *   What changed since last visit → the per-widget deltas since the user was last here
 *   Ask about this dashboard   → an "analyzing…" thinking state, then grounded context
 *
 * Grounded: the one-liner is computed from the engine (no LLM invents it).
 */
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { facts as computeFacts } from '../../data/aiEngine.js'
import { store } from '../../store/index.js'

const props = defineProps({ board: { type: Object, required: true } })
const emit = defineEmits(['ask'])

const attention = computed(() => computeFacts(props.board).filter((f) => f.severity === 'bad' || f.severity === 'warn'))
const teaser = computed(() => {
  const n = attention.value.length
  if (!n) return `“${props.board.name}” looks healthy — all widgets are within range.`
  const top = attention.value[0]
  return `${n} thing${n > 1 ? 's' : ''} need attention on “${props.board.name}” — top of the list: ${top.text}.`
})

const CTAS = [
  { label: 'Show AI Summary', intent: 'summary', icon: 'sparkles', primary: true },
  { label: 'What changed since last visit', intent: 'changes', icon: 'history' },
  { label: 'Ask about this dashboard', intent: 'analyzing', icon: 'chat' },
]
</script>

<template>
  <section class="ai-card">
    <div class="ac-left">
      <span class="ac-spark"><Icon name="sparkles" :size="20" /></span>
      <div class="ac-copy">
        <div class="ac-title">AI Summary <span class="ac-badge" v-if="attention.length">{{ attention.length }}</span></div>
        <div class="ac-teaser">{{ teaser }}</div>
      </div>
    </div>
    <div class="ac-ctas">
      <button
        v-for="c in CTAS" :key="c.intent" class="ac-cta" :class="{ primary: c.primary }"
        @click="emit('ask', c.intent, c.label)"
      >
        <Icon :name="c.icon" :size="15" /> {{ c.label }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.ai-card {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  border: 1px solid var(--ai-border); border-radius: var(--r-lg);
  background: var(--ai-grad-soft); padding: 13px 16px; margin-bottom: 14px;
}
.ac-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
.ac-spark { flex: none; width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; background: var(--ai-grad); color: #fff; }
.ac-copy { min-width: 0; }
.ac-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--ink); }
.ac-badge { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--ai-grad); color: #fff; font-size: 11px; font-weight: 700; }
.ac-teaser { font-size: 12.5px; color: var(--ink-2); margin-top: 2px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }

.ac-ctas { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: none; }
.ac-cta {
  display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px;
  border: 1px solid var(--ai-border); border-radius: var(--r-pill);
  background: var(--surface); color: var(--ai-ink); font-weight: 600; font-size: 12.5px;
}
.ac-cta :deep(.ico) { color: var(--ai); }
.ac-cta:hover { border-color: var(--ai); background: var(--ai-soft); }
.ac-cta.primary { border-color: transparent; box-shadow: 0 0 0 1.5px var(--ai) inset; }
.ac-cta.primary:hover { background: var(--ai-soft); }

@media (max-width: 860px) { .ac-ctas { width: 100%; } }
</style>
