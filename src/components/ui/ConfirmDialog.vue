<script setup>
/**
 * ConfirmDialog — a small, focused "are you sure?" for destructive actions.
 *
 * Names the thing being deleted rather than saying "this item", because the whole
 * point of the pause is to let the user notice they picked the wrong one.
 *
 * Esc cancels; Enter confirms. The confirm button takes focus on open, but a
 * destructive default is only safe because the dialog is explicitly opt-in.
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import Icon from './Icon.vue'

defineProps({
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: '' },
  target: { type: String, default: '' },      // the thing's name, quoted in the copy
  confirmLabel: { type: String, default: 'Delete' },
  danger: { type: Boolean, default: true },
})
const emit = defineEmits(['confirm', 'cancel'])

const btn = ref(null)
function onKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); emit('cancel') }
  if (e.key === 'Enter') { e.preventDefault(); emit('confirm') }
}
onMounted(() => { addEventListener('keydown', onKey, true); btn.value?.focus() })
onBeforeUnmount(() => removeEventListener('keydown', onKey, true))
</script>

<template>
  <teleport to="body">
    <div class="cd-back" @click.self="emit('cancel')">
      <div class="cd" role="alertdialog" aria-modal="true">
        <div class="cd-head">
          <span class="cd-ico" :class="{ danger }"><Icon :name="danger ? 'alert' : 'info'" :size="18" /></span>
          <b>{{ title }}</b>
        </div>
        <!-- the space is interpolated: a literal one between the tags gets condensed away -->
        <p class="cd-msg">
          <b v-if="target" class="cd-t">“{{ target }}”</b>{{ target ? ' ' : '' }}{{ message }}
        </p>
        <div class="cd-foot">
          <button class="btn btn-sm" @click="emit('cancel')">Cancel</button>
          <button ref="btn" class="btn btn-sm" :class="danger ? 'danger-solid' : 'btn-primary'" @click="emit('confirm')">
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.cd-back { position: fixed; inset: 0; z-index: 400; background: rgba(27, 28, 46, .38); display: grid; place-items: center; padding: 20px; }
.cd { width: 340px; max-width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--sh-lg); padding: 16px 18px; }
.cd-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.cd-head b { font-size: 14.5px; color: var(--ink); }
.cd-ico { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border-radius: 9px; background: var(--surface-2); color: var(--muted); }
.cd-ico.danger { background: var(--red-soft); color: var(--red); }
.cd-msg { margin: 0 0 16px; font-size: 13px; line-height: 1.55; color: var(--ink-2); }
.cd-t { color: var(--ink); font-weight: 600; }
.cd-foot { display: flex; justify-content: flex-end; gap: 8px; }
.danger-solid { background: var(--red); border-color: var(--red); color: #fff; font-weight: 600; }
.danger-solid:hover { filter: brightness(.94); }
</style>
