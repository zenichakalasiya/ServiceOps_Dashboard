<script setup>
/**
 * MeasureConditions — the one condition editor every chart type shares (§5 of the
 * PMG-ACT-01 configuration reference). Rows are ANDed: `field is value`, drawn from
 * the categorical vocabulary in records.js. Changing a row's field snaps its value to
 * that field's first option. Booleans (Reopened/Escalated) present as Yes/No.
 *
 * v-model is the conds array [{ field, value }]. Gauge's Measurement reuses this twice
 * (base population + numerator), which is why the empty-state copy is a prop.
 */
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import Dropdown from '../ui/Dropdown.vue'
import { CONDITION_FIELD_LABELS, valuesFor } from '../../data/records.js'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  emptyText: { type: String, default: 'No conditions — every record counts.' },
})
const emit = defineEmits(['update:modelValue'])
const rows = computed(() => props.modelValue || [])
const set = (next) => emit('update:modelValue', next)

function add() {
  const field = CONDITION_FIELD_LABELS[0]
  set([...rows.value, { field, value: valuesFor(field)[0] }])
}
function remove(i) { set(rows.value.filter((_, k) => k !== i)) }
// changing the field invalidates the old value → snap to the new field's first option
function setField(i, field) { set(rows.value.map((r, k) => (k === i ? { field, value: valuesFor(field)[0] } : r))) }
function setValue(i, value) { set(rows.value.map((r, k) => (k === i ? { ...r, value } : r))) }
</script>

<template>
  <div class="mconds">
    <p v-if="!rows.length" class="hint mc-empty">{{ emptyText }}</p>
    <div v-for="(row, i) in rows" :key="i" class="mc-row">
      <Dropdown class="mc-dd" :modelValue="row.field" :options="CONDITION_FIELD_LABELS" @update:modelValue="setField(i, $event)" />
      <span class="mc-is">is</span>
      <Dropdown class="mc-dd" :modelValue="row.value" :options="valuesFor(row.field)" @update:modelValue="setValue(i, $event)" />
      <button class="mc-x" title="Remove condition" @click="remove(i)"><Icon name="x" :size="14" /></button>
    </div>
    <button class="mc-add" @click="add"><Icon name="plus" :size="14" /> Add Condition</button>
  </div>
</template>

<style scoped>
.mconds { display: flex; flex-direction: column; gap: 8px; }
.mc-empty { margin: 0; }
.mc-row { display: flex; align-items: center; gap: 8px; }
.mc-dd { flex: 1; min-width: 0; }
.mc-is { flex: none; font-size: 12.5px; color: var(--muted); }
.mc-x { flex: none; width: 28px; height: 28px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.mc-x:hover { background: var(--red-soft); color: var(--red); }
.mc-add { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; border: 1px dashed var(--border-strong); background: transparent; color: var(--primary-700); border-radius: 8px; padding: 7px 12px; font-size: 12.5px; font-weight: 600; }
.mc-add:hover { background: var(--primary-softer); border-color: var(--primary); }
</style>
