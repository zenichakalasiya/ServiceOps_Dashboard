<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/ui/Icon.vue'
import ShareDialog from '../components/dashboard/ShareDialog.vue'
import { store, live, markDefault, archiveDashboard, toggleFavorite, folderName, recordView } from '../store/index.js'
import { ACCESS } from '../data/mock.js'
const router = useRouter()

const tab = ref('all')             // all | mine | shared
const q = ref('')
const rows = computed(() => {
  let arr = live.value
  if (tab.value === 'mine') arr = arr.filter((d) => d.mine)
  if (tab.value === 'shared') arr = arr.filter((d) => d.sharedWithMe)
  const s = q.value.trim().toLowerCase()
  if (s) arr = arr.filter((d) => d.name.toLowerCase().includes(s) || (d.owner || '').toLowerCase().includes(s))
  return arr.slice().sort((a, b) => (a.name > b.name ? 1 : -1))
})

// icon reflecting the dashboard's relationship to me (matches the left listing)
function dashKind(d) {
  if (d.mine && !d.predefined) return 'mine'
  if (d.sharedWithMe) return 'shared'
  if (d.predefined) return 'pre'
  return d.mine ? 'mine' : 'shared'
}
function dashIcon(d) { return ({ pre: 'predefined-monitor', shared: 'share', mine: 'user' })[dashKind(d)] }

function rel(iso) { const d = Math.round((Date.now() - new Date(iso)) / 864e5); return d < 1 ? 'today' : d < 30 ? `${d}d ago` : d < 365 ? `${Math.round(d / 30)}mo ago` : `${Math.round(d / 365)}y ago` }

function open(d) { recordView(d); router.push(`/dashboard/${d.id}`) }
function edit(d) { store.ui.cloneTarget = null; store.ui.editTarget = d; store.ui.createOpen = true }
function clone(d) { store.ui.editTarget = null; store.ui.cloneTarget = d; store.ui.createOpen = true }
const shareTarget = ref(null)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>All Dashboards</h1>
        <p class="muted">Manage every dashboard — open, edit, clone, set default, share or archive.</p>
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

    <div v-if="rows.length" class="card list">
      <div class="row-h"><span>Dashboard</span><span>Category</span><span>Access</span><span>Owner</span><span>Updated</span><span></span></div>
      <div v-for="d in rows" :key="d.id" class="row">
        <div class="nm">
          <Icon :name="dashIcon(d)" :size="15" class="lk" :class="'ic-' + dashKind(d)" />
          <b class="nm-t ellip">{{ d.name }}</b>
          <Icon v-if="d.default" name="default-home" :size="15" class="def" title="Default landing dashboard" />
          <button class="fav" :class="{ on: d.favorite }" title="Favourite" @click="toggleFavorite(d)"><Icon :name="d.favorite ? 'star-fill' : 'star'" :size="14" /></button>
        </div>
        <span class="muted">{{ d.category || folderName(d.folder) }}</span>
        <span class="chip" :class="ACCESS[d.access].chip"><Icon :name="ACCESS[d.access].icon" :size="12" /> {{ ACCESS[d.access].label }}</span>
        <span class="muted">{{ d.owner }}</span>
        <span class="muted">{{ rel(d.updated) }}</span>
        <div class="acts">
          <button class="btn btn-sm btn-primary" @click="open(d)"><Icon name="layout" :size="14" /> Open</button>
          <button class="ia" title="Edit" @click="edit(d)"><Icon name="edit" :size="15" /></button>
          <button class="ia" title="Clone" @click="clone(d)"><Icon name="copy" :size="15" /></button>
          <button v-if="!d.default" class="ia" title="Mark as default landing" @click="markDefault(d)"><Icon name="pin" :size="15" /></button>
          <button class="ia" title="Share" @click="shareTarget = d"><Icon name="share" :size="15" /></button>
          <button class="ia del" title="Archive" @click="archiveDashboard(d)"><Icon name="archive" :size="15" /></button>
        </div>
      </div>
    </div>
    <div v-else class="empty card">
      <Icon name="layout" :size="28" class="muted" />
      <p>No dashboards match. Try a different tab or search.</p>
    </div>

    <button class="archive-link" @click="router.push('/archive')"><Icon name="archive" :size="15" /> View archived dashboards</button>

    <ShareDialog v-if="shareTarget" :d="shareTarget" @close="shareTarget = null" />
  </div>
</template>

<style scoped>
.page { padding: 22px 26px 60px; max-width: 1180px; margin: 0 auto; }
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
.list { padding: 6px; }
.row-h, .row { display: grid; grid-template-columns: 2.4fr 1fr 1.1fr 1.2fr .8fr 2.4fr; align-items: center; gap: 10px; padding: 11px 14px; }
.row-h { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted-2); font-weight: 600; }
.row { border-top: 1px solid var(--border); font-size: 13px; }
.row:hover { background: var(--surface-2); }
.nm { display: flex; align-items: center; gap: 9px; min-width: 0; }
.nm-t { min-width: 0; }
.lk.ic-pre { color: var(--primary); } .lk.ic-shared { color: var(--blue); } .lk.ic-mine { color: var(--green); }
.def { color: var(--primary); flex: none; }
.fav { border: none; background: transparent; color: var(--muted-2); display: grid; place-items: center; padding: 2px; border-radius: 5px; flex: none; }
.fav:hover, .fav.on { color: #f5a623; }
.acts { display: flex; gap: 5px; justify-content: flex-end; align-items: center; }
.ia { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.ia:hover { background: var(--surface); color: var(--ink); }
.ia.del:hover { color: var(--red); background: var(--red-soft); }
.empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 50px; color: var(--muted); }
.archive-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; padding: 9px 14px; border: 1px solid var(--border); background: transparent; color: var(--muted); font-weight: 500; font-size: 13px; border-radius: 9px; }
.archive-link:hover { background: var(--surface-2); color: var(--ink); }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
