<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import ShareDialog from './ShareDialog.vue'
import { store, live, recents, toggleFavorite, archiveDashboard, markDefault, recordView } from '../../store/index.js'
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
function dashKind(d) {
  // In the Created-by-me / Shared-with-me tabs the icon reflects the tab.
  if (tab.value === 'mine') return 'mine'
  if (tab.value === 'shared') return 'shared'
  // All tab — categorize by the dashboard's real relationship to me.
  // Ownership / sharing wins over the predefined flag, so the monitor icon only
  // shows on a genuinely predefined board that is neither mine nor shared to me.
  if (d.mine) return 'mine'             // created by me → person
  if (d.sharedWithMe) return 'shared'   // shared with me → share
  if (d.predefined) return 'pre'        // predefined / out-of-box → monitor
  return 'shared'                       // owned by someone else, surfaced to me → shared
}
// pre = monitor (predefined) · shared = share icon · mine = person
function dashIcon(d) { return ({ pre: 'predefined-monitor', shared: 'share', mine: 'user' })[dashKind(d)] }
function openBoard(d) { recordView(d); router.push(`/dashboard/${d.id}`) }
function del(d) { archiveDashboard(d) }

// ---- DEMO: 5 ways to open the full management listing (switch to compare) ----
const LSTYLES = [
  { id: 1, n: '①', desc: '① Header "open full list" icon, beside +' },
  { id: 2, n: '②', desc: '② "View all (N) →" row under the tabs' },
  { id: 3, n: '③', desc: '③ Pinned "Manage all dashboards" footer button' },
  { id: 4, n: '④', desc: '④ List ⇄ Table view toggle in the header' },
  { id: 5, n: '⑤', desc: '⑤ "See all N →" at each section end + list bottom' },
]
const showListDemo = true    // visible — shows the 5 manage-dashboard entry-point options
const ls = computed(() => (showListDemo ? store.ui.listStyle : 0))
const isCat = (name) => name !== 'My Favourite' && name !== 'Recently used'
function openFull(query) { emit('close'); router.push(query ? { path: '/dashboards', query } : '/dashboards') }

// ---- per-row actions menu (Edit · Clone · Mark as default · Share · Archive) ----
const menuId = ref(null)
const menuPos = ref({ top: 0, left: 0 })
const menuDash = computed(() => (menuId.value ? live.value.find((d) => d.id === menuId.value) : null))
const shareTarget = ref(null)
function openMenu(d, e) {
  if (menuId.value === d.id) { menuId.value = null; return }
  const r = e.currentTarget.getBoundingClientRect()
  // open to the RIGHT of the ⋯ button (into the main area), clamped to the viewport
  menuPos.value = { top: r.bottom + 6, left: Math.min(r.right + 6, window.innerWidth - 210) }
  menuId.value = d.id
}
function menuAct(fn) { menuId.value = null; fn() }
function doEdit(d) { store.ui.cloneTarget = null; store.ui.editTarget = d; store.ui.createOpen = true }
function doClone(d) { store.ui.editTarget = null; store.ui.cloneTarget = d; store.ui.createOpen = true }
</script>

