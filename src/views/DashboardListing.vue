<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/ui/Icon.vue'
import DashboardCard from '../components/dashboard/DashboardCard.vue'
import DashboardTable from '../components/dashboard/DashboardTable.vue'
import ShareDialog from '../components/dashboard/ShareDialog.vue'
import { store, live, recents, folderName } from '../store/index.js'
import { CATEGORIES } from '../data/mock.js'
const route = useRoute()
const router = useRouter()

const tab = ref('all')
const q = ref(route.query.q || '')
const folder = ref(route.query.folder || '')
const category = ref('')
const sort = ref('recent')
const shareFor = ref(null)

watch(() => route.query.q, (v) => (q.value = v || ''))
watch(() => route.query.folder, (v) => (folder.value = v || ''))

const tabbed = computed(() => {
  let arr = live.value
  if (tab.value === 'mine') arr = arr.filter((d) => d.mine)
  if (tab.value === 'shared') arr = arr.filter((d) => d.sharedWithMe)
  if (tab.value === 'private') arr = arr.filter((d) => d.access === 'private')
  return arr
})
const filtered = computed(() => {
  let arr = tabbed.value
  if (folder.value) arr = arr.filter((d) => d.folder === folder.value)
  if (category.value) arr = arr.filter((d) => d.category === category.value)
  if (q.value.trim()) arr = arr.filter((d) => d.name.toLowerCase().includes(q.value.trim().toLowerCase()))
  arr = arr.slice()
  if (sort.value === 'name') arr.sort((a, b) => a.name.localeCompare(b.name))
  else arr.sort((a, b) => (a.updated < b.updated ? 1 : -1))
  return arr
})
const favs = computed(() => tabbed.value.filter((d) => d.favorite))
const showSections = computed(() => !q.value.trim() && !folder.value && !category.value)
const clearFolder = () => { folder.value = ''; router.replace({ path: '/dashboards' }) }
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Discover dashboards</h1>
        <p class="muted">Find, favorite and open boards — {{ live.length }} live dashboards.</p>
      </div>
      <button class="btn btn-primary" @click="store.ui.createOpen = true"><Icon name="plus" :size="17" /> Create Dashboard</button>
    </div>

    <div class="controls">
      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'all' }" @click="tab = 'all'">All</button>
        <button class="tab" :class="{ active: tab === 'mine' }" @click="tab = 'mine'">My Dashboards</button>
        <button class="tab" :class="{ active: tab === 'shared' }" @click="tab = 'shared'">Shared with me</button>
        <button class="tab" :class="{ active: tab === 'private' }" @click="tab = 'private'">Private</button>
      </div>
      <div class="grow" />
      <div class="vtoggle">
        <button :class="{ on: !store.ui.listView }" @click="store.ui.listView = false" title="Grid"><Icon name="grid" :size="15" /></button>
        <button :class="{ on: store.ui.listView }" @click="store.ui.listView = true" title="List"><Icon name="rows" :size="15" /></button>
      </div>
      <div class="search-inline">
        <Icon name="search" :size="15" class="muted" />
        <input v-model="q" placeholder="Search by name…" />
        <button v-if="q" class="x" @click="q = ''"><Icon name="x" :size="14" /></button>
      </div>
      <div class="select">
        <select v-model="category" class="input sel"><option value="">All categories</option><option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option></select>
        <Icon name="chevron-down" :size="14" class="chev" />
      </div>
      <div class="select">
        <select v-model="sort" class="input sel"><option value="recent">Recently updated</option><option value="name">Name A–Z</option></select>
        <Icon name="chevron-down" :size="14" class="chev" />
      </div>
    </div>

    <div v-if="folder" class="folder-banner">
      <Icon name="folder-open" :size="16" /> <b>{{ folderName(folder) }}</b> folder
      <button class="btn btn-sm" @click="clearFolder"><Icon name="x" :size="13" /> Clear</button>
    </div>

    <!-- Favorites (P4) -->
    <template v-if="showSections && favs.length && !store.ui.listView">
      <div class="sec-head"><Icon name="star-fill" :size="15" class="gold" /> Favorites</div>
      <div class="grid">
        <DashboardCard v-for="d in favs" :key="d.id" :d="d" @share="shareFor = $event" />
      </div>
    </template>

    <!-- Recently used (P3·2) -->
    <template v-if="showSections && recents.length && !store.ui.listView">
      <div class="sec-head"><Icon name="clock" :size="15" /> Recently used</div>
      <div class="grid">
        <DashboardCard v-for="d in recents" :key="d.id" :d="d" @share="shareFor = $event" />
      </div>
    </template>

    <div class="sec-head">
      <Icon name="grid" :size="15" />
      {{ q || folder || category ? 'Results' : 'All in ' + (tab === 'mine' ? 'My Dashboards' : tab === 'shared' ? 'Shared with me' : 'this view') }}
      <span class="cnt">{{ filtered.length }}</span>
    </div>
    <DashboardTable v-if="store.ui.listView && filtered.length" :items="filtered" @share="shareFor = $event" />
    <div v-else-if="filtered.length" class="grid">
      <DashboardCard v-for="d in filtered" :key="d.id" :d="d" @share="shareFor = $event" />
    </div>
    <div v-else class="empty card">
      <Icon name="search" :size="26" class="muted" />
      <p>No dashboards match. Try a different search or <button class="linkbtn" @click="store.ui.createOpen = true">create one</button>.</p>
    </div>

    <ShareDialog v-if="shareFor" :d="shareFor" @close="shareFor = null" />
  </div>
</template>

<style scoped>
.page { padding: 22px 26px 60px; max-width: 1320px; margin: 0 auto; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
.page-head h1 { margin: 0; font-size: 22px; letter-spacing: -.3px; }
.page-head p { margin: 4px 0 0; font-size: 13px; }
.controls { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.search-inline { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 10px; padding: 0 10px; height: 36px; width: 240px; }
.search-inline:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.search-inline input { border: none; outline: none; width: 100%; font-size: 13px; background: transparent; }
.search-inline .x { border: none; background: transparent; color: var(--muted); cursor: pointer; display: grid; place-items: center; }
.select { position: relative; }
.sel { height: 36px; width: auto; padding: 0 30px 0 12px; appearance: none; font-weight: 500; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.chev { position: absolute; right: 10px; top: 11px; color: var(--muted); pointer-events: none; }
.vtoggle { display: inline-flex; gap: 2px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 9px; padding: 2px; }
.vtoggle button { width: 32px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.vtoggle button.on { background: var(--primary-soft); color: var(--primary-700); }
.folder-banner { display: flex; align-items: center; gap: 9px; background: var(--primary-softer); border: 1px solid var(--primary-soft); color: var(--primary-700); padding: 9px 13px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
.folder-banner .btn { margin-left: auto; }
.sec-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ink-2); margin: 22px 2px 12px; }
.sec-head .gold { color: #f5a623; }
.sec-head .cnt { font-size: 11px; color: var(--muted); background: var(--surface-2); border: 1px solid var(--border); padding: 1px 8px; border-radius: 999px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 50px; color: var(--muted); }
.linkbtn { border: none; background: transparent; color: var(--primary-700); font-weight: 600; cursor: pointer; }
</style>
