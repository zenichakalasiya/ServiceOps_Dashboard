<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/ui/Icon.vue'
import ScheduleDialog from '../components/dashboard/ScheduleDialog.vue'
import HistoryDialog from '../components/dashboard/HistoryDialog.vue'
import TableFilterBar from '../components/dashboard/TableFilterBar.vue'
import { matchesConds } from '../data/filters.js'
import { store, manageable, archived, archiveDashboard, restoreDashboard, deleteForever, recordView,
  togglePublished, setPublished, moveDashboardsToCategory, archiveMany, markDefault, toggleFavorite } from '../store/index.js'
import { ACCESS } from '../data/mock.js'
const route = useRoute()
const router = useRouter()

const tab = ref('all')                 // all | mine | shared | archive
const q = ref('')
const isArchive = computed(() => tab.value === 'archive')

/* The same bar the Shortcut tables use — literally the same component now, not a lookalike.
 * One field does two jobs: type to search, or click to pick a field and build a
 * `Field Operator Value` condition. The separate filter icon is gone; it was a second way
 * in to the thing the field itself already offers. Conditions are ANDed. */
const conds = ref([])
const CAT = (d) => d.category || 'Uncategorized'
const FIELD_OF = {
  category: CAT,
  access: (d) => ACCESS[d.access]?.label || d.access,
  status: (d) => (d.enabled === false ? 'Unpublished' : 'Published'),
  owner: (d) => d.owner,
}
const base = computed(() => {
  let arr = isArchive.value ? archived.value : manageable.value
  if (tab.value === 'mine') arr = arr.filter((d) => d.mine)
  if (tab.value === 'shared') arr = arr.filter((d) => d.sharedWithMe)
  return arr
})
// options come from what's actually in the tab — never offer a filter that matches nothing
const opts = (fn) => [...new Set(base.value.map(fn))].filter(Boolean).sort()
/* `type: 'enum'` gives each field a checkbox list of the values actually present in the
 * current tab — never offer a filter that matches nothing. */
const filterFields = computed(() => [
  { key: 'category', label: 'Category', type: 'enum', options: opts(CAT) },
  { key: 'access', label: 'Visibility', type: 'enum', options: opts(FIELD_OF.access) },
  { key: 'status', label: 'Status', type: 'enum', options: opts(FIELD_OF.status) },
  { key: 'owner', label: 'Owner', type: 'enum', options: opts(FIELD_OF.owner) },
])

// ---- column sorting ----
const sortKey = ref('')          // '' = the store's own order (drag-to-reorder wins)
const sortDir = ref('asc')
const SORT_OF = {
  name: (d) => d.name.toLowerCase(),
  category: CAT,
  tech: (d) => (d.techAccess || []).length,
  group: (d) => (d.groupAccess || []).length,
  description: (d) => (d.description || '').toLowerCase(),
  owner: (d) => (d.owner || '').toLowerCase(),
  status: (d) => (d.enabled === false ? 0 : 1),
  updated: (d) => new Date(d.updated).getTime(),
}
function sortBy(k) {
  if (!SORT_OF[k]) return
  if (sortKey.value === k) {
    // asc → desc → off, so the user can always get back to the manual order
    if (sortDir.value === 'asc') sortDir.value = 'desc'
    else { sortKey.value = ''; sortDir.value = 'asc' }
  } else { sortKey.value = k; sortDir.value = 'asc' }
}
const sortIcon = (k) => (sortKey.value !== k ? 'sort-asc' : sortDir.value === 'asc' ? 'sort-asc' : 'sort-desc')

const rows = computed(() => {
  // one matcher, shared with the Shortcut tables — FIELD_OF resolves a condition's key to
  // the derived value for that dashboard (Visibility is ACCESS[access].label, not `access`)
  let arr = base.value.filter((d) => matchesConds((key) => FIELD_OF[key]?.(d), conds.value, filterFields.value))
  const s = q.value.trim().toLowerCase()
  if (s) arr = arr.filter((d) => d.name.toLowerCase().includes(s) || (d.owner || '').toLowerCase().includes(s))
  if (sortKey.value) {
    const fn = SORT_OF[sortKey.value], dir = sortDir.value === 'asc' ? 1 : -1
    arr = [...arr].sort((a, b) => { const x = fn(a), y = fn(b); return (x < y ? -1 : x > y ? 1 : 0) * dir })
  }
  return arr
})

