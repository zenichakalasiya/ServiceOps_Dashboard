<script setup>
/**
 * AiAskInput — the "Ask AI for insights, summaries, and actions…" bar from the
 * ServiceOps reference. Reused by the summary card footer, the bottom pill (B4)
 * and the prompt-bar entry (B6). Purely presentational: emits `submit` with the
 * typed text (or empty on a bare click, so a click can just open the panel).
 */
import { ref } from 'vue'
import Icon from '../ui/Icon.vue'

const props = defineProps({
  placeholder: { type: String, default: 'Ask AI for insights, summaries, and actions…' },
  size: { type: String, default: 'md' },      // md | lg
  autofocus: { type: Boolean, default: false },
})
const emit = defineEmits(['submit', 'open'])
const text = ref('')
function go() { emit('submit', text.value.trim()); text.value = '' }
</script>

<template>
  <div class="ai-ask" :class="size" @click="emit('open')">
    <span class="aa-spark"><Icon name="sparkles" :size="size === 'lg' ? 18 : 15" /></span>
    <input
      v-model="text" :placeholder="placeholder" :autofocus="autofocus"
      @keyup.enter="go" @click.stop
    />
    <button class="aa-send" :class="{ ready: text.trim() }" title="Ask AI" @click.stop="go">
      <Icon name="open-in" :size="size === 'lg' ? 17 : 15" />
    </button>
  </div>
</template>

<style scoped>
/* Soft lavender field with a gradient sparkle — the reference "Ask AI…" input. */
.ai-ask {
  display: flex; align-items: center; gap: 9px; width: 100%;
  height: 40px; padding: 0 6px 0 12px; cursor: text;
  border: 1px solid var(--ai-border); border-radius: var(--r-pill);
  background: var(--ai-softer);
  transition: border-color .14s, box-shadow .14s, background .14s;
}
.ai-ask.lg { height: 48px; padding: 0 8px 0 15px; }
.ai-ask:hover { border-color: var(--ai); }
.ai-ask:focus-within { border-color: var(--ai); box-shadow: 0 0 0 3px var(--ai-soft); background: var(--surface); }
.aa-spark { flex: none; display: grid; place-items: center; color: var(--ai); }
/* gradient-fill the glyph so it matches the reference sparkle */
.aa-spark :deep(.ico) {
  background: var(--ai-grad); -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
.ai-ask input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-family: inherit; font-size: 13px; color: var(--ink);
}
.ai-ask.lg input { font-size: 14px; }
.ai-ask input::placeholder { color: var(--ai-ink); opacity: .6; }
.aa-send {
  flex: none; width: 30px; height: 30px; border: none; border-radius: 50%;
  display: grid; place-items: center; color: var(--muted); background: transparent;
  transition: all .14s;
}
.ai-ask.lg .aa-send { width: 36px; height: 36px; }
.aa-send.ready { background: var(--ai-grad); color: #fff; }
.aa-send:not(.ready):hover { background: var(--ai-soft); color: var(--ai-ink); }
</style>
