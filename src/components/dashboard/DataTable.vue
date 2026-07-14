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
  /* { [columnIndex]: string[] } — driven by the shared FilterMenu in the tile
   * header. Replaces the old per-column input row: one icon, two levels, and the
   * same interaction as the Manage-all list. */
  filterModel: { type: Object, default: () => ({}) },
  emptyText: { type: String, default: 'No records in this range' },
})
const emit = defineEmits(['clear-filters'])

const sorting = ref([])

// values within a column are OR; columns are AND
const pickOne = (row, id, picked) =>
  !picked?.length || picked.includes(String(row.getValue(id) ?? '').trim())

const cols = computed(() =>
  props.columns.map((c, i) => ({
    id: String(i),
    header: c,
    accessorFn: (row) => row[i],
    enableSorting: props.sortable,
    filterFn: pickOne,
  })))

// FilterMenu speaks {key: values[]}; TanStack wants [{id, value}]
const columnFilters = computed(() =>
  Object.entries(props.filterModel)
    .filter(([, v]) => v?.length)
    .map(([id, value]) => ({ id, value })))

const table = useVueTable({
  get data() { return props.rows },
  get columns() { return cols.value },
  state: {
    get sorting() { return sorting.value },
    get globalFilter() { return props.search },
    get columnFilters() { return columnFilters.value },
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
const filtered = computed(() => columnFilters.value.length > 0)
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
            {{ header.column.columnDef.header }}
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
table { width: 100%; border-collapse: collapse; font-size: inherit; }
th { text-align: left; color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; padding: 4px 8px; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; z-index: 1; }
td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
.nodata { text-align: center; color: var(--muted-2); padding: 18px; }

/* Header doubles as a sort control. The caret stays invisible until hover or
   active sort, so an unsorted table looks exactly like the old static one. */
th.srt { cursor: pointer; user-select: none; }
.th-in { display: inline-flex; align-items: center; gap: 3px; }
.sc { opacity: 0; color: var(--muted-2); transition: opacity .12s; flex: none; }
th.srt:hover .sc { opacity: .6; }
.sc.vis { opacity: 1; color: var(--primary); }
th.on { color: var(--ink); }

.clr { display: block; margin: 8px auto 0; border: 1px solid var(--border); background: var(--surface); color: var(--primary-700); border-radius: 6px; padding: 4px 10px; font-size: 11.5px; font-weight: 600; }
.clr:hover { background: var(--primary-soft); border-color: var(--primary); }
</style>
