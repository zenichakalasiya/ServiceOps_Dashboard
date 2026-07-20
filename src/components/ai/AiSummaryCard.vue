<script setup>
/**
 * AiSummaryCard — the upfront AI summary, Option B: a COMPACT bar that reveals in two
 * progressive steps before ever opening the side panel.
 *
 *   • hover  (B2 "peek")   → a floating preview of the top findings + "Open full summary"
 *   • click  (B1 "inline") → expands the full ranked list right here on the board, each
 *                            finding with an Investigate hand-off; click again to collapse
 *
 * Grounded: findings come straight from the engine (facts computed deterministically).
 * Every finding's Investigate routes into the shared side panel for the full briefing.
 */
import { ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { facts as computeFacts } from '../../data/aiEngine.js'

const props = defineProps({ board: { type: Object, required: true } })
const emit = defineEmits(['ask'])

const attention = computed(() => computeFacts(props.board).filter((f) => f.severity === 'bad' || f.severity === 'warn'))
const top = computed(() => attention.value.slice(0, 3))
const teaser = computed(() => {
  const n = attention.value.length
  if (!n) return `“${props.board.name}” looks healthy — all widgets are within range.`
  return `${n} thing${n > 1 ? 's' : ''} need attention — top: ${attention.value[0].text}.`
})

const expanded = ref(false)
const peek = ref(false)

function toggle() {
  // nothing to expand when calm → just open the panel's summary
  if (!attention.value.length) { emit('ask', 'analyzing', 'Show AI Summary'); return }
  expanded.value = !expanded.value
  peek.value = false
}
function investigate(f) { expanded.value = false; peek.value = false; emit('ask', 'drill', f.text) }
function ask(intent, label) { expanded.value = false; peek.value = false; emit('ask', intent, label) }
const dotClass = (s) => (s === 'bad' ? 'bad' : s === 'warn' ? 'warn' : 'info')
</script>

<template>
  <section class="ai-b" :class="{ open: expanded, calm: !attention.length }">
    <!-- the compact bar (always visible) -->
    <button
      class="aib-bar" @click="toggle"
      @mouseenter="peek = true" @mouseleave="peek = false"
      :aria-expanded="expanded"
    >
      <span class="aib-orb"><Icon name="sparkles" :size="16" /></span>
      <span class="aib-id">AI Summary</span>
      <span v-if="attention.length" class="aib-count">{{ attention.length }}</span>
      <span v-else class="aib-ok"><Icon name="check" :size="13" /> All clear</span>
      <span class="aib-teaser">{{ teaser }}</span>
      <span v-if="attention.length" class="aib-chev"><Icon name="chevron-right" :size="16" /></span>
    </button>

    <!-- B2 · peek preview (hover, only while collapsed) -->
    <transition name="peek">
      <div
        v-if="peek && !expanded && attention.length" class="aib-peek"
        @mouseenter="peek = true" @mouseleave="peek = false"
      >
        <div class="pk-h">Top findings <span class="pk-updated">updated just now</span></div>
        <button v-for="f in top" :key="f.id" class="pk-row" @click="investigate(f)">
          <span class="sev" :class="dotClass(f.severity)" />
          <span class="pk-t">{{ f.text }}</span>
          <Icon name="chevron-right" :size="14" class="pk-arrow" />
        </button>
        <button class="pk-open" @click="ask('analyzing', 'Show AI Summary')">
          <Icon name="sparkles" :size="14" /> Open full summary
        </button>
      </div>
    </transition>

    <!-- B1 · inline expansion (click) -->
    <transition name="expand">
      <div v-if="expanded" class="aib-inline">
        <div class="il-list">
          <div v-for="f in attention" :key="f.id" class="il-row">
            <span class="sev" :class="dotClass(f.severity)" />
            <div class="il-body">
              <div class="il-t">{{ f.text }}</div>
              <span class="il-chip"><Icon name="chart-bar" :size="11" /> {{ f.chip }}</span>
            </div>
            <button class="il-inv" @click="investigate(f)">Investigate →</button>
          </div>
        </div>
        <div class="il-foot">
          <button class="foot-primary" @click="ask('analyzing', 'Show AI Summary')">
            <Icon name="sparkles" :size="14" /> Open full AI summary
          </button>
          <button class="foot-link" @click="ask('changes', 'What changed since last visit')">
            <Icon name="history" :size="13" /> What changed
          </button>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.ai-b { position: relative; margin-bottom: 14px; }

/* --- the compact bar --- */
.aib-bar {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  border: 1px solid var(--ai-border); border-radius: var(--r-lg);
  background: var(--ai-grad-soft); padding: 9px 12px; cursor: pointer;
  transition: border-color .15s, background .15s;
}
.aib-bar:hover { border-color: var(--ai); }
.ai-b.open .aib-bar { border-color: var(--ai); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.aib-orb { flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: var(--ai-grad); color: #fff; }
.aib-id { font-size: 13.5px; font-weight: 600; color: var(--ink); flex: none; }
.aib-count { flex: none; display: inline-grid; place-items: center; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px; background: var(--ai-grad); color: #fff; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.aib-ok { flex: none; display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; color: var(--green); }
.aib-ok :deep(.ico) { color: var(--green); }
.aib-teaser { flex: 1; min-width: 0; font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aib-chev { flex: none; color: var(--ai); display: grid; place-items: center; transition: transform .22s ease; }
.ai-b.open .aib-chev { transform: rotate(90deg); }
/* calm bar reads green, not violet */
.ai-b.calm .aib-bar { background: var(--green-soft); border-color: color-mix(in srgb, var(--green) 24%, transparent); }
.ai-b.calm .aib-orb { background: var(--green); }

/* shared severity dot */
.sev { flex: none; width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; }
.sev.bad { background: var(--red); } .sev.warn { background: var(--amber); } .sev.info { background: var(--blue); }

/* --- B2 peek popover --- */
.aib-peek {
  position: absolute; top: calc(100% + 7px); left: 0; z-index: 30; width: min(380px, 90vw);
  border: 1px solid var(--ai-border); border-radius: var(--r-lg); background: var(--surface);
  box-shadow: var(--sh-lg); padding: 11px;
}
.pk-h { display: flex; align-items: baseline; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: 2px 4px 9px; }
.pk-updated { margin-left: auto; font-weight: 500; text-transform: none; letter-spacing: 0; }
.pk-row { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; border: none; background: transparent; border-radius: 8px; padding: 8px 7px; cursor: pointer; }
.pk-row:hover { background: var(--ai-softer); }
.pk-t { flex: 1; min-width: 0; font-size: 12.5px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pk-arrow { color: var(--muted-2); flex: none; }
.pk-row:hover .pk-arrow { color: var(--ai); }
.pk-open { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 7px; height: 34px; border: none; border-radius: 9px; background: var(--ai-grad); color: #fff; font-weight: 600; font-size: 12.5px; cursor: pointer; }

/* --- B1 inline expansion --- */
.aib-inline {
  border: 1px solid var(--ai); border-top: none;
  border-bottom-left-radius: var(--r-lg); border-bottom-right-radius: var(--r-lg);
  background: var(--surface); overflow: hidden;
}
.il-list { display: flex; flex-direction: column; padding: 5px 6px; }
.il-row { display: flex; align-items: flex-start; gap: 10px; padding: 9px 10px; border-radius: 9px; }
.il-row:hover { background: var(--ai-softer); }
.il-body { flex: 1; min-width: 0; }
.il-t { font-size: 12.5px; font-weight: 500; color: var(--ink); line-height: 1.35; }
.il-chip { display: inline-flex; align-items: center; gap: 3px; margin-top: 5px; font-size: 10.5px; color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--border); padding: 1px 7px; border-radius: var(--r-pill); }
.il-chip :deep(.ico) { color: var(--muted); }
.il-inv { flex: none; align-self: center; border: none; background: transparent; color: var(--ai-ink); font-weight: 600; font-size: 11.5px; padding: 4px 6px; border-radius: 6px; cursor: pointer; white-space: nowrap; }
.il-inv:hover { background: var(--ai-soft); }
.il-foot { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-top: 1px solid var(--border); background: var(--ai-softer); }
.foot-primary { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 13px; border: none; border-radius: 8px; background: var(--ai-grad); color: #fff; font-weight: 600; font-size: 12px; cursor: pointer; }
.foot-link { display: inline-flex; align-items: center; gap: 5px; border: none; background: transparent; color: var(--ink-2); font-weight: 600; font-size: 12px; cursor: pointer; }
.foot-link :deep(.ico) { color: var(--muted); }
.foot-link:hover { color: var(--ai-ink); }
.foot-link:hover :deep(.ico) { color: var(--ai); }

/* transitions */
.peek-enter-active, .peek-leave-active { transition: opacity .16s ease, transform .16s ease; }
.peek-enter-from, .peek-leave-to { opacity: 0; transform: translateY(-4px); }
.expand-enter-active, .expand-leave-active { transition: opacity .2s ease; }
.expand-enter-from, .expand-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .aib-chev, .peek-enter-active, .peek-leave-active, .expand-enter-active, .expand-leave-active { transition: none; } }

@media (max-width: 720px) { .aib-teaser { display: none; } }
</style>
