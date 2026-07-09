<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/ui/Icon.vue'
import ScheduleDialog from '../components/dashboard/ScheduleDialog.vue'
import HistoryDialog from '../components/dashboard/HistoryDialog.vue'
import { store, manageable, archived, archiveDashboard, restoreDashboard, deleteForever, recordView,
  togglePublished, moveDashboardsToCategory, archiveMany, markDefault, toggleFavorite } from '../store/index.js'
import { ACCESS } from '../data/mock.js'
const route = useRoute()
const router = useRouter()

const tab = ref('all')                 // all | mine | shared | archive
const q = ref('')
const fCategory = ref('')
const fAccess = ref('')
const fPublished = ref('')              // '' | pub | unpub
const isArchive = computed(() => tab.value === 'archive')

const rows = computed(() => {
  let arr = isArchive.value ? archived.value : manageable.value
  if (tab.value === 'mine') arr = arr.filter((d) => d.mine)
  if (tab.value === 'shared') arr = arr.filter((d) => d.sharedWithMe)
  if (fCategory.value) arr = arr.filter((d) => (d.category || 'Uncategorized') === fCategory.value)
  if (fAccess.value) arr = arr.filter((d) => d.access === fAccess.value)
  if (fPublished.value === 'pub') arr = arr.filter((d) => d.enabled !== false)
  if (fPublished.value === 'unpub') arr = arr.filter((d) => d.enabled === false)
  const s = q.value.trim().toLowerCase()
  if (s) arr = arr.filter((d) => d.name.toLowerCase().includes(s) || (d.owner || '').toLowerCase().includes(s))
  return arr
})
const catOpts = computed(() => ['', ...store.categories])

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
      <div><h1>All Dashboards</h1></div>
      <button class="btn btn-primary" @click="store.ui.cloneTarget = null; store.ui.editTarget = null; store.ui.createOpen = true"><Icon name="plus" :size="16" /> New dashboard</button>
    </div>

    <div class="toolbar">
      <div class="tabs">
        <button class="t" :class="{ on: tab === 'all' }" @click="tab = 'all'; sel = new Set()">All <span class="c">{{ manageable.length }}</span></button>
        <button class="t" :class="{ on: tab === 'mine' }" @click="tab = 'mine'; sel = new Set()">Created by me</button>
        <button class="t" :class="{ on: tab === 'shared' }" @click="tab = 'shared'; sel = new Set()">Shared with me</button>
        <button class="t" :class="{ on: tab === 'archive' }" @click="tab = 'archive'; sel = new Set()">Archive <span class="c">{{ archived.length }}</span></button>
      </div>
      <div class="tr">
        <div class="srch"><Icon name="search" :size="14" class="muted" /><input v-model="q" placeholder="Search…" /></div>
        <select v-if="!isArchive" v-model="fCategory" class="fsel"><option value="">All categories</option><option v-for="c in store.categories" :key="c" :value="c">{{ c }}</option></select>
        <select v-if="!isArchive" v-model="fAccess" class="fsel"><option value="">Any access</option><option value="public">Public</option><option value="private">Private</option><option value="restricted">Restricted</option></select>
        <select v-if="!isArchive" v-model="fPublished" class="fsel"><option value="">Any status</option><option value="pub">Published</option><option value="unpub">Unpublished</option></select>
        <div class="cols-wrap">
          <button class="fsel colbtn" @click="openCols"><Icon name="rows" :size="14" /> Columns</button>
          <div v-if="colsOpen" class="cols-back" @click="colsOpen = false" />
          <div v-if="colsOpen" class="cols-pop">
            <label v-for="c in COLUMNS" :key="c.key" class="col-opt"><input type="checkbox" :checked="draftCols.has(c.key)" @change="toggleDraft(c.key)" /> {{ c.label }}</label>
            <div class="col-foot"><button class="btn btn-sm btn-primary" @click="applyCols">Apply</button></div>
          </div>
        </div>
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
        <button class="btn btn-sm danger" @click="bulkArchive"><Icon name="archive" :size="14" /> Archive</button>
        <button class="btn btn-sm" @click="sel = new Set()">Clear</button>
      </div>
    </transition>

    <div class="tbl-wrap">
      <table class="mtbl">
        <thead>
          <tr>
            <th class="c-chk"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
            <th class="c-nm">Dashboard</th>
            <th v-if="col('category')">Category</th>
            <th v-if="col('tech')">Technician access</th>
            <th v-if="col('group')">Group access</th>
            <th v-if="col('description')">Description</th>
            <th v-if="col('owner')">Owner</th>
            <th v-if="col('status')">Status</th>
            <th v-if="col('updated')">Updated</th>
            <th class="c-act">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in rows" :key="d.id" :class="{ dim: d.enabled === false, sel: sel.has(d.id) }"
            :draggable="!isArchive" @dragstart="onDragStart(d)" @dragover.prevent @drop="onDrop(d)">
            <td class="c-chk"><input type="checkbox" :checked="sel.has(d.id)" @change="toggleSel(d)" /></td>
            <td class="nm">
              <Icon v-if="!isArchive" name="drag" :size="15" class="drag" />
              <b class="nm-t ellip" @click="open(d)">{{ d.name }}</b>
              <!-- favourite + default are independent → shown together when both apply -->
              <button v-if="!isArchive" class="nm-ic fav" :class="{ on: d.favorite }" :title="d.favorite ? 'Favourite' : 'Add to favourites'" @click.stop="toggleFavorite(d)"><Icon :name="d.favorite ? 'star-fill' : 'star'" :size="14" /></button>
              <Icon v-if="d.default" name="default-home" :size="15" class="nm-ic def" title="Default dashboard" />
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
              <button v-if="isArchive" class="ia" title="Restore" @click="restoreDashboard(d)"><Icon name="restore" :size="15" /></button>
              <template v-else>
                <button class="ia" title="Open" @click="open(d)"><Icon name="layout" :size="15" /></button>
                <button class="ia" title="Edit" @click="edit(d)"><Icon name="edit" :size="15" /></button>
                <button class="ia" title="Schedule" @click="scheduleTarget = d"><Icon name="calendar2" :size="15" /></button>
                <button class="ia" title="History" @click="historyTarget = d"><Icon name="history" :size="15" /></button>
              </template>
              <div class="del-wrap">
                <button class="ia del" :title="isArchive ? 'Delete forever' : 'Archive'" @click.stop="confirmId = confirmId === d.id ? null : d.id"><Icon name="trash" :size="15" /></button>
                <div v-if="confirmId === d.id" class="cfm-back" @click="confirmId = null" />
                <div v-if="confirmId === d.id" class="cfm">
                  <span>{{ isArchive ? 'Delete forever?' : 'Archive this dashboard?' }}</span>
                  <button class="btn btn-sm danger" @click="doDelete(d)">Yes</button>
                  <button class="btn btn-sm" @click="confirmId = null">No</button>
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
.page { padding: 16px 20px 40px; height: 100%; display: flex; flex-direction: column; }
.page-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.page-head h1 { margin: 0; font-size: 20px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.tabs { display: flex; gap: 2px; }
.t { border: none; background: transparent; padding: 7px 11px; border-radius: 8px; font-weight: 500; font-size: 13px; color: var(--muted); }
.t:hover { background: var(--surface-2); color: var(--ink); }
.t.on { background: var(--primary-softer); color: var(--primary-700); }
.t .c { font-size: 11px; background: var(--surface-2); border-radius: 999px; padding: 0 6px; margin-left: 4px; }
.t.on .c { background: #fff; }
.tr { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.srch { display: flex; align-items: center; gap: 7px; background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 8px; padding: 0 10px; height: 34px; width: 200px; }
.srch input { border: none; outline: none; background: transparent; width: 100%; font-size: 13px; }
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
.tbl-wrap { flex: 1; overflow: auto; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.mtbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.mtbl thead th { position: sticky; top: 0; z-index: 2; background: var(--surface-2); text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted-2); font-weight: 600; padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.mtbl td { padding: 9px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.mtbl tbody tr:hover { background: var(--surface-2); }
.mtbl tbody tr.sel { background: var(--primary-softer); }
.mtbl tbody tr.dim { opacity: .55; }
.c-chk { width: 34px; } .c-chk input { accent-color: var(--primary); }
.nm { display: flex; align-items: center; gap: 8px; min-width: 220px; }
.drag { color: var(--muted-2); cursor: grab; flex: none; }
.nm-t { cursor: pointer; } .nm-t:hover { color: var(--primary-700); }
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
.acts { display: flex; gap: 2px; align-items: center; }
.ia { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.ia:hover { background: var(--surface); color: var(--ink); }
.ia.del:hover { color: var(--red); background: var(--red-soft); }
.del-wrap { position: relative; }
.cfm-back { position: fixed; inset: 0; z-index: 45; }
.cfm { position: absolute; top: 50%; right: calc(100% + 6px); transform: translateY(-50%); z-index: 46; display: flex; align-items: center; gap: 6px; white-space: nowrap; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; box-shadow: var(--sh-pop); padding: 7px 10px; font-size: 12.5px; color: var(--ink-2); }
.empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 44px; color: var(--muted); }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