// ---- column selection (task 8) ----
const COLUMNS = [
  { key: 'category', label: 'Category' },
  { key: 'tech', label: 'Technician access' },
  { key: 'group', label: 'Group access' },
  { key: 'description', label: 'Description' },
  { key: 'owner', label: 'Owner' },
  { key: 'status', label: 'Status' },
  { key: 'updated', label: 'Updated' },
]
const visibleCols = ref(new Set(['category', 'tech', 'status', 'updated']))
const draftCols = ref(null)
const colsOpen = ref(false)
function openCols() { draftCols.value = new Set(visibleCols.value); colsOpen.value = true }
function toggleDraft(k) { const s = draftCols.value; s.has(k) ? s.delete(k) : s.add(k); draftCols.value = new Set(s) }
function applyCols() { visibleCols.value = new Set(draftCols.value); colsOpen.value = false }
const col = (k) => visibleCols.value.has(k)

// ---- bulk selection (task 9) ----
const sel = ref(new Set())
function toggleSel(d) { const s = sel.value; s.has(d.id) ? s.delete(d.id) : s.add(d.id); sel.value = new Set(s) }
function toggleAll(e) { sel.value = e.target.checked ? new Set(rows.value.map((d) => d.id)) : new Set() }
const allChecked = computed(() => rows.value.length && rows.value.every((d) => sel.value.has(d.id)))
const selDashboards = () => rows.value.filter((d) => sel.value.has(d.id))
const bulkCatOpen = ref(false)
function bulkArchive() { archiveMany(selDashboards()); sel.value = new Set() }
function bulkMove(cat) { moveDashboardsToCategory(selDashboards(), cat); bulkCatOpen.value = false; sel.value = new Set() }
/* One button, not two. It offers the action that applies to what's selected: while
 * anything selected is still enabled it reads "Disable all"; once they're all off it
 * flips to "Enable all". The selection is deliberately KEPT — clearing it would take
 * the bar away and the user would never see the label flip, which is the whole point. */
const allSelDisabled = computed(() => {
  const s = selDashboards()
  return s.length > 0 && s.every((d) => d.enabled === false)
})
function bulkTogglePublished() { setPublished(selDashboards(), allSelDisabled.value) }

// ---- tech-access pills expand (task 7) ----
const openTech = ref(null)
function chips(list) { const a = list || []; return { first: a[0], rest: a.slice(1) } }

// ---- delete confirm (task 10) ----
const confirmId = ref(null)
function doDelete(d) { (isArchive.value ? deleteForever : archiveDashboard)(d); confirmId.value = null }

function rel(iso) { const dd = Math.round((Date.now() - new Date(iso)) / 864e5); return dd < 1 ? 'today' : dd < 30 ? `${dd}d ago` : dd < 365 ? `${Math.round(dd / 30)}mo ago` : `${Math.round(dd / 365)}y ago` }
function open(d) { recordView(d); router.push(`/dashboard/${d.id}`) }
function edit(d) { store.ui.cloneTarget = null; store.ui.editTarget = d; store.ui.createOpen = true }
const scheduleTarget = ref(null)
const historyTarget = ref(null)

