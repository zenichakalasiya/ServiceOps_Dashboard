<script setup>
/**
 * AiInsightCard — placement B of the AI-insights entry point.
 *
 * A wide card sized to sit inside the KPI row (the parent gives it its column span). It shows
 * the AI glyph, "AI insights", the attention count, a grounded one-line summary and the three
 * CTAs. Each CTA emits `ask(intent, label)` — the board opens the real assistant.
 *
 * Zero extra chrome — it's already a tile in the row. Shared teaser + CTAs with the banner and
 * the header chip (see data/aiTeaser.js).
 */
import Icon from '../ui/Icon.vue'
import { useAiTeaser, AI_TEASER_CTAS } from '../../data/aiTeaser.js'

const props = defineProps({ board: { type: Object, required: true } })
const emit = defineEmits(['ask'])

const { count, summary } = useAiTeaser(() => props.board)
const CTAS = AI_TEASER_CTAS
</script>

<template>
  <div class="ai-card-b card">
    <div class="acb-head">
      <span class="acb-spark"><Icon name="sparkles" :size="15" /></span> AI insights
      <span v-if="count" class="acb-badge">{{ count }}</span>
    </div>
    <p class="acb-sum">{{ summary }}</p>
    <div class="acb-acts">
      <button v-for="c in CTAS" :key="c.intent" class="acb-cta" :class="{ primary: c.primary }" @click="emit('ask', c.intent, c.label)">
        <Icon :name="c.icon" :size="13" /> <span>{{ c.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-card-b {
  align-self: stretch; display: flex; flex-direction: column; text-align: left;
  padding: 12px 15px; border: 1px solid var(--ai-border); border-radius: var(--r-lg);
  background: var(--ai-grad-card); height: 100%;
}
.acb-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ink); }
.acb-spark { width: 26px; height: 26px; border-radius: 8px; flex: none; display: grid; place-items: center; background: var(--ai-softer); }
.acb-spark :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.acb-badge { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--ai-grad); color: #fff; font-size: 11px; font-weight: 700; }
.acb-sum { flex: 1; margin: 8px 0 10px; font-size: 12.5px; line-height: 1.5; color: var(--ink-2); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.acb-acts { display: flex; gap: 7px; flex-wrap: wrap; }
.acb-cta {
  display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 11px;
  border: 1px solid var(--ai-border); border-radius: var(--r-pill);
  background: var(--ai-grad-soft); color: var(--ai-ink); font-weight: 600; font-size: 11.5px;
}
.acb-cta :deep(.ico) { color: var(--ai); }
.acb-cta:hover { border-color: var(--ai); background: var(--ai-soft); }
.acb-cta.primary { border: 1.5px solid transparent; background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--ai-grad-line) border-box; }
.acb-cta.primary span, .acb-cta.primary :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.acb-cta.primary:hover { background: linear-gradient(var(--ai-soft), var(--ai-soft)) padding-box, var(--ai-grad-line) border-box; }
</style>
