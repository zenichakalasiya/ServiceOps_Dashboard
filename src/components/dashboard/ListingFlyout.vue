<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import { store, live, recents, toggleFavorite, archiveDashboard, recordView } from '../../store/index.js'
import { ACCESS } from '../../data/mock.js'
const route = useRoute()
const router = useRouter()
const emit = defineEmits(['close'])

const tab = ref('all')
const open = ref(new Set(['Recently used', 'My Favourite']))
function toggleGroup(name) { open.value.has(name) ? open.value.delete(name) : open.value.add(name); open.value = new Set(open.value) }

const tabbed = computed(() => {
  let arr = live.value
  if (tab.value === 'mine') arr = arr.filter((d) => d.mine)
  if (tab.value === 'shared') arr = arr.filter((d) => d.sharedWithMe)
  const q = store.ui.listingQuery.trim().toLowerCase()
  if (q) arr = arr.filter((d) => d.name.toLowerCase().includes(q))
  return arr
})

// groups: Recently used → My Favourite → category-wise
const groups = computed(() => {
  const set = new Set(tabbed.value.map((d) => d.id))
  const inTab = (d) => set.has(d.id)
  const g = []
  const fav = tabbed.value.filter((d) => d.favorite)
  if (fav.length) g.push({ name: 'My Favourite', items: fav })
  const rec = recents.value.filter(inTab)
  if (rec.length) g.push({ name: 'Recently used', items: rec })
  const cats = {}
  tabbed.value.forEach((d) => { const c = d.category || 'Other'; (cats[c] ||= []).push(d) })
  Object.keys(cats).sort().forEach((c) => g.push({ name: c, items: cats[c] }))
  return g
})

const isCustom = (d) => d.mine && !d.predefined
// identify a dashboard by icon: predefined · shared-with-me · created-by-me
function dashKind(d) { return d.predefined ? 'pre' : d.sharedWithMe ? 'shared' : d.mine ? 'mine' : 'other' }
function dashIcon(d) { return ({ pre: 'sparkles', shared: 'users', mine: 'user-check', other: 'layout' })[dashKind(d)] }
function openBoard(d) { recordView(d); router.push(`/dashboard/${d.id}`) }
function del(d) { archiveDashboard(d) }
</script>

<template>
  <aside class="flyout">
    <div class="fhead">
      <div class="row gap-6">
        <button class="ic" title="Collapse panel" @click="emit('close')"><Icon name="chevron-left" :size="17" /></button>
        <span class="ftitle">Dashboards</span>
      </div>
      <button class="addbtn" title="Create dashboard" @click="store.ui.cloneTarget = null; store.ui.editTarget = null; store.ui.createOpen = true"><Icon name="plus" :size="15" /></button>
    </div>

    <div class="tabs2">
      <button class="t2" :class="{ on: tab === 'all' }" @click="tab = 'all'">All</button>
      <button class="t2" :class="{ on: tab === 'mine' }" @click="tab = 'mine'">Created by me</button>
      <button class="t2" :class="{ on: tab === 'shared' }" @click="tab = 'shared'">Shared with me</button>
    </div>

    <div class="fsearch"><Icon name="search" :size="15" class="muted" /><input v-model="store.ui.listingQuery" placeholder="Search dashboards…" /></div>

    <div class="glist">
      <section v-for="grp in groups" :key="grp.name" class="grp">
        <button class="grp-head" @click="toggleGroup(grp.name)">
          <Icon :name="open.has(grp.name) ? 'chevron-down' : 'chevron-right'" :size="14" />
          <span class="gname">{{ grp.name }}</span>
          <span class="gcount">{{ grp.items.length }}</span>
        </button>
        <div v-if="open.has(grp.name)" class="items">
          <div v-for="d in grp.items" :key="grp.name + d.id" class="item" :class="{ active: route.params.id === d.id }" @click="openBoard(d)">
            <Icon :name="dashIcon(d)" :size="13" class="lk" :class="'ic-' + dashKind(d)" :title="dashKind(d)" />
            <span class="iname ellip">{{ d.name }}</span>
            <span v-if="d.predefined && grp.name !== 'Recently used' && grp.name !== 'My Favourite'" class="tag-pre">Predefined</span>
            <span class="hov">
              <button class="hb fav" :class="{ on: d.favorite }" title="Favourite" @click.stop="toggleFavorite(d)"><Icon :name="d.favorite ? 'star-fill' : 'star'" :size="13" /></button>
              <button v-if="isCustom(d)" class="hb del" title="Delete" @click.stop="del(d)"><Icon name="trash" :size="13" /></button>
            </span>
          </div>
        </div>
      </section>
      <div v-if="!groups.length" class="none">No dashboards match.</div>
    </div>

    <button class="archive-link" @click="router.push('/archive')"><Icon name="archive" :size="15" /> Archive</button>
  </aside>
