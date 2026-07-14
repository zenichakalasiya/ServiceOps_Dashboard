<script setup>
/**
 * SeriesManager — the legend, promoted into a real control surface.
 *
 * Lives inside the rank pill's popover (ChartTile legend modes ② and ⑥): pick the
 * slice of the ranking on top, see exactly the series that slice plots underneath.
 *
 * One verb only: click a row to disable it, and its data leaves the chart. Click
 * again to bring it back. The bulk row (All / None / Invert / Top 10) was cut —
 * the rank window above already does that job, and two ways to say "top 10" in
 * one panel is one way too many.
 *
 * Search collapses to an icon so the list gets the vertical space instead.
 */
import { computed, nextTick, ref, watch } from 'vue'
import Icon from '../ui/Icon.vue'

const props = defineProps({
  entities: { type: Array, required: true },   // [{ key, name, value, color }]
  hidden: { type: Object, required: true },    // Set<key>
  total: { type: Number, required: true },     // pre-truncation denominator
  compact: { type: Boolean, default: false },
  // only the All tab lists the whole set, so only there is searching it meaningful
  searchable: { type: Boolean, default: true },
})
// leaving All collapses the search — a stale needle must not silently filter the list
watch(() => props.searchable, (on) => { if (!on) closeSearch() })
const emit = defineEmits(['toggle', 'reset', 'recolor'])

const q = ref('')
const searchOpen = ref(false)
const searchInput = ref(null)
const sortKey = ref('value')   // 'name' | 'value'
const sortDir = ref('desc')

function openSearch() {
  searchOpen.value = true
  nextTick(() => searchInput.value?.focus())
}
// closing clears the needle too — a collapsed icon must never filter the list silently
function closeSearch() {
  q.value = ''
  searchOpen.value = false
}

function sortBy(k) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = k; sortDir.value = k === 'name' ? 'asc' : 'desc' }
}

const rows = computed(() => {
  const needle = q.value.trim().toLowerCase()
  const list = needle ? props.entities.filter((e) => e.name.toLowerCase().includes(needle)) : props.entities
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...list].sort((a, b) =>
    sortKey.value === 'name' ? a.name.localeCompare(b.name) * dir : (a.value - b.value) * dir)
})

const shownCount = computed(() => props.entities.length - props.hidden.size)
const pct = (v) => ((v / props.total) * 100).toFixed(1)
</script>

<template>
  <div class="sm" :class="{ compact }">
    <div class="sm-bar">
      <template v-if="searchOpen && searchable">
        <div class="sm-search">
          <Icon name="search" :size="13" class="mu" />
          <input ref="searchInput" v-model="q" placeholder="Search series…" @keydown.esc="closeSearch" />
          <button class="sx" title="Close search" @click="closeSearch"><Icon name="x" :size="13" /></button>
        </div>
      </template>
      <template v-else>
        <button v-if="searchable" class="si" title="Search series" @click="openSearch"><Icon name="search" :size="14" /></button>
        <button class="sh" :class="{ on: sortKey === 'name' }" @click="sortBy('name')">
          Series <Icon v-if="sortKey === 'name'" :name="sortDir === 'asc' ? 'sort-asc' : 'sort-desc'" :size="11" />
        </button>
        <button class="sh num" :class="{ on: sortKey === 'value' }" @click="sortBy('value')">
          Value <Icon v-if="sortKey === 'value'" :name="sortDir === 'asc' ? 'sort-asc' : 'sort-desc'" :size="11" />
        </button>
      </template>
    </div>

    <div class="sm-list">
      <div
        v-for="e in rows" :key="e.key" class="sm-row"
        :class="{ off: hidden.has(e.key) }"
        :title="hidden.has(e.key) ? `Show ${e.name} on the chart` : `Hide ${e.name} from the chart`"
        @click="emit('toggle', e.key)"
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

/* one row: either the sort header (with a search icon) or the expanded search box */
.sm-bar { display: flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 2px 2px; border-bottom: 1px solid var(--border); flex: none; }
.si { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; padding: 3px; border-radius: 5px; flex: none; }
.si:hover { background: var(--surface-2); color: var(--primary-700); }

.sm-search { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; padding: 0 8px; height: 28px; background: var(--surface-2); border-radius: var(--r-sm); }
.sm-search input { flex: 1; min-width: 0; border: none; background: transparent; outline: none; font: inherit; color: var(--ink); }
.mu { color: var(--muted); flex: none; }
.sx { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; padding: 0; flex: none; }
.sx:hover { color: var(--ink); }

.sh { flex: 1; text-align: left; border: none; background: transparent; color: var(--muted); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; padding: 4px 0; display: inline-flex; align-items: center; gap: 3px; }
.sh.num { flex: none; }
.sh.on { color: var(--primary); }

/* virtualisation would go here for 1000+ series; 63 scrolls fine */
.sm-list { flex: 1; overflow: auto; min-height: 0; }
.sm-row { display: flex; align-items: center; gap: 7px; padding: 4px; border-radius: 5px; cursor: pointer; user-select: none; }
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

/* The panel exists to show series, so the list takes whatever height is left —
 * it must stay free to *shrink*. A min-height here would push the rows straight
 * out through the bottom of the popover instead of scrolling them. */
.compact .sm-list { max-height: 340px; }
</style>
