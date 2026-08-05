<script setup>
/**
 * TableFilterBar — the Requests-style filter bar for a Shortcut tile.
 *
 * One field does two jobs, which is the whole point of the pattern: TYPE to search the
 * records, or CLICK to pick a field and build a condition. Splitting them into a search
 * box and a separate filter widget is what the design replaces.
 *
 * Picking a field adds its chip immediately and opens the operator popover under it, so
 * the chip is visible while you configure it rather than appearing only once you commit.
 * An unfinished chip filters nothing (condReady), so a half-built condition never
 * silently empties the table.
 *
 * Lives in its own component because WidgetCard is already long, and this owns three
 * layered popovers of its own.
 */
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import Icon from '../ui/Icon.vue'
import Dropdown from '../ui/Dropdown.vue'
import { conditionFields, TEXT_OPS, ENUM_OPS, opLabelFor, condValueText, condReady } from '../../data/filters.js'

const props = defineProps({
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },   // conditions
  search: { type: String, default: '' },
  /* A caller that already knows its filterable fields passes them straight in — the
   * Manage grid's columns are computed properties of a dashboard (Visibility, Owner,
   * Status), not raw cells, so there is nothing for conditionFields to infer them from. */
  fields: { type: Array, default: null },
  /* the Shortcut tile's bar is opened from a filter icon and has to close again; a
   * screen whose bar is permanent has nothing to close, so it hides the ✕ */
  closable: { type: Boolean, default: true },
  placeholder: { type: String, default: 'Select field or enter a keyword to search…' },
})
const emit = defineEmits(['update:modelValue', 'update:search', 'close'])

const fields = computed(() => props.fields || conditionFields(props.columns, props.rows))
const fieldOf = (c) => fields.value.find((f) => f.key === c.key)
const conds = computed(() => props.modelValue || [])
const setConds = (next) => emit('update:modelValue', next)

const q = computed({ get: () => props.search, set: (v) => emit('update:search', v) })

// ---- field list ----------------------------------------------------------
const boxEl = ref(null)
const inputEl = ref(null)
const fieldsOpen = ref(false)
const fieldPos = ref({ top: 0, left: 0 })
function openFields() {
  const r = boxEl.value?.getBoundingClientRect(); if (!r) return
  fieldPos.value = { top: r.bottom + 6, left: Math.min(r.left + 8, window.innerWidth - 232) }
  fieldsOpen.value = true
}
function pickField(f) {
  fieldsOpen.value = false
  const cond = { key: f.key, op: f.type === 'enum' ? 'is' : 'contains', values: [], value: '' }
  setConds([...conds.value, cond])
  // the chip has to exist before it can be anchored to
  nextTick(() => editCond(conds.value.length - 1))
}

// ---- operator / value popover -------------------------------------------
const editing = ref(-1)
const editPos = ref({ top: 0, left: 0 })
const chipEls = ref([])
const draft = ref(null)
function editCond(i) {
  const c = conds.value[i]; if (!c) return
  const el = chipEls.value[i] || boxEl.value
  const r = el?.getBoundingClientRect(); if (!r) return
  editPos.value = { top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 312)) }
  draft.value = { op: c.op, values: [...(c.values || [])], value: c.value || '' }
  editing.value = i
  nextTick(() => valueEl.value?.focus?.())
}
const valueEl = ref(null)
const editField = computed(() => (editing.value >= 0 ? fieldOf(conds.value[editing.value]) : null))
const opOptions = computed(() => (editField.value?.type === 'enum' ? ENUM_OPS : TEXT_OPS))
function toggleValue(v) {
  const cur = draft.value.values
  draft.value.values = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
}
function done() {
  const next = conds.value.map((c, i) => (i === editing.value ? { ...c, ...draft.value } : c))
  // a chip you opened and left empty is abandoned rather than kept as a no-op
  setConds(next.filter((c, i) => (i === editing.value ? condReady(c) : true)))
  editing.value = -1
}
function cancelEdit() {
  // closing without choosing anything discards a brand-new, still-empty chip
  setConds(conds.value.filter((c, i) => !(i === editing.value && !condReady(c))))
  editing.value = -1
}
function removeCond(i) {
  if (editing.value === i) editing.value = -1
  setConds(conds.value.filter((_, k) => k !== i))
}

const chipText = (c) => ({ field: fieldOf(c)?.label || c.key, op: opLabelFor(c, fieldOf(c)), val: condValueText(c) })

function onEsc(e) { if (e.key === 'Escape') { fieldsOpen.value = false; cancelEdit() } }
addEventListener('keydown', onEsc)
onBeforeUnmount(() => removeEventListener('keydown', onEsc))
</script>