</template>

<style scoped>
.flyout { width: 296px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; height: 100%; }
.fhead { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 8px; }
.ftitle { font-weight: 700; font-size: 15px; }
.ic { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 8px; display: grid; place-items: center; }
.ic:hover { background: var(--surface-2); color: var(--ink); }
/* small filled circular add — same treatment as the widget Add (FAB) button */
.addbtn { width: 26px; height: 26px; border: none; background: var(--primary); color: #fff; border-radius: 50%; display: grid; place-items: center; box-shadow: 0 2px 6px rgba(61,139,208,.35); transition: background .15s, transform .1s; }
.addbtn:hover { background: var(--primary-600); transform: translateY(-1px); }
.addbtn:active { transform: translateY(0); }
/* inline underline tabs (matches the Add-Widget side popup) */
.tabs2 { display: flex; gap: 0; padding: 0 12px; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
.t2 { border: none; background: transparent; padding: 9px 2px; margin-right: 14px; color: var(--muted); font-weight: 500; font-size: 12.5px; border-bottom: 2px solid transparent; }
.t2:hover { color: var(--ink); }
.t2.on { color: var(--primary-700); border-bottom-color: var(--primary); }
.fsearch { display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px; padding: 0 10px; height: 34px; }
.fsearch input { border: none; outline: none; background: transparent; width: 100%; font-size: 13px; }
.glist { flex: 1; overflow: auto; padding: 4px 8px 14px; }
.grp { margin-bottom: 2px; }
.grp-head { display: flex; align-items: center; gap: 7px; width: 100%; border: none; background: transparent; padding: 7px 6px; border-radius: 8px; color: var(--ink-2); font-weight: 600; font-size: 12.5px; text-align: left; }
.grp-head:hover { background: var(--surface-2); }
.gname { flex: 1; }
.gcount { font-size: 11px; color: var(--muted); background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 0 7px; font-weight: 600; }
.items { display: flex; flex-direction: column; gap: 1px; padding: 1px 0 4px; }
.item { display: flex; align-items: center; gap: 8px; padding: 7px 8px 7px 22px; border-radius: 8px; cursor: pointer; }
.item:hover { background: var(--surface-2); }
.item.active { background: var(--primary-softer); }
.item.active .iname { color: var(--primary-700); font-weight: 400; }
.lk { color: var(--muted-2); flex: none; }
.lk.ic-pre { color: var(--primary); }
.lk.ic-shared { color: var(--blue); }
.lk.ic-mine { color: var(--green); }
.iname { flex: 1; font-size: 13px; }
.tag-pre { font-size: 9.5px; font-weight: 500; color: var(--primary-700); background: var(--primary-soft); padding: 2px 6px; border-radius: 4px; flex: none; }
.hov { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .12s; }
.item:hover .hov { opacity: 1; }
.hb { width: 24px; height: 24px; border: none; background: transparent; color: var(--muted); border-radius: 6px; display: grid; place-items: center; }
.hb:hover { background: var(--surface); }
.hb.fav:hover, .hb.fav.on { color: #f5a623; }
.hb.del:hover { color: var(--red); background: var(--red-soft); }
.archive-link { display: flex; align-items: center; gap: 9px; padding: 11px 16px; border: none; border-top: 1px solid var(--border); background: transparent; color: var(--muted); font-weight: 500; font-size: 13px; }
.archive-link:hover { background: var(--surface-2); color: var(--ink); }
.none { padding: 24px 12px; text-align: center; color: var(--muted); font-size: 13px; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
