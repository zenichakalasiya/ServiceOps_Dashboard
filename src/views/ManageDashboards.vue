<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/ui/Icon.vue'
import ScheduleDialog from '../components/dashboard/ScheduleDialog.vue'
import HistoryDialog from '../components/dashboard/HistoryDialog.vue'
import { store, live, archiveDashboard, recordView, toast } from '../store/index.js'
const route = useRoute()
const router = useRouter()

const tab = ref('all')
const q = ref('')
const rows = computed(() => {
  let arr = live.value
  if (tab.value === 'mine') arr = arr.filter((d) => d.mine)
  if (tab.value === 'shared') arr = arr.filter((d) => d.sharedWithMe)
  if (route.query.category) arr = arr.filter((d) => (d.category || 'Other') === route.query.category)
  const s = q.value.trim().toLowerCase()
  if (s) arr = arr.filter((d) => d.name.toLowerCase().includes(s) || (d.owner || '').toLowerCase().includes(s))
  return arr
})

function open(d) { recordView(d); router.push(`/dashboard/${d.id}`) }
function edit(d) { store.ui.cloneTarget = null; store.ui.editTarget = d; store.ui.createOpen = true }
function toggleEnabled(d) { d.enabled = !d.enabled; toast(`${d.name} ${d.enabled ? 'enabled' : 'disabled'}`) }
const scheduleTarget = ref(null)
const historyTarget = ref(null)

