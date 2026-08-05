<script setup>
/**
 * DataTable — TanStack Table (headless, MIT) for Shortcut tiles.
 * Headless on purpose: it owns sorting/filtering/row-model logic and leaves the
 * markup to us, so tokens.css keeps styling the table instead of fighting a
 * vendor theme (the reason we did not take AG Grid Community here).
 *
 * Rows stay the mock shape: columns = string[], rows = cell[][].
 * Cell rendering is delegated to the parent via the #cell slot.
 */
import { computed, ref } from 'vue'
import {
  useVueTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
} from '@tanstack/vue-table'
import Icon from '../ui/Icon.vue'

const props = defineProps({
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  search: { type: String, default: '' },
  sortable: { type: Boolean, default: true },
  /* Row filtering now happens in the PARENT (TableFilterBar owns typed conditions,
   * and one matcher serves both the tile and the full-screen view). This flag only
   * tells the empty state WHY the table is empty — "no match" vs "no records". */
  filtered: { type: Boolean, default: false },
  emptyText: { type: String, default: 'No records in this range' },
})
const emit = defineEmits(['clear-filters'])

const sorting = ref([])

const cols = computed(() =>
  props.columns.map((c, i) => ({
    id: String(i),
    header: c,
    accessorFn: (row) => row[i],
    enableSorting: props.sortable,
  })))


const table = useVueTable({
  get data() { return props.rows },
  get columns() { return cols.value },
  state: {
    get sorting() { return sorting.value },
    get globalFilter() { return props.search },
  },
  onSortingChange: (u) => { sorting.value = typeof u === 'function' ? u(sorting.value) : u },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  globalFilterFn: 'includesString',
  enableSortingRemoval: true, // asc → desc → unsorted, so the user can get back
})

const rowModel = computed(() => table.getRowModel().rows)
const isEmpty = computed(() => rowModel.value.length === 0)
const filtered = computed(() => props.filtered)
</script>

<template>
  <table>
    <thead>
      <tr>
        <th
          v-for="header in table.getHeaderGroups()[0].headers" :key="header.id"
          :class="{ srt: sortable, on: !!header.column.getIsSorted() }"
          :aria-sort="header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none'"
          @click="sortable && header.column.toggleSorting()"
        >
          <span class="th-in">
            <!-- the label needs its own box to truncate inside: the th's ellipsis can't
                 reach into an inline-flex child, and the sort caret must stay visible -->
            <span class="th-lbl">{{ header.column.columnDef.header }}</span>
            <Icon
              v-if="sortable"
              class="sc"
              :class="{ vis: !!header.column.getIsSorted() }"
              :name="header.column.getIsSorted() === 'desc' ? 'sort-desc' : 'sort-asc'"
              :size="13"
            />
          </span>
        </th>
      </tr>

    </thead>
    <tbody>
      <tr v-for="row in rowModel" :key="row.id">
        <td v-for="cell in row.getVisibleCells()" :key="cell.id">
          <slot name="cell" :value="cell.getValue()">{{ cell.getValue() }}</slot>
        </td>
      </tr>
      <tr v-if="isEmpty">
        <td :colspan="columns.length" class="nodata">
          <template v-if="filtered">
            No records match these filters
            <button class="clr" @click="emit('clear-filters')">Clear filters</button>
          </template>
          <template v-else>{{ search ? 'No records match your search' : emptyText }}</template>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
/* Table chrome lives here, not in the parent: scoped CSS in WidgetCard can
   reach this component's root <table> but not the th/td inside it. */
/* `table-layout: fixed` is what makes truncation possible at all: with the default auto
   layout the browser widens a column to fit its longest cell, so `text-overflow` never
   has anything to overflow and every long value wraps to two or three lines instead.
   Fixed shares the width evenly, then each cell truncates on its own. */
table { width: 100%; border-collapse: collapse; font-size: inherit; table-layout: fixed; }
/* one line everywhere — headers and values alike. A wrapped cell changes its row's height
   and knocks the row rule out of line with its neighbours. */
th, td { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
th { text-align: left; color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; padding: 4px 8px; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; z-index: 1; }
td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
/* the sort header is an inline-flex row, so it needs its own clamp — the th's ellipsis
   cannot reach inside it */
.th-lbl { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nodata { text-align: center; color: var(--muted-2); padding: 18px; }

/* Header doubles as a sort control. The caret stays invisible until hover or
   active sort, so an unsorted table looks exactly like the old static one. */
th.srt { cursor: pointer; user-select: none; }
.th-in { display: flex; align-items: center; gap: 3px; max-width: 100%; }
.sc { opacity: 0; color: var(--muted-2); transition: opacity .12s; flex: none; }
th.srt:hover .sc { opacity: .6; }
.sc.vis { opacity: 1; color: var(--primary); }
th.on { color: var(--ink); }

.clr { display: block; margin: 8px auto 0; border: 1px solid var(--border); background: var(--surface); color: var(--primary-700); border-radius: 6px; padding: 4px 10px; font-size: 11.5px; font-weight: 600; }
.clr:hover { background: var(--primary-soft); border-color: var(--primary); }
</style>
