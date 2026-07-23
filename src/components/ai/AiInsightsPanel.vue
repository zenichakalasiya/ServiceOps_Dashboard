<script setup>
/**
 * AiInsightsPanel — the shared right-docked panel every variant opens.
 *
 * This is the component that survives whichever placement wins. It renders the five
 * mock insights (data/aiInsights.mock.js); selecting one expands its detail inline.
 * Header carries a title, a pin toggle, and a close control.
 *
 * Docking is the LAB's job (it lays the panel out as a flex sibling that pushes content);
 * this component only owns its own chrome, the list, focus handling, and Esc-to-close.
 *
 * Accessibility: role=dialog, focus is trapped while open, Esc closes, and focus returns
 * to the trigger the lab hands in via `returnFocusTo`.
 */
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import Icon from '../ui/Icon.vue'
import { AI_INSIGHTS } from '../../data/aiInsights.mock.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  // the element focus should return to when the panel closes (the variant's trigger)
  returnFocusTo: { type: Object, default: null },
})
const emit = defineEmits(['close', 'update:pinned'])

const expanded = ref(AI_INSIGHTS[0].id)   // first insight open by default
function toggle(id) { expanded.value = expanded.value === id ? null : id }
const dotClass = (s) => (s === 'bad' ? 'bad' : s === 'warn' ? 'warn' : 'good')

const panelEl = ref(null)
const closeBtn = ref(null)

// focus the panel's close button when it opens; return focus to the trigger on close
watch(() => props.open, (isOpen, was) => {
  if (isOpen) nextTick(() => closeBtn.value?.focus())
  else if (was) props.returnFocusTo?.focus?.()
})

// Esc closes; Tab is trapped within the panel while it is open
function onKeydown(e) {
  if (!props.open) return
  if (e.key === 'Escape') { e.stopPropagation(); emit('close'); return }
  if (e.key !== 'Tab') return
  const focusables = panelEl.value?.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')
  if (!focusables || !focusables.length) return
  const first = focusables[0], last = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
watch(() => props.open, (v) => {
  if (v) document.addEventListener('keydown', onKeydown, true)
  else document.removeEventListener('keydown', onKeydown, true)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <aside
    v-if="open" ref="panelEl" class="aip" role="dialog" aria-modal="false" aria-label="AI insights"
  >
    <header class="aip-head">
      <span class="aip-spark"><Icon name="sparkles" :size="16" /></span>
      <h2 class="aip-title">AI insights</h2>
      <button
        class="aip-ic" :class="{ on: pinned }" :aria-pressed="pinned"
        :title="pinned ? 'Unpin panel' : 'Pin panel open'" @click="emit('update:pinned', !pinned)"
      ><Icon name="pin" :size="15" /></button>
      <button ref="closeBtn" class="aip-ic" title="Close" @click="emit('close')"><Icon name="x" :size="17" /></button>
    </header>

    <div class="aip-body">
      <button
        v-for="it in AI_INSIGHTS" :key="it.id" class="ins" :class="{ open: expanded === it.id }"
        :aria-expanded="expanded === it.id" @click="toggle(it.id)"
      >
        <span class="ins-dot" :class="dotClass(it.severity)" />
        <span class="ins-main">
          <span class="ins-title">{{ it.title }}</span>
          <span v-if="expanded === it.id" class="ins-detail">{{ it.detail }}</span>
          <span class="ins-from"><Icon name="chart-bar" :size="11" /> {{ it.widgetTitle }}</span>
        </span>
        <Icon name="chevron-down" :size="15" class="ins-chev" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
/* the panel fills the column the lab gives it (push layout owns the width) */
.aip { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--surface); border-left: 1px solid var(--ai-border); }
.aip-head { display: flex; align-items: center; gap: 9px; padding: 12px 12px 12px 14px; border-bottom: 1px solid var(--border); background: var(--ai-grad-card); }
.aip-spark { flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: var(--ai-softer); }
.aip-spark :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.aip-title { flex: 1; margin: 0; font-size: 14.5px; font-weight: 600; color: var(--ink); }
.aip-ic { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.aip-ic:hover { background: var(--surface); color: var(--ink); }
.aip-ic.on { color: var(--ai-ink); background: var(--ai-soft); }
.aip-ic:focus-visible { outline: 2px solid var(--ai); outline-offset: 1px; }

.aip-body { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 3px; }
.ins { display: flex; align-items: flex-start; gap: 10px; width: 100%; text-align: left; padding: 11px 10px; border: 1px solid transparent; border-radius: 10px; background: transparent; cursor: pointer; }
.ins:hover { background: var(--ai-softer); }
.ins.open { background: var(--ai-softer); border-color: var(--ai-border); }
.ins:focus-visible { outline: 2px solid var(--ai); outline-offset: 1px; }
.ins-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; }
.ins-dot.bad { background: var(--red); } .ins-dot.warn { background: var(--amber); } .ins-dot.good { background: var(--green); }
.ins-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.ins-title { font-size: 13px; font-weight: 600; color: var(--ink); line-height: 1.4; }
.ins-detail { font-size: 12.5px; color: var(--ink-2); line-height: 1.5; }
.ins-from { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); }
.ins-from :deep(.ico) { color: var(--muted-2); }
.ins-chev { flex: none; color: var(--muted-2); margin-top: 3px; transition: transform .14s; }
.ins.open .ins-chev { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .ins-chev { transition: none; } }
</style>
