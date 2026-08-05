<script setup>
/* A range FIELD, not a dropdown: a read-only box showing the chosen range with a calendar
 * button on its right. Clicking either opens the same two-pane popover the topbar time
 * filter and a tile's calendar use — absolute From/To on the left, searchable quick ranges
 * on the right.
 *
 * A <select> was wrong here for the same reason it is wrong in the topbar: a range can be
 * a named preset OR an absolute From→To, and a dropdown can only offer the first. The
 * calendar is what says "this opens a date picker", which is exactly what it does.
 */
import { ref, computed, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { windowFor, stampFor } from '../../data/timeRanges.js'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const pos = ref({ top: 0, left: 0 })
const from = ref('')
const to = ref('')
const fieldEl = ref(null)
const fromEl = ref(null)
const toEl = ref(null)
const W = 288
const H = 244

// the tooltip resolves the value to real timestamps — the part a label can never carry
const title = computed(() => {
  if (!props.modelValue) return 'Pick a date range'
  const { start, end } = windowFor(props.modelValue)
  return `${stampFor(start)} → ${stampFor(end)}`
})

function toggle() {
  if (open.value) { open.value = false; return }
  const r = fieldEl.value?.getBoundingClientRect(); if (!r) return
  // flip above when there is no room below — this sits low in a scrolling config column
  const flip = r.bottom + H > window.innerHeight
  pos.value = {
    top: flip ? Math.max(8, r.top - H - 6) : r.bottom + 6,
    left: Math.max(8, Math.min(r.left, window.innerWidth - W - 8)),
  }
  open.value = true
}
function applyAbs() {
  if (!from.value || !to.value) return
  const fmt = (s) => { const [Y, M, D] = s.split('T')[0].split('-'); return `${D}/${M}/${Y.slice(2)}` }
  emit('update:modelValue', `${fmt(from.value)} – ${fmt(to.value)}`)
  open.value = false
}
function openPicker(el) { try { el?.showPicker?.() } catch (e) { el?.focus() } }
const onScroll = () => { open.value = false }
window.addEventListener('scroll', onScroll, true)
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll, true))
</script>

<template>
  <div ref="fieldEl" class="drf" :class="{ on: open }" :title="title" @click="toggle">
    <span class="drf-v" :class="{ ph: !modelValue }">{{ modelValue || 'Select a date range' }}</span>
    <button type="button" class="drf-cal" tabindex="-1"><Icon name="calendar" :size="16" /></button>
  </div>

  <teleport to="body">
    <div v-if="open" class="drf-back" @click="open = false" />
    <transition name="pop">
      <!-- The calendar, and only the calendar. This field asks for a date RANGE, so it
           offers From and To; the quick-range list that the topbar and a tile's header
           calendar carry would be a second, differently-shaped answer to the same
           question inside a form that has already committed to explicit dates. -->
      <div v-if="open" class="drf-pop" :style="{ top: pos.top + 'px', left: pos.left + 'px' }" @click.stop>
        <div class="drf-abs">
          <div class="drf-h">Select a date range</div>
          <div class="drf-fb">
            <label>From</label>
            <div class="drf-dt"><input ref="fromEl" class="input" type="datetime-local" v-model="from" /><button type="button" class="drf-ci" @click="openPicker(fromEl)" title="Pick date"><Icon name="calendar" :size="15" /></button></div>
          </div>
          <div class="drf-fb">
            <label>To</label>
            <div class="drf-dt"><input ref="toEl" class="input" type="datetime-local" v-model="to" /><button type="button" class="drf-ci" @click="openPicker(toEl)" title="Pick date"><Icon name="calendar" :size="15" /></button></div>
          </div>
          <div class="drf-foot">
            <button type="button" class="btn btn-sm" @click="open = false">Cancel</button>
            <button type="button" class="btn btn-sm btn-primary" :disabled="!from || !to" @click="applyAbs">Apply</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.drf { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 4px 0 12px; border: 1px solid var(--border-strong); border-radius: 9px; background: var(--surface); cursor: pointer; }
.drf:hover { border-color: var(--primary); }
.drf.on { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.drf-v { flex: 1; min-width: 0; font-size: 13.5px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drf-v.ph { color: var(--muted-2); }
.drf-cal { flex: none; width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.drf:hover .drf-cal, .drf.on .drf-cal { color: var(--primary); }

.drf-back { position: fixed; inset: 0; z-index: 300; }
/* one pane — no quick-range column, so it is the width of the From/To fields alone */
.drf-pop { position: fixed; z-index: 301; width: 288px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--sh-pop); overflow: hidden; }
.drf-abs { padding: 16px; display: flex; flex-direction: column; }
.drf-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
.drf-h { font-weight: 600; font-size: 13px; margin-bottom: 12px; }
.drf-fb { display: flex; flex-direction: column; margin-bottom: 12px; }
.drf-fb label { font-size: 12px; font-weight: 500; color: var(--ink-2); margin-bottom: 5px; }
.drf-dt { position: relative; }
.drf-dt .input { height: 36px; font-size: 12.5px; padding-right: 36px; width: 100%; }
.drf-dt .input::-webkit-calendar-picker-indicator { opacity: 0; }
.drf-ci { position: absolute; right: 4px; top: 4px; width: 28px; height: 28px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.drf-ci:hover { background: var(--surface-2); color: var(--ink); }
</style>