<template>
  <aside class="flyout">
    <div class="fhead">
      <div class="row gap-6">
        <button class="ic" title="Collapse panel" @click="emit('close')"><Icon name="chevron-left" :size="17" /></button>
        <span class="ftitle">Dashboards</span>
      </div>
      <div class="row gap-6">
        <!-- ④ list ⇄ table view toggle -->
        <div v-if="ls === 4" class="vtoggle">
          <button class="vt on" title="List view"><Icon name="list" :size="14" /></button>
          <button class="vt" title="Open table view" @click="openFull()"><Icon name="table" :size="14" /></button>
        </div>
        <!-- ① header open-full icon -->
        <button v-if="ls === 1" class="ic" title="Open full list" @click="openFull()"><Icon name="maximize-tile" :size="16" /></button>
        <button class="addbtn" title="Create dashboard" @click="store.ui.cloneTarget = null; store.ui.editTarget = null; store.ui.createOpen = true"><Icon name="plus" :size="15" /> Dashboard</button>
      </div>
    </div>

    <!-- DEMO switcher: pick which "open full list" entry point to preview (hidden for now) -->
    <div v-if="showListDemo" class="lstyle-bar">
      <span class="ls-label">Open-full demo</span>
      <div class="ls-seg">
        <button v-for="s in LSTYLES" :key="s.id" class="ls-b" :class="{ on: ls === s.id }" :title="s.desc" @click="store.ui.listStyle = s.id">{{ s.n }}</button>
      </div>
    </div>

    <div class="tabs2">
      <button class="t2" :class="{ on: tab === 'all' }" @click="tab = 'all'">All</button>
      <button class="t2" :class="{ on: tab === 'mine' }" @click="tab = 'mine'">Created by me</button>
      <button class="t2" :class="{ on: tab === 'shared' }" @click="tab = 'shared'">Shared with me</button>
    </div>

    <!-- ② View all row under the tabs -->
    <button v-if="ls === 2" class="viewall-row" @click="openFull()">
      <Icon name="rows" :size="15" /> <span class="va-t">View all dashboards</span> <span class="va-count">{{ live.length }}</span> <Icon name="chevron-right" :size="15" class="va-arrow" />
    </button>

    <div class="fsearch"><Icon name="search" :size="15" class="muted" /><input v-model="store.ui.listingQuery" placeholder="Search dashboards…" /></div>

    <div class="glist">
      <section v-for="grp in groups" :key="grp.name" class="grp">
        <button class="grp-head" @click="toggleGroup(grp.name)">
          <Icon :name="open.has(grp.name) ? 'chevron-down' : 'chevron-right'" :size="14" />
          <span class="gname">{{ grp.name }}</span>
          <span class="gcount">{{ grp.items.length }}</span>
        </button>
        <div v-if="open.has(grp.name)" class="items">
          <div v-for="d in grp.items" :key="grp.name + d.id" class="item" :class="{ active: route.params.id === d.id, 'menu-open': menuId === d.id }" @click="openBoard(d)">
            <Icon :name="dashIcon(d)" :size="13" class="lk" :class="'ic-' + dashKind(d)" :title="dashKind(d)" />
            <span class="iname ellip">{{ d.name }}</span>
            <Icon v-if="d.default" name="default-home" :size="14" class="def-ic" title="Default landing dashboard" />
            <span class="hov">
              <button class="hb fav" :class="{ on: d.favorite }" title="Favourite" @click.stop="toggleFavorite(d)"><Icon :name="d.favorite ? 'star-fill' : 'star'" :size="13" /></button>
              <button class="hb" title="Actions" @click.stop="openMenu(d, $event)"><Icon name="dots-v" :size="14" /></button>
            </span>
          </div>
          <!-- ⑤ per-section "See all" -->
          <button v-if="ls === 5" class="see-all" @click.stop="openFull(isCat(grp.name) ? { category: grp.name } : undefined)">See all {{ grp.items.length }} <Icon name="chevron-right" :size="12" /></button>
        </div>
      </section>
      <div v-if="!groups.length" class="none">No dashboards match.</div>
      <!-- ⑤ global "See all" at the very bottom of the list -->
      <button v-if="ls === 5 && groups.length" class="see-all-global" @click="openFull()"><Icon name="rows" :size="14" /> See all {{ live.length }} dashboards <Icon name="chevron-right" :size="13" /></button>
    </div>

    <!-- ③ pinned footer "Manage all dashboards" -->
    <button v-if="ls === 3" class="manage-link" @click="openFull()"><Icon name="rows" :size="15" /> Manage all dashboards <Icon name="chevron-right" :size="14" class="ml-arrow" /></button>
    <button class="archive-link" @click="router.push('/archive')"><Icon name="archive" :size="15" /> Archive</button>

    <!-- per-row actions menu (teleported so it overlays instead of being clipped) -->
    <teleport to="body">
      <div v-if="menuId" class="row-backdrop" @click="menuId = null" />
      <transition name="pop">
        <div v-if="menuDash" class="menu row-menu" :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }" @click.stop>
          <button class="menu-item" @click="menuAct(() => doEdit(menuDash))"><Icon name="edit" :size="15" /> Edit</button>
          <button class="menu-item" @click="menuAct(() => doClone(menuDash))"><Icon name="copy" :size="15" /> Clone</button>
          <button v-if="!menuDash.default" class="menu-item" @click="menuAct(() => markDefault(menuDash))"><Icon name="pin" :size="15" /> Mark as default landing</button>
          <button class="menu-item" @click="menuAct(() => { shareTarget = menuDash })"><Icon name="share" :size="15" /> Share</button>
          <div class="menu-sep" />
          <button class="menu-item danger" @click="menuAct(() => del(menuDash))"><Icon name="archive" :size="15" /> Archive</button>
        </div>
      </transition>
    </teleport>

    <ShareDialog v-if="shareTarget" :d="shareTarget" @close="shareTarget = null" />
  </aside>
</template>