<template>
  <div class="tfb">
    <div ref="boxEl" class="tfb-box" :class="{ act: fieldsOpen || editing >= 0 }" @click="openFields">
      <Icon name="search" :size="14" class="mu" />

      <span
        v-for="(c, i) in conds" :key="i" :ref="(el) => (chipEls[i] = el)"
        class="fchip" :class="{ on: editing === i, draft: !condReady(c) }"
        :title="`Edit this condition`" @click.stop="editCond(i)"
      >
        <b>{{ chipText(c).field }}</b>
        <template v-if="condReady(c)"><em>{{ chipText(c).op }}</em><b class="v">{{ chipText(c).val }}</b></template>
        <button title="Remove" @click.stop="removeCond(i)"><Icon name="x" :size="10" /></button>
      </span>

      <input
        ref="inputEl" v-model="q" class="tfb-in"
        :placeholder="placeholder"
        @focus="openFields" @click.stop="openFields"
      />
    </div>
    <button v-if="closable" class="tfb-x" title="Close" @click="emit('close')"><Icon name="x" :size="16" /></button>

    <teleport to="body">
      <!-- fields -->
      <div v-if="fieldsOpen" class="tfb-back" @click="fieldsOpen = false" />
      <div v-if="fieldsOpen" class="tfb-fields" :style="{ top: fieldPos.top + 'px', left: fieldPos.left + 'px' }" @click.stop>
        <button v-for="f in fields" :key="f.key" class="tfb-f" @click="pickField(f)">{{ f.label }}</button>
        <p v-if="!fields.length" class="tfb-empty">No fields to filter on.</p>
      </div>

      <!-- operator + value -->
      <div v-if="editing >= 0" class="tfb-back" @click="cancelEdit" />
      <div v-if="editing >= 0 && draft" class="tfb-cond" :style="{ top: editPos.top + 'px', left: editPos.left + 'px' }" @click.stop>
        <label class="tfb-l">Operator</label>
        <Dropdown v-model="draft.op" :options="opOptions" />

        <template v-if="editField?.type === 'enum'">
          <div class="tfb-vals">
            <label v-for="o in editField.options" :key="o" class="tfb-v" :class="{ on: draft.values.includes(o) }">
              <input type="checkbox" :checked="draft.values.includes(o)" @change="toggleValue(o)" />
              <span class="ellip">{{ o }}</span>
            </label>
          </div>
        </template>
        <input v-else ref="valueEl" class="input tfb-t" v-model="draft.value" :placeholder="editField?.label" @keyup.enter="done" />

        <div class="tfb-foot"><button class="btn btn-sm" @click="done">Done</button></div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.tfb { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
/* the whole bar is ONE field — chips and the query share it, as the design draws it */
.tfb-box { flex: 1; min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-height: 34px; padding: 4px 8px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); cursor: text; }
.tfb-box.act, .tfb-box:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.mu { color: var(--muted); flex: none; }
.tfb-in { flex: 1; min-width: 120px; border: none; outline: none; background: transparent; font-size: 12.5px; color: var(--ink); }
.tfb-x { flex: none; width: 28px; height: 28px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.tfb-x:hover { background: var(--surface-2); color: var(--ink); }

/* a condition, stated the way the product states it: Field Operator Value */
.fchip { display: inline-flex; align-items: center; gap: 4px; flex: none; max-width: 240px; height: 22px; padding: 0 4px 0 8px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); font-size: 11.5px; color: var(--ink-2); white-space: nowrap; cursor: pointer; }
.fchip:hover { border-color: var(--border-strong); }
.fchip.on { border-color: var(--primary); background: var(--primary-soft); }
/* still being built — it filters nothing until it has a value */
.fchip.draft { border-style: dashed; color: var(--muted); }
.fchip b { font-weight: 600; color: var(--ink); }
.fchip b.v { overflow: hidden; text-overflow: ellipsis; }
.fchip em { font-style: normal; color: var(--muted); }
.fchip button { flex: none; width: 15px; height: 15px; border: none; background: transparent; color: var(--muted); border-radius: 4px; display: grid; place-items: center; }
.fchip button:hover { background: var(--border); color: var(--ink); }

.tfb-back { position: fixed; inset: 0; z-index: 210; }
/* field list */
.tfb-fields { position: fixed; z-index: 211; width: 224px; max-height: 320px; overflow: auto; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh-pop); padding: 6px; }
.tfb-f { display: block; width: 100%; text-align: left; padding: 8px 10px; border: none; background: transparent; border-radius: 7px; font-size: 13px; color: var(--ink-2); }
.tfb-f:hover { background: var(--surface-2); color: var(--ink); }
.tfb-empty { margin: 0; padding: 12px; text-align: center; font-size: 12px; color: var(--muted-2); }
/* operator + value */
.tfb-cond { position: fixed; z-index: 211; width: 304px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh-pop); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.tfb-l { font-size: 12px; font-weight: 500; color: var(--ink-2); }
.tfb-t { width: 100%; }
.tfb-vals { max-height: 190px; overflow: auto; display: flex; flex-direction: column; gap: 1px; }
.tfb-v { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 7px; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.tfb-v:hover { background: var(--surface-2); }
.tfb-v.on { color: var(--primary-700); font-weight: 500; }
.tfb-v input { accent-color: var(--primary); flex: none; }
.tfb-foot { display: flex; justify-content: flex-end; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