// drag-to-reorder rows (reorders the underlying store list)
const dragId = ref(null)
function onDragStart(d) { dragId.value = d.id }
function onDrop(target) {
  const arr = store.dashboards
  const from = arr.findIndex((x) => x.id === dragId.value)
  const to = arr.findIndex((x) => x.id === target.id)
  if (from < 0 || to < 0 || from === to) return
  const [m] = arr.splice(from, 1)
  arr.splice(to, 0, m)
  dragId.value = null
}
function chips(list, max = 2) {
  const a = list || []
  return { shown: a.slice(0, max), extra: Math.max(0, a.length - max) }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>All Dashboards</h1>
        <p class="muted">Manage every dashboard — access, status, schedules, history and order.</p>
      </div>
      <button class="btn btn-primary" @click="store.ui.cloneTarget = null; store.ui.editTarget = null; store.ui.createOpen = true"><Icon name="plus" :size="16" /> New dashboard</button>
    </div>

    <div class="toolbar">
      <div class="tabs">
        <button class="t" :class="{ on: tab === 'all' }" @click="tab = 'all'">All <span class="c">{{ live.length }}</span></button>
        <button class="t" :class="{ on: tab === 'mine' }" @click="tab = 'mine'">Created by me</button>
        <button class="t" :class="{ on: tab === 'shared' }" @click="tab = 'shared'">Shared with me</button>
      </div>
      <div class="srch"><Icon name="search" :size="15" class="muted" /><input v-model="q" placeholder="Search dashboards or owners…" /></div>
    </div>

    <div v-if="route.query.category" class="filter-note">
      Filtered to <b>{{ route.query.category }}</b>
      <button class="clear" @click="router.replace({ path: '/dashboards' })"><Icon name="x" :size="13" /> Clear</button>
    </div>

    <div class="tbl-wrap">
      <div class="tbl">
        <div class="row-h">
          <span></span><span>Dashboard</span><span>Technician access</span><span>Group access</span><span>Description</span><span>Status</span><span>Actions</span>
        </div>
        <div v-for="d in rows" :key="d.id" class="row" :class="{ dim: !d.enabled, dragging: dragId === d.id }"
          draggable="true" @dragstart="onDragStart(d)" @dragover.prevent @drop="onDrop(d)">
          <span class="drag" title="Drag to reorder"><Icon name="drag" :size="16" /></span>
          <div class="nm">
            <b class="nm-t ellip" @click="open(d)">{{ d.name }}</b>
            <Icon v-if="d.default" name="default-home" :size="14" class="def" title="Default landing" />
          </div>
          <div class="chips">
            <span v-for="c in chips(d.techAccess).shown" :key="c" class="chip sm"><Icon name="user" :size="11" /> {{ c }}</span>
            <span v-if="chips(d.techAccess).extra" class="chip sm more">+{{ chips(d.techAccess).extra }}</span>
            <span v-if="!(d.techAccess || []).length" class="muted small">—</span>
          </div>
          <div class="chips">
            <span v-for="c in chips(d.groupAccess).shown" :key="c" class="chip sm"><Icon name="users" :size="11" /> {{ c }}</span>
            <span v-if="chips(d.groupAccess).extra" class="chip sm more">+{{ chips(d.groupAccess).extra }}</span>
            <span v-if="!(d.groupAccess || []).length" class="muted small">—</span>
          </div>
          <span class="desc ellip" :title="d.description">{{ d.description || '—' }}</span>
          <button class="sw" :class="{ on: d.enabled }" :title="d.enabled ? 'Enabled' : 'Disabled'" @click="toggleEnabled(d)"><i /></button>
          <div class="acts">
            <button class="ia" title="Edit" @click="edit(d)"><Icon name="edit" :size="15" /></button>
            <button class="ia" title="Schedule" @click="scheduleTarget = d"><Icon name="calendar2" :size="15" /></button>
            <button class="ia" title="Version history" @click="historyTarget = d"><Icon name="history" :size="15" /></button>
            <button class="ia del" title="Delete" @click="archiveDashboard(d)"><Icon name="trash" :size="15" /></button>
          </div>
        </div>
        <div v-if="!rows.length" class="empty"><Icon name="layout" :size="26" class="muted" /><p>No dashboards match.</p></div>
      </div>
    </div>

    <button class="archive-link" @click="router.push('/archive')"><Icon name="archive" :size="15" /> View archived dashboards</button>

    <ScheduleDialog v-if="scheduleTarget" :d="scheduleTarget" @close="scheduleTarget = null" />
    <HistoryDialog v-if="historyTarget" :d="historyTarget" @close="historyTarget = null" />
  </div>
</template>

<style scoped>
.page { padding: 22px 26px 60px; max-width: 1320px; margin: 0 auto; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h1 { margin: 0; font-size: 22px; } .page-head p { margin: 4px 0 14px; font-size: 13px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.tabs { display: flex; gap: 2px; }
.t { border: none; background: transparent; padding: 8px 12px; border-radius: 8px; font-weight: 500; font-size: 13px; color: var(--muted); }
.t:hover { background: var(--surface-2); color: var(--ink); }
.t.on { background: var(--primary-softer); color: var(--primary-700); }
.t .c { font-size: 11px; background: var(--surface-2); border-radius: 999px; padding: 0 6px; margin-left: 4px; }
.t.on .c { background: #fff; }
.srch { display: flex; align-items: center; gap: 8px; background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 9px; padding: 0 11px; height: 36px; width: 300px; max-width: 100%; }
.srch input { border: none; outline: none; background: transparent; width: 100%; font-size: 13.5px; }
.filter-note { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); margin-bottom: 10px; }
.clear { display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--border); background: transparent; border-radius: 999px; padding: 2px 9px; font-size: 12px; color: var(--ink-2); }
.tbl-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.tbl { min-width: 1080px; }
.row-h, .row { display: grid; grid-template-columns: 30px 1.6fr 1.5fr 1.4fr 1.8fr 64px 150px; align-items: center; gap: 12px; padding: 11px 16px; }
.row-h { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted-2); font-weight: 600; border-bottom: 1px solid var(--border); }
.row { border-top: 1px solid var(--border); font-size: 13px; }
.row:first-of-type { border-top: none; }
.row:hover { background: var(--surface-2); }
.row.dim { opacity: .55; }
.row.dragging { opacity: .4; }
.drag { color: var(--muted-2); cursor: grab; display: inline-grid; place-items: center; }
.nm { display: flex; align-items: center; gap: 8px; min-width: 0; }
.nm-t { min-width: 0; cursor: pointer; }
.nm-t:hover { color: var(--primary-700); }
.def { color: var(--primary); flex: none; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip.sm { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 1px 8px; color: var(--ink-2); white-space: nowrap; }
.chip.sm.more { color: var(--muted); }
.small { font-size: 12px; }
.desc { color: var(--muted); }
.sw { width: 38px; height: 22px; border-radius: 999px; border: none; background: var(--border-strong); position: relative; transition: background .15s; flex: none; }
.sw i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: var(--sh-sm); }
.sw.on { background: var(--green); } .sw.on i { left: 18px; }
.acts { display: flex; gap: 3px; }
.ia { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.ia:hover { background: var(--surface); color: var(--ink); }
.ia.del:hover { color: var(--red); background: var(--red-soft); }
.empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 46px; color: var(--muted); }
.archive-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; padding: 9px 14px; border: 1px solid var(--border); background: transparent; color: var(--muted); font-weight: 500; font-size: 13px; border-radius: 9px; }
.archive-link:hover { background: var(--surface-2); color: var(--ink); }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
