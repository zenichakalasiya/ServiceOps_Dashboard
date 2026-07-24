<script setup>
/**
 * AiSummaryCard — the upfront "AI insights" card.
 *
 * COLLAPSED (default) it is a thin bar: the AI glyph, the title "AI insights", and a
 * dropdown chevron on the right — so it costs a dashboard almost no height.
 * EXPANDED it shows a small grounded summary of the board, with the three CTAs beneath
 * it at the bottom-left. The depth still lives behind the CTAs, in the side panel.
 *
 *   Insights with AI       → opens the panel and shows the FULL dashboard insights
 *   Every widget explained → the widget-by-widget read, in the panel
 *   Add a new widget       → opens the chat and suggests widgets to add
 *
 * Grounded: the summary is computed from the engine (no LLM invents it).
 */
import { ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { useAiTeaser, AI_TEASER_CTAS } from '../../data/aiTeaser.js'

// hideAddWidget: the placement lab's Variant C drops "Add a new widget" (it duplicates
// the floating action button and isn't an AI action). The real dashboard leaves it on.
const props = defineProps({ board: { type: Object, required: true }, hideAddWidget: { type: Boolean, default: false } })
const emit = defineEmits(['ask'])

const open = ref(false)

// grounded teaser (count + one-line summary), shared with the chip and KPI-card placements
const { summary } = useAiTeaser(() => props.board)
const CTAS = computed(() => (props.hideAddWidget ? AI_TEASER_CTAS.filter((c) => c.intent !== 'suggestwidget') : AI_TEASER_CTAS))

function toggle() { open.value = !open.value }
</script>

<template>
  <section class="ai-card" :class="{ open }">
    <!-- collapsed bar: AI glyph · "AI insights" · dropdown chevron. The whole row toggles. -->
    <div class="ac-head" role="button" tabindex="0" :aria-expanded="open"
      @click="toggle" @keydown.enter.prevent="toggle" @keydown.space.prevent="toggle">
      <span class="ac-spark"><Icon name="sparkles" :size="18" /></span>
      <span class="ac-title">AI insights</span>
      <span class="ac-arrow" :title="open ? 'Collapse' : 'Expand'"><Icon :name="open ? 'chevron-up' : 'chevron-down'" :size="18" /></span>
    </div>

    <transition name="acx">
      <div v-if="open" class="ac-body">
        <p class="ac-summary">{{ summary }}</p>
        <div class="ac-ctas">
          <button
            v-for="c in CTAS" :key="c.intent" class="ac-cta" :class="{ primary: c.primary }"
            @click="emit('ask', c.intent, c.label)"
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
  background: var(--ai-grad-card); padding: 11px 14px; margin-bottom: 14px;
}
/* collapsed row — glyph, title, and the dropdown chevron pinned right */
.ac-head { display: flex; align-items: center; gap: 11px; cursor: pointer; }
.ac-head:focus-visible { outline: 2px solid var(--ai); outline-offset: 3px; border-radius: 8px; }
.ac-spark { flex: none; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--ai-softer); }
.ac-spark :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.ac-title { flex: 1; font-size: 15px; font-weight: 600; color: var(--ink); }
.ac-arrow { flex: none; width: 28px; height: 28px; border-radius: 7px; display: grid; place-items: center; color: var(--ai); }
.ac-head:hover .ac-arrow { background: var(--ai-soft); }

/* expanded: the small summary, then the CTAs beneath it at the bottom-left */
.ac-body { padding: 10px 0 2px 45px; }
.ac-summary { margin: 0 0 12px; font-size: 13px; line-height: 1.55; color: var(--ink-2); max-width: 80ch; }
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
@media (max-width: 620px) { .ac-body { padding-left: 0; } }
</style>
