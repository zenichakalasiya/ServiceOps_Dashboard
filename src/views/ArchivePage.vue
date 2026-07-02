<script setup>
import Icon from '../components/ui/Icon.vue'
import { archived, restoreDashboard, deleteForever, folderName } from '../store/index.js'
import { ACCESS } from '../data/mock.js'
function rel(iso) { const d = Math.round((Date.now() - new Date(iso)) / 864e5); return d < 1 ? 'today' : d < 30 ? `${d}d ago` : d < 365 ? `${Math.round(d / 30)}mo ago` : `${Math.round(d / 365)}y ago` }
</script>
<template>
  <div class="page">
    <div class="page-head">
      <div><h1>Archive</h1><p class="muted">Soft-deleted dashboards — restore them, or remove permanently.</p></div>
    </div>
    <div v-if="archived.length" class="card list">
      <div class="row-h"><span>Dashboard</span><span>Folder</span><span>Access</span><span>Owner</span><span>Archived</span><span></span></div>
      <div v-for="d in archived" :key="d.id" class="row">
        <div class="nm"><Icon name="layout" :size="16" class="muted" /> <b>{{ d.name }}</b></div>
        <span class="muted">{{ folderName(d.folder) }}</span>
        <span class="chip" :class="ACCESS[d.access].chip"><Icon :name="ACCESS[d.access].icon" :size="12" /> {{ ACCESS[d.access].label }}</span>
        <span class="muted">{{ d.owner }}</span>
        <span class="muted">{{ rel(d.updated) }}</span>
        <div class="acts">
          <button class="btn btn-sm" @click="restoreDashboard(d)"><Icon name="restore" :size="14" /> Restore</button>
          <button class="btn btn-sm danger" @click="deleteForever(d)"><Icon name="trash" :size="14" /> Delete forever</button>
        </div>
      </div>
    </div>
    <div v-else class="empty card">
      <Icon name="archive" :size="28" class="muted" />
      <p>Nothing archived. Archived dashboards land here and can be restored anytime.</p>
    </div>
  </div>
</template>
<style scoped>
.page { padding: 22px 26px 60px; max-width: 1100px; margin: 0 auto; }
.page-head h1 { margin: 0; font-size: 22px; } .page-head p { margin: 4px 0 14px; font-size: 13px; }
.list { padding: 6px; }
.row-h, .row { display: grid; grid-template-columns: 2.2fr 1fr 1.1fr 1.2fr .9fr 1.8fr; align-items: center; gap: 10px; padding: 11px 14px; }
.row-h { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted-2); font-weight: 600; }
.row { border-top: 1px solid var(--border); font-size: 13px; }
.nm { display: flex; align-items: center; gap: 9px; }
.acts { display: flex; gap: 7px; justify-content: flex-end; }
.btn.danger { color: var(--red); border-color: var(--red-soft); }
.btn.danger:hover { background: var(--red-soft); }
.empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 50px; color: var(--muted); }
</style>
