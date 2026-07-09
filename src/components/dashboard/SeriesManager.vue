<script setup>
/**
 * SeriesManager — the legend, promoted into a real control surface.
 *
 * Used by ChartTile legend modes ③ (inline side panel) and ④ (overflow popover).
 * Nobody should click 50 times to hide 50 series, so the verb set is:
 *   click = isolate · ctrl/cmd-click = toggle · shift-click = range · dbl-click = reset
 *   plus bulk: All · None · Invert · Hide unselected · Keep top 10
 *   plus search: Show only matching / Hide matching
 */
import { computed, ref } from 'vue'
import Icon from '../ui/Icon.vue'

const props = defineProps({
  entities: { type: Array, required: true },   // [{ key, name, value, color }]
  hidden: { type: Object, required: true },    // Set<key>
  total: { type: Number, required: true },     // pre-truncation denominator
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['isolate', 'toggle', 'range', 'reset', 'bulk', 'recolor'])

const q = ref('')
const sortKey = ref('value')   // 'name' | 'value'
const sortDir = ref('desc')

function sortBy(k) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = k; sortDir.value = k === 'name' ? 'asc' : 'desc' }
}

const matching = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return needle ? props.entities.filter((e) => e.name.toLowerCase().includes(needle)) : props.entities
})

const rows = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...matching.value].sort((a, b) =>
    sortKey.value === 'name' ? a.name.localeCompare(b.name) * dir : (a.value - b.value) * dir)
})

const shownCount = computed(() => props.entities.length - props.hidden.size)
const pct = (v) => ((v / props.total) * 100).toFixed(1)

function onRowClick(e, ent) {
  if (e.shiftKey) emit('range', ent.key)
  else if (e.ctrlKey || e.metaKey) emit('toggle', ent.key)
  else emit('isolate', ent.key)
}
/* Search + a bulk verb = 50 series gone in two clicks. */
function applyToMatches(verb) {
  emit('bulk', { verb, keys: matching.value.map((e) => e.key) })
}
</script>

<template>
  <div class="sm" :class="{ compact }">
    <div class="sm-search">
      <Icon name="search" :size="13" class="mu" />
      <input v-model="q" placeholder="Search series…" />
      <button v-if="q" class="sx" title="Clear" @click="q = ''"><Icon name="x" :size="12" /></button>
    </div>

    <div v-if="q" class="sm-matchbar">
      <span>{{ matching.length }} match{{ matching.length === 1 ? '' : 'es' }}</span>
      <button @click="applyToMatches('only')">Show only</button>
      <button @click="applyToMatches('hide')">Hide these</button>
    </div>

    <div class="sm-verbs">
      <button title="Show every series" @click="emit('bulk', { verb: 'all' })">All</button>
      <button title="Hide every series" @click="emit('bulk', { verb: 'none' })">None</button>
      <button title="Swap shown and hidden" @click="emit('bulk', { verb: 'invert' })">Invert</button>
      <button title="Keep only the 10 largest by value" @click="emit('bulk', { verb: 'top', n: 10 })">Top&nbsp;10</button>
    </div>

    <div class="sm-head">
      <button class="sh" :class="{ on: sortKey === 'name' }" @click="sortBy('name')">
        Series <Icon v-if="sortKey === 'name'" :name="sortDir === 'asc' ? 'sort-asc' : 'sort-desc'" :size="11" />
      </button>
      <button class="sh num" :class="{ on: sortKey === 'value' }" @click="sortBy('value')">
        Value <Icon v-if="sortKey === 'value'" :name="sortDir === 'asc' ? 'sort-asc' : 'sort-desc'" :size="11" />
      </button>
    </div>

    <div class="sm-list" @dblclick="emit('reset')">
      <div
        v-for="e in rows" :key="e.key" class="sm-row"
        :class="{ off: hidden.has(e.key) }"
        :title="`${e.name} — click to isolate, Ctrl-click to toggle, Shift-click for a range`"
        @click="onRowClick($event, e)"
      >
        <label class="sw" :style="{ background: e.color }" @click.stop>
          <input type="color" :value="e.color" @input="emit('recolor', { key: e.key, color: $event.target.value })" />
        </label>
        <span class="nm">{{ e.name }}</span>
        <span class="vl">{{ e.value }}</span>
        <span class="pc">{{ pct(e.value) }}%</span>
      </div>
      <div v-if="!rows.length" class="sm-empty">No series match “{{ q }}”</div>
    </div>

    <div class="sm-foot">
      <b>{{ shownCount }}</b> of {{ entities.length }} series shown
      <button v-if="hidden.size" class="rst" @click="emit('reset')">Reset</button>
    </div>
  </div>
</template>

<style scoped>
.sm { display: flex; flex-direction: column; min-height: 0; gap: 6px; font-size: 12px; }
.sm-search { display: flex; align-items: center; gap: 6px; padding: 0 8px; height: 30px; background: var(--surface-2); border-radius: var(--r-sm); flex: none; }
.sm-search input { flex: 1; min-width: 0; border: none; background: transparent; outline: none; font: inherit; color: var(--ink); }
.mu { color: var(--muted); flex: none; }
.sx { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; padding: 0; }

.sm-matchbar { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); flex: none; }
.sm-matchbar button { border: 1px solid var(--border); background: var(--surface); color: var(--primary-700); border-radius: 5px; padding: 2px 6px; font-size: 11px; font-weight: 600; }
.sm-matchbar button:hover { background: var(--primary-soft); }

.sm-verbs { display: flex; gap: 4px; flex: none; }
.sm-verbs button { flex: 1; border: 1px solid var(--border); background: var(--surface); color: var(--ink-2); border-radius: 5px; padding: 3px 0; font-size: 11px; font-weight: 500; }
.sm-verbs button:hover { background: var(--surface-2); color: var(--ink); }

.sm-head { display: flex; align-items: center; gap: 6px; padding: 0 4px; border-bottom: 1px solid var(--border); flex: none; }
.sh { flex: 1; text-align: left; border: none; background: transparent; color: var(--muted); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; padding: 4px 0; display: inline-flex; align-items: center; gap: 3px; }
.sh.num { flex: none; }
.sh.on { color: var(--primary); }

/* virtualisation would go here for 1000+ series; 63 scrolls fine */
.sm-list { flex: 1; overflow: auto; min-height: 0; }
.sm-row { display: flex; align-items: center; gap: 7px; padding: 3px 4px; border-radius: 5px; cursor: pointer; user-select: none; }
.sm-row:hover { background: var(--surface-2); }
.sm-row.off { opacity: .38; }
.sm-row.off .nm { text-decoration: line-through; }
.sw { width: 10px; height: 10px; border-radius: 3px; flex: none; position: relative; overflow: hidden; cursor: pointer; }
.sw input { position: absolute; inset: -6px; opacity: 0; cursor: pointer; }
.nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2); }
.vl { font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
.pc { width: 42px; text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
.sm-empty { padding: 14px; text-align: center; color: var(--muted-2); }

.sm-foot { display: flex; align-items: center; gap: 6px; padding-top: 5px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; flex: none; }
.sm-foot b { color: var(--ink); }
.rst { margin-left: auto; border: none; background: transparent; color: var(--primary-700); font-weight: 600; font-size: 11px; }
.rst:hover { text-decoration: underline; }

.compact .sm-list { max-height: 240px; }
</style>