// drag-to-reorder
const dragId = ref(null)
function onDragStart(d) { dragId.value = d.id }
function onDrop(target) {
  const arr = store.dashboards, from = arr.findIndex((x) => x.id === dragId.value), to = arr.findIndex((x) => x.id === target.id)
  if (from < 0 || to < 0 || from === to) return
  const [m] = arr.splice(from, 1); arr.splice(to, 0, m); dragId.value = null
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div><h1>Manage dashboards</h1></div>
      <button class="btn btn-primary" @click="store.ui.cloneTarget = null; store.ui.editTarget = null; store.ui.createOpen = true"><Icon name="plus" :size="16" /> New dashboard</button>
    </div>

    <!-- Search + filter sits ABOVE the tabs, full width, exactly as the Shortcut tables
         have it: it searches across every tab, so putting it beside them read as
         "search within this tab". The Columns picker is gone — the default set is the
         one the reference ships, and a per-user column choice on a shared listing was a
         preference with nowhere to live. -->
    <div class="searchbar">
      <TableFilterBar v-model="conds" v-model:search="q" :fields="filterFields" :closable="false" />
    </div>

    <div class="toolbar">
      <div class="tabs">
        <button class="t" :class="{ on: tab === 'all' }" @click="tab = 'all'; sel = new Set()">All <span class="c">{{ manageable.length }}</span></button>
        <button class="t" :class="{ on: tab === 'mine' }" @click="tab = 'mine'; sel = new Set()">Created by me</button>
        <button class="t" :class="{ on: tab === 'shared' }" @click="tab = 'shared'; sel = new Set()">Shared with me</button>
        <button class="t" :class="{ on: tab === 'archive' }" @click="tab = 'archive'; sel = new Set()">Archive <span class="c">{{ archived.length }}</span></button>
      </div>
    </div>

    <!-- bulk action bar -->
    <transition name="fade">
      <div v-if="sel.size" class="bulkbar">
        <span class="bb-n">{{ sel.size }} selected</span>
        <div class="grow" />
        <div class="cols-wrap">
          <button class="btn btn-sm" @click="bulkCatOpen = !bulkCatOpen"><Icon name="folder" :size="14" /> Move to category</button>
          <div v-if="bulkCatOpen" class="cols-back" @click="bulkCatOpen = false" />
          <div v-if="bulkCatOpen" class="cols-pop right">
            <button v-for="c in store.categories" :key="c" class="col-opt btn-like" @click="bulkMove(c)">{{ c }}</button>
            <button class="col-opt btn-like" @click="bulkMove('')">Uncategorized</button>
          </div>
        </div>
        <!-- one toggle: it names the action that applies, and flips once it's done -->
        <button
          v-if="!isArchive" class="btn btn-sm"
          :title="allSelDisabled ? 'Make these visible in listings again' : 'Hide these from listings'"
          @click="bulkTogglePublished"
        >
          <Icon :name="allSelDisabled ? 'eye' : 'lock'" :size="14" />
          {{ allSelDisabled ? 'Enable all' : 'Disable all' }}
        </button>
        <button class="btn btn-sm danger" @click="bulkArchive"><Icon name="archive" :size="14" /> Archive</button>
        <button class="btn btn-sm" @click="sel = new Set()">Clear</button>
      </div>
    </transition>

    <div class="tbl-wrap">
      <table class="mtbl">
        <thead>
          <tr>
            <th class="c-chk"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
            <!-- click a header to sort: asc → desc → off, so the manual drag order is
                 always reachable again. The caret only shows on hover or when active. -->
            <th class="c-nm srt" :class="{ on: sortKey === 'name' }" @click="sortBy('name')">
              <span class="th-in">Dashboard <Icon class="sc" :class="{ vis: sortKey === 'name' }" :name="sortIcon('name')" :size="13" /></span>
            </th>
            <th v-for="c in COLUMNS.filter((x) => col(x.key))" :key="c.key" class="srt" :class="{ on: sortKey === c.key }" @click="sortBy(c.key)">
              <span class="th-in">{{ c.label }} <Icon class="sc" :class="{ vis: sortKey === c.key }" :name="sortIcon(c.key)" :size="13" /></span>
            </th>
            <th class="c-act">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in rows" :key="d.id" :class="{ dim: d.enabled === false, sel: sel.has(d.id) }"
            :draggable="!isArchive" @dragstart="onDragStart(d)" @dragover.prevent @drop="onDrop(d)">
            <td class="c-chk"><input type="checkbox" :checked="sel.has(d.id)" @change="toggleSel(d)" /></td>
            <td class="nm">
              <!-- inner wrapper carries the flex; a <td> set to display:flex stops
                   being a table-cell, so its border-bottom no longer lines up with
                   the neighbouring cells and the row rule visibly breaks -->
              <div class="nm-in">
                <Icon v-if="!isArchive" name="drag" :size="15" class="drag" />
                <b class="nm-t ellip" @click="open(d)">{{ d.name }}</b>
                <!-- favourite + default are independent → shown together when both apply -->
                <button v-if="!isArchive" class="nm-ic fav" :class="{ on: d.favorite }" :title="d.favorite ? 'Favourite' : 'Add to favourites'" @click.stop="toggleFavorite(d)"><Icon :name="d.favorite ? 'star-fill' : 'star'" :size="14" /></button>
                <Icon v-if="d.default" name="default-home" :size="15" class="nm-ic def" title="Default dashboard" />
              </div>
            </td>
            <td v-if="col('category')"><span v-if="d.category" class="cat-pill">{{ d.category }}</span><span v-else class="muted">—</span></td>
            <td v-if="col('tech')" class="techcell">
              <template v-if="chips(d.techAccess).first">
                <span class="tp">{{ chips(d.techAccess).first }}</span>
                <span v-if="chips(d.techAccess).rest.length" class="tp more" @click.stop="openTech = openTech === d.id ? null : d.id">+{{ chips(d.techAccess).rest.length }}</span>
                <div v-if="openTech === d.id" class="tp-back" @click="openTech = null" />
                <div v-if="openTech === d.id" class="tp-pop"><span v-for="t in chips(d.techAccess).rest" :key="t" class="tp">{{ t }}</span></div>
              </template>
              <span v-else class="muted">—</span>
            </td>
            <td v-if="col('group')"><span v-if="(d.groupAccess||[]).length" class="tp">{{ d.groupAccess[0] }}</span><span v-else class="muted">—</span></td>
            <td v-if="col('description')" class="desc ellip" :title="d.description">{{ d.description || '—' }}</td>
            <td v-if="col('owner')" class="muted">{{ d.owner }}</td>
            <td v-if="col('status')">
              <button class="sw" :class="{ on: d.enabled !== false }" :title="d.enabled !== false ? 'Published' : 'Unpublished'" @click="togglePublished(d)"><i /></button>
            </td>
            <td v-if="col('updated')" class="muted">{{ rel(d.updated) }}</td>
            <td class="acts">
              <div class="acts-in">
                <button v-if="isArchive" class="ia" title="Restore" @click="restoreDashboard(d)"><Icon name="restore" :size="15" /></button>
                <template v-else>
                  <button class="ia" title="Open" @click="open(d)"><Icon name="layout" :size="15" /></button>
                  <button class="ia" title="Edit" @click="edit(d)"><Icon name="edit" :size="15" /></button>
                  <button class="ia" title="Schedule" @click="scheduleTarget = d"><Icon name="calendar2" :size="15" /></button>
                  <button class="ia" title="History" @click="historyTarget = d"><Icon name="history" :size="15" /></button>
                </template>
                <div class="del-wrap">
                  <!-- A predefined board can't be deleted. The slot used to hold a disabled
                       padlock so the column wouldn't reflow; it read as a fifth action and
                       invited a click that does nothing. An empty slot of the same width
                       keeps the column aligned and says nothing at all. -->
                  <span v-if="d.predefined && !isArchive" class="ia-blank" title="Predefined dashboard — can’t be deleted" />
                  <button v-else class="ia del" :title="isArchive ? 'Delete forever' : 'Archive'" @click.stop="confirmId = confirmId === d.id ? null : d.id"><Icon name="trash" :size="15" /></button>
                  <div v-if="confirmId === d.id" class="cfm-back" @click="confirmId = null" />
                  <div v-if="confirmId === d.id" class="cfm">
                    <span>{{ isArchive ? 'Delete forever?' : 'Archive this dashboard?' }}</span>
                    <button class="btn btn-sm danger" @click="doDelete(d)">Yes</button>
                    <button class="btn btn-sm" @click="confirmId = null">No</button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="empty"><Icon name="layout" :size="24" class="muted" /><p>{{ isArchive ? 'Nothing archived.' : 'No dashboards match.' }}</p></div>
    </div>

    <ScheduleDialog v-if="scheduleTarget" :d="scheduleTarget" @close="scheduleTarget = null" />
    <HistoryDialog v-if="historyTarget" :d="historyTarget" @close="historyTarget = null" />
  </div>
</template>

<style scoped>
/* The listing is a PAGE, not a card on a page. It used to be a bordered, rounded panel
   floating on the tinted canvas — a container around content that already fills the
   screen adds a frame and takes width without earning either. White ground, rows ruled
   by hairlines, nothing boxed. */
.page { padding: 16px 20px 40px; height: 100%; display: flex; flex-direction: column; background: var(--surface); }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.page-head h1 { margin: 0; font-size: 20px; }
.searchbar { margin-bottom: 12px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
/* one segmented control, not four loose buttons: a soft track with the active segment
   filled solid, exactly as the reference has it */
.tabs { display: inline-flex; gap: 2px; padding: 4px; background: var(--surface-2); border-radius: 10px; }
.t { border: none; background: transparent; padding: 7px 14px; border-radius: 7px; font-weight: 500; font-size: 13px; color: var(--ink-2); }
.t:hover { background: color-mix(in srgb, var(--surface) 70%, transparent); color: var(--ink); }
.t.on { background: var(--ink); color: #fff; font-weight: 600; box-shadow: var(--sh-sm); }
.t .c { font-size: 11px; background: var(--surface); border-radius: 999px; padding: 0 6px; margin-left: 5px; color: var(--ink-2); }
.t.on .c { background: rgba(255,255,255,.22); color: #fff; }
.tr { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.srch { display: flex; align-items: center; gap: 7px; background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 8px; padding: 0 10px; height: 34px; width: 200px; }
.srch input { border: none; outline: none; background: transparent; width: 100%; font-size: 13px; }
/* the prototype gives this screen ONE wide field carrying the chips and the query,
   with the picker inside it — the same bar the Shortcut tables use */
.srch.wide { width: auto; flex: 1; min-width: 320px; background: var(--surface); padding: 0 4px 0 10px; }
.srch.wide:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.srch.wide input { min-width: 80px; }
.in-srch :deep(.fm-btn) { width: 26px; height: 26px; border: none; background: transparent; }
.in-srch :deep(.fm-btn:hover) { background: var(--surface-2); }
.mchip { display: inline-flex; align-items: center; gap: 4px; flex: none; max-width: 220px; height: 22px; padding: 0 4px 0 8px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); font-size: 11.5px; color: var(--ink-2); white-space: nowrap; }
.mchip b { font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
.mchip em { font-style: normal; color: var(--muted); }
.mchip button { flex: none; width: 15px; height: 15px; border: none; background: transparent; color: var(--muted); border-radius: 4px; display: grid; place-items: center; }
.mchip button:hover { background: var(--border); color: var(--ink); }
.fsel { height: 34px; border: 1px solid var(--border-strong); background: var(--surface); border-radius: 8px; padding: 0 10px; font-size: 12.5px; color: var(--ink-2); }
.colbtn { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; }
.cols-wrap { position: relative; }
.cols-back { position: fixed; inset: 0; z-index: 40; }
/* right-anchored so it never overflows past the viewport edge */
.cols-pop { position: absolute; top: calc(100% + 4px); right: 0; left: auto; z-index: 41; min-width: 210px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--sh-pop); padding: 6px; }
.col-opt { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 7px; font-size: 13px; color: var(--ink-2); cursor: pointer; width: 100%; border: none; background: transparent; text-align: left; white-space: nowrap; }
.col-opt:hover { background: var(--surface-2); }
.col-opt input { accent-color: var(--primary); }
.col-foot { display: flex; justify-content: flex-end; padding: 6px 4px 2px; border-top: 1px solid var(--border); margin-top: 4px; }
/* bulk bar */
.bulkbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: 10px; background: var(--primary-softer); border: 1px solid var(--primary-soft); border-radius: 10px; }
.bb-n { font-weight: 600; font-size: 13px; color: var(--primary-700); }
.btn.danger { color: var(--red); border-color: var(--red-soft); }
.btn.danger:hover { background: var(--red-soft); }
/* table */
.tbl-wrap { flex: 1; overflow: auto; border: 0; border-radius: 0; background: transparent; }
.mtbl { width: 100%; border-collapse: collapse; font-size: 13px; }
/* header row on the page's own white, in sentence case — the grey band was the only thing
   left implying a card once the container went */
.mtbl thead th { position: sticky; top: 0; z-index: 2; background: var(--surface); text-align: left; font-size: 12.5px; color: var(--ink); font-weight: 600; padding: 12px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.mtbl td { padding: 9px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
/* sortable headers */
.mtbl thead th.srt { cursor: pointer; user-select: none; }
.mtbl thead th.srt:hover { color: var(--ink-2); }
.mtbl thead th.on { color: var(--primary); }
.th-in { display: inline-flex; align-items: center; gap: 3px; }
.sc { opacity: 0; color: var(--muted-2); transition: opacity .12s; flex: none; }
.mtbl thead th.srt:hover .sc { opacity: .6; }
.sc.vis { opacity: 1; color: var(--primary); }

.mtbl tbody tr:hover { background: var(--surface-2); }
.mtbl tbody tr.sel { background: var(--primary-softer); }
.mtbl tbody tr.dim { opacity: .55; }
.c-chk { width: 34px; } .c-chk input { accent-color: var(--primary); }
/* Lay the cell out with an inner flex row, never on the <td> itself: a table-cell
   set to display:flex leaves the table layout, so it no longer stretches to the
   row height and its border-bottom draws above the neighbouring cells' — the row
   rule then visibly breaks at that cell's edges. Same for .acts below. */
.nm { min-width: 220px; }
.nm-in { display: flex; align-items: center; gap: 8px; min-width: 0; }
.drag { color: var(--muted-2); cursor: grab; flex: none; }
.nm-t { cursor: pointer; min-width: 0; } .nm-t:hover { color: var(--primary-700); }
/* favourite (star) + default (home) indicators, side by side */
.nm-ic { flex: none; display: inline-grid; place-items: center; }
.nm-ic.def { color: var(--primary); }
.nm-ic.fav { border: none; background: transparent; color: var(--muted-2); border-radius: 5px; opacity: 0; transition: opacity .12s; padding: 2px; }
.nm:hover .nm-ic.fav, .nm-ic.fav.on { opacity: 1; }
.nm-ic.fav.on { color: #f5a623; }
.nm-ic.fav:hover { background: var(--surface); }
.cat-pill { font-size: 12px; color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; padding: 2px 8px; }
/* minimal technician pills (task 7): 6px radius, subtle color, 1 + N */
.techcell { position: relative; white-space: nowrap; }
.tp { display: inline-flex; align-items: center; font-size: 12px; color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px; margin-right: 4px; }
.tp.more { cursor: pointer; color: var(--primary-700); background: var(--primary-softer); border-color: var(--primary-soft); font-weight: 600; }
.tp-back { position: fixed; inset: 0; z-index: 40; }
.tp-pop { position: absolute; top: calc(100% + 3px); left: 0; z-index: 41; display: flex; flex-wrap: wrap; gap: 4px; max-width: 240px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--sh-pop); padding: 8px; }
.desc { color: var(--muted); max-width: 260px; }
.sw { width: 38px; height: 22px; border-radius: 999px; border: none; background: var(--border-strong); position: relative; flex: none; }
.sw i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: var(--sh-sm); }
.sw.on { background: var(--green); } .sw.on i { left: 18px; }
.acts { white-space: nowrap; }
.acts-in { display: flex; gap: 2px; align-items: center; }
.ia { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.ia:disabled { color: var(--muted-2); cursor: not-allowed; }
.ia:disabled:hover { background: transparent; }
.ia:hover { background: var(--surface); color: var(--ink); }
.ia.del:hover { color: var(--red); background: var(--red-soft); }
/* holds the delete slot's width open on a row that has no delete action */
.ia-blank { display: block; width: 30px; height: 30px; }
.del-wrap { position: relative; }
.cfm-back { position: fixed; inset: 0; z-index: 45; }
.cfm { position: absolute; top: 50%; right: calc(100% + 6px); transform: translateY(-50%); z-index: 46; display: flex; align-items: center; gap: 6px; white-space: nowrap; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; box-shadow: var(--sh-pop); padding: 7px 10px; font-size: 12.5px; color: var(--ink-2); }
.empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 44px; color: var(--muted); }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
