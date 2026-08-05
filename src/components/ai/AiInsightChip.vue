<script setup>
/**
 * AiInsightChip — placement A of the AI-insights entry point.
 *
 * A small gradient-bordered chip (sparkle + attention count) that sits in the board header,
 * left of the ⋯ menu. Clicking it opens a popover: a grounded one-line dashboard summary and
 * the three CTAs. Each CTA emits `ask(intent, label)` — the board opens the real assistant.
 *
 * Near-zero vertical cost; the chip survives a zero-insight board (it stays, just no count).
 * Shared teaser + CTAs with the banner and the KPI-row card (see data/aiTeaser.js).
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Icon from '../ui/Icon.vue'
import { useAiTeaser, AI_TEASER_CTAS } from '../../data/aiTeaser.js'

const props = defineProps({ board: { type: Object, required: true } })
const emit = defineEmits(['ask'])

const { count, summary } = useAiTeaser(() => props.board)
const open = ref(false)
const CTAS = AI_TEASER_CTAS

function pick(c) { open.value = false; emit('ask', c.intent, c.label) }
function onKey(e) { if (e.key === 'Escape' && open.value) open.value = false }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="chip-wrap">
    <button class="ai-chip" :class="{ on: open }" :aria-expanded="open" title="AI insights" @click.stop="open = !open">
      <Icon name="sparkles" :size="15" /><span class="ai-chip-l">AI Insights</span><span v-if="count" class="ai-chip-n">{{ count }}</span>
    </button>
    <div v-if="open" class="pop-backdrop" @click="open = false" />
    <transition name="pop">
      <div v-if="open" class="ai-pop" @click.stop>
        <div class="ai-pop-h"><span class="ai-pop-spark"><Icon name="sparkles" :size="14" /></span> AI insights</div>
        <p class="ai-pop-sum">{{ summary }}</p>
        <div class="ai-pop-acts">
          <button v-for="c in CTAS" :key="c.intent" class="ai-pop-cta" :class="{ primary: c.primary }" @click="pick(c)">
            <Icon :name="c.icon" :size="14" /> <span>{{ c.label }}</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.chip-wrap { position: relative; }
/* AI-accented pill: gradient-border over white, gradient glyph, count badge */
/* Sized and cornered like every other action in the board header (.btn — 36px tall,
   --r radius). It was a 30px pill, which made the one AI control in the row both shorter
   than its neighbours and a different shape; the gradient border is enough to mark it out
   without also breaking the row's geometry. */
.ai-chip {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px;
  border: 1.5px solid transparent; border-radius: var(--r);
  background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--ai-grad-line) border-box;
}
.ai-chip :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
/* the button names itself, as the design does — an icon plus a bare number said what
   there was but never what it was */
.ai-chip-l { font-size: 12.5px; font-weight: 600; color: var(--ai-ink); white-space: nowrap; }
/* the count still rides along: it is the one thing the label cannot carry */
.ai-chip-n { min-width: 17px; height: 17px; padding: 0 5px; display: grid; place-items: center; border-radius: 999px; background: var(--ai-soft); font-size: 11px; font-weight: 700; color: var(--ai-ink); font-variant-numeric: tabular-nums; }
.ai-chip:hover, .ai-chip.on { background: linear-gradient(var(--ai-soft), var(--ai-soft)) padding-box, var(--ai-grad-line) border-box; }
.pop-backdrop { position: fixed; inset: 0; z-index: 40; }
.ai-pop {
  position: absolute; top: 38px; right: 0; z-index: 50; width: 340px;
  background: var(--surface); border: 1px solid var(--ai-border); border-radius: 12px;
  box-shadow: var(--sh-pop); padding: 14px;
}
.ai-pop-h { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.ai-pop-spark { width: 26px; height: 26px; border-radius: 8px; flex: none; display: grid; place-items: center; background: var(--ai-softer); }
.ai-pop-spark :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.ai-pop-sum { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--ink-2); }
.ai-pop-acts { display: flex; flex-direction: column; gap: 8px; margin-top: 13px; }
.ai-pop-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px;
  border: 1px solid var(--ai-border); border-radius: var(--r-pill);
  background: var(--ai-grad-soft); color: var(--ai-ink); font-weight: 600; font-size: 12.5px;
}
.ai-pop-cta :deep(.ico) { color: var(--ai); }
.ai-pop-cta:hover { border-color: var(--ai); background: var(--ai-soft); }
/* primary: gradient border over white + gradient label (label lives in its own span) */
.ai-pop-cta.primary { border: 1.5px solid transparent; background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--ai-grad-line) border-box; }
.ai-pop-cta.primary span, .ai-pop-cta.primary :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.ai-pop-cta.primary:hover { background: linear-gradient(var(--ai-soft), var(--ai-soft)) padding-box, var(--ai-grad-line) border-box; }
.pop-enter-active, .pop-leave-active { transition: opacity .14s ease, transform .14s ease; transform-origin: top right; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: scale(.96); }
</style>
