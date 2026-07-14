<script setup>
/**
 * FilterMenu — one filter icon, two levels.
 *
 *   click the icon        → the list of filterable FIELDS, each with a ▸
 *   hover / click a field → its VALUES, multi-select with checkboxes
 *
 * Used by both the Manage-all list and the Shortcut tables, so the two filter the
 * same way. Values within a field are OR (Open *or* In Progress); fields are AND
 * (Status is Open AND Priority is P1) — the only reading that makes a multi-select
 * inside one field useful at all.
 *
 * v-model is { [fieldKey]: string[] }. An empty array means "no filter on this
 * field", never "match nothing".
 */
import { computed, ref, nextTick, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  // [{ key, label, options: string[] }]
  fields: { type: Array, required: true },
  modelValue: { type: Object, default: () => ({}) },
  label: { type: String, default: 'Filter' },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const btn = ref(null)
const pos = ref({ top: 0, left: 0, subRight: true })
const activeField = ref(null)     // which field's value list is showing

const active = computed(() => props.fields.find((f) => f.key === activeField.value) || null)
const count = computed(() =>
  Object.values(props.modelValue).reduce((n, v) => n + ((v?.length) ? 1 : 0), 0))

const picked = (key) => props.modelValue[key] || []
const isOn = (key, v) => picked(key).includes(v)

function toggle(key, v) {
  const cur = picked(key)
  const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
  const m = { ...props.modelValue }
  if (next.length) m[key] = next
  else delete m[key]              // drop the key entirely — an empty array is not a filter
  emit('update:modelValue', m)
}
function clearField(key) {
  const m = { ...props.modelValue }
  delete m[key]
  emit('update:modelValue', m)
}
function clearAll() { emit('update:modelValue', {}) }

const W = 210, SUB_W = 210, GAP = 4, EDGE = 8

/* The trigger usually sits at the right of a toolbar, so the panel gets clamped to
 * the right edge — and the submenu, opening at left:100%, then landed entirely
 * OFF-SCREEN. It was rendering the whole time, just outside the viewport. So the
 * submenu flips to the left of the panel whenever the right won't fit. */
function place() {
  const r = btn.value?.getBoundingClientRect()
  if (!r) return
  const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - W - EDGE))
  pos.value = {
    top: r.bottom + 6,
    left,
    subRight: left + W + GAP + SUB_W + EDGE <= window.innerWidth,
  }
}
function toggleOpen() {
  open.value = !open.value
  activeField.value = null
  if (open.value) { nextTick(place); addEventListener('scroll', place, true); addEventListener('resize', place) }
  else detach()
}
function close() { open.value = false; activeField.value = null; detach() }
function detach() {
  removeEventListener('scroll', place, true)
  removeEventListener('resize', place)
}
onBeforeUnmount(detach)
</script>

<template>
  <div class="fm">
    <button ref="btn" class="fm-btn" :class="{ on: open || count }" :title="label" @click.stop="toggleOpen">
      <Icon name="filter" :size="15" />
      <span v-if="count" class="fm-dot">{{ count }}</span>
    </button>

    <teleport to="body">
      <div v-if="open" class="fm-back" @click="close" />
      <div v-if="open" class="fm-pop" :style="{ top: pos.top + 'px', left: pos.left + 'px' }" @click.stop>
        <!-- level 1: the fields -->
        <div class="fm-head">
          <span>{{ label }} by</span>
          <button v-if="count" class="fm-clr" @click="clearAll">Clear all</button>
        </div>
        <button
          v-for="f in fields" :key="f.key" class="fm-item"
          :class="{ on: activeField === f.key, has: picked(f.key).length }"
          @mouseenter="activeField = f.key" @click="activeField = activeField === f.key ? null : f.key"
        >
          <span class="fm-l">{{ f.label }}</span>
          <span v-if="picked(f.key).length" class="fm-n">{{ picked(f.key).length }}</span>
          <Icon name="chevron-right" :size="15" class="fm-c" />
        </button>

        <!-- level 2: that field's values, multi-select -->
        <div v-if="active" class="fm-sub" :class="{ left: !pos.subRight }" @mouseenter="activeField = active.key">
          <div class="fm-head">
            <span>{{ active.label }}</span>
            <button v-if="picked(active.key).length" class="fm-clr" @click="clearField(active.key)">Clear</button>
          </div>
          <div class="fm-vals">
            <label v-for="o in active.options" :key="o" class="fm-val" :class="{ on: isOn(active.key, o) }">
              <input type="checkbox" :checked="isOn(active.key, o)" @change="toggle(active.key, o)" />
              <span class="ellip">{{ o }}</span>
            </label>
            <p v-if="!active.options.length" class="fm-empty">Nothing to filter on.</p>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.fm { position: relative; display: inline-flex; }
.fm-btn { position: relative; width: 34px; height: 34px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--muted); border-radius: 8px; display: grid; place-items: center; }
.fm-btn:hover { color: var(--ink); background: var(--surface-2); }
.fm-btn.on { border-color: var(--primary); color: var(--primary-700); background: var(--primary-soft); }
.fm-dot { position: absolute; top: -5px; right: -5px; min-width: 15px; height: 15px; padding: 0 3px; display: grid; place-items: center; background: var(--primary); color: #fff; border-radius: 999px; font-size: 9.5px; font-weight: 700; line-height: 1; }

.fm-back { position: fixed; inset: 0; z-index: 149; }
.fm-pop { position: fixed; z-index: 150; width: 210px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh-pop); padding: 6px; }

.fm-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 7px 6px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); }
.fm-clr { border: none; background: transparent; color: var(--primary-700); font-size: 10.5px; font-weight: 700; text-transform: none; letter-spacing: 0; }
.fm-clr:hover { text-decoration: underline; }

.fm-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 8px; border: none; background: transparent; border-radius: 7px; color: var(--ink-2); font-size: 13px; text-align: left; }
.fm-item:hover, .fm-item.on { background: var(--surface-2); color: var(--ink); }
.fm-l { flex: 1; min-width: 0; }
.fm-n { flex: none; min-width: 16px; height: 16px; padding: 0 4px; display: grid; place-items: center; background: var(--primary); color: #fff; border-radius: 999px; font-size: 10px; font-weight: 700; }
.fm-c { color: var(--muted-2); flex: none; }

/* level 2 flies out to the right of the field list */
.fm-sub { position: absolute; top: 0; left: calc(100% + 4px); width: 210px; max-height: 320px; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh-pop); padding: 6px; }
/* no room on the right (the panel is clamped to the viewport edge) → fly out left */
.fm-sub.left { left: auto; right: calc(100% + 4px); }
.fm-vals { flex: 1; overflow: auto; min-height: 0; display: flex; flex-direction: column; gap: 1px; }
.fm-val { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 7px; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.fm-val:hover { background: var(--surface-2); }
.fm-val.on { color: var(--primary-700); font-weight: 500; }
.fm-val input { accent-color: var(--primary); flex: none; }
.fm-empty { margin: 0; padding: 12px 8px; text-align: center; font-size: 12px; color: var(--muted-2); }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