<style scoped>
.flyout { width: 296px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; height: 100%; }
.fhead { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 8px; }
.ftitle { font-weight: 600; font-size: 15px; }
.ic { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 8px; display: grid; place-items: center; }
.ic:hover { background: var(--surface-2); color: var(--ink); }
/* filled pill add-button — "+ Dashboard" */
.addbtn { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 12px 0 9px; border: none; background: var(--primary); color: #fff; border-radius: 4px; font-weight: 600; font-size: 12.5px; white-space: nowrap; box-shadow: 0 2px 6px rgba(61,139,208,.35); transition: background .15s, transform .1s; }
.addbtn:hover { background: var(--primary-600); transform: translateY(-1px); }
.addbtn:active { transform: translateY(0); }
.row { display: flex; align-items: center; } .gap-6 { gap: 6px; }
/* ④ list/table view toggle */
.vtoggle { display: inline-flex; gap: 2px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 2px; }
.vt { width: 26px; height: 24px; border: none; background: transparent; color: var(--muted); border-radius: 6px; display: grid; place-items: center; }
.vt.on { background: var(--surface); color: var(--primary-700); box-shadow: var(--sh-sm); }
.vt:hover:not(.on) { color: var(--ink); }
/* demo switcher for the open-full entry point */
.lstyle-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 12px 8px; padding: 5px 8px; background: var(--surface-2); border: 1px dashed var(--border-strong); border-radius: 9px; }
.ls-label { font-size: 10.5px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
.ls-seg { display: inline-flex; gap: 2px; }
.ls-b { width: 24px; height: 24px; border: none; background: transparent; color: var(--muted); border-radius: 6px; font-size: 13px; }
.ls-b:hover { background: var(--surface); color: var(--ink); }
.ls-b.on { background: var(--primary); color: #fff; }
/* ② view-all row */
.viewall-row { display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; padding: 0 12px; height: 38px; border: 1px solid var(--primary-soft); background: var(--primary-softer); color: var(--primary-700); font-weight: 600; font-size: 13px; border-radius: 9px; }
.viewall-row:hover { background: var(--primary-soft); border-color: var(--primary); }
.viewall-row .va-t { flex: 1; text-align: left; }
.viewall-row .va-count { font-size: 11px; background: #fff; border: 1px solid var(--primary-soft); border-radius: 999px; padding: 0 7px; }
.viewall-row .va-arrow { color: var(--primary); }
/* ⑤ see-all links */
.see-all { display: inline-flex; align-items: center; gap: 3px; margin: 2px 0 4px 22px; border: none; background: transparent; color: var(--primary-700); font-weight: 600; font-size: 11.5px; padding: 3px 4px; }
.see-all:hover { text-decoration: underline; }
.see-all-global { display: flex; align-items: center; justify-content: center; gap: 6px; width: calc(100% - 16px); margin: 6px 8px 2px; padding: 9px; border: 1px dashed var(--border-strong); background: transparent; color: var(--primary-700); font-weight: 600; font-size: 12.5px; border-radius: 9px; }
.see-all-global:hover { background: var(--primary-softer); border-color: var(--primary); }
/* ③ pinned footer manage link */
.manage-link { display: flex; align-items: center; gap: 9px; padding: 11px 16px; border: none; border-top: 1px solid var(--border); background: var(--primary-softer); color: var(--primary-700); font-weight: 600; font-size: 13px; }
.manage-link:hover { background: var(--primary-soft); }
.manage-link .ml-arrow { margin-left: auto; color: var(--primary); }
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
.def-ic { color: var(--primary); flex: none; }
.hov { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .12s; }
.item:hover .hov, .item.menu-open .hov { opacity: 1; }
.item.menu-open { background: var(--surface-2); }
.hb { width: 24px; height: 24px; border: none; background: transparent; color: var(--muted); border-radius: 6px; display: grid; place-items: center; }
.hb:hover { background: var(--surface); }
.hb.fav:hover, .hb.fav.on { color: #f5a623; }
.hb.del:hover { color: var(--red); background: var(--red-soft); }
/* teleported per-row menu — fixed to viewport so it isn't clipped by the scroll area */
.row-menu { position: fixed; z-index: 61; }
.row-backdrop { position: fixed; inset: 0; z-index: 59; }
.archive-link { display: flex; align-items: center; gap: 9px; padding: 11px 16px; border: none; border-top: 1px solid var(--border); background: transparent; color: var(--muted); font-weight: 500; font-size: 13px; }
.archive-link:hover { background: var(--surface-2); color: var(--ink); }
.none { padding: 24px 12px; text-align: center; color: var(--muted); font-size: 13px; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
