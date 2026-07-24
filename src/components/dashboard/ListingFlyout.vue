<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import ShareDialog from './ShareDialog.vue'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
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

/* The default dashboard is pinned on its own row under the search — the one board you can
 * always reach without opening a group. It follows the tab + search so the pin never lies. */
const defaultDash = computed(() => tabbed.value.find((d) => d.default) || null)

// groups: My Favourite → Recently used → category-wise
const groups = computed(() => {
  const set = new Set(tabbed.value.map((d) => d.id))
  const inTab = (d) => set.has(d.id)
  const g = []
  const fav = tabbed.value.filter((d) => d.favorite)
  if (fav.length) g.push({ name: 'My Favourite', items: fav })
  const rec = recents.value.filter(inTab)
  if (rec.length) g.push({ name: 'Recently used', items: rec })
  const cats = {}
  tabbed.value.forEach((d) => {
    if (d.default) return   // the pin above already stands in for it in its category
    const c = d.category || 'Other'; (cats[c] ||= []).push(d)
  })
  Object.keys(cats).sort().forEach((c) => g.push({ name: c, items: cats[c] }))
  return g
})

const isCustom = (d) => d.mine && !d.predefined
// identify a dashboard by icon: predefined · shared-with-me · created-by-me
function dashKind(d) {
  // Predefined WINS, even over ownership. It used to lose, so a predefined board
  // that happened to list you as owner showed the person icon. But predefined now
  // means *locked* — it can't be deleted and its tiles can't be removed — and the
  // icon has to say so. You cannot have authored a board that ships with the product.
  if (d.predefined) return 'pre'        // predefined / out-of-box → monitor
  // In the Created-by-me / Shared-with-me tabs the icon reflects the tab.
  if (tab.value === 'mine') return 'mine'
  if (tab.value === 'shared') return 'shared'
  if (d.mine) return 'mine'             // created by me → person
  if (d.sharedWithMe) return 'shared'   // shared with me → share
  return 'shared'                       // owned by someone else, surfaced to me → shared
}
// pre = monitor (predefined) · shared = share icon · mine = person
function dashIcon(d) { return ({ pre: 'predefined-monitor', shared: 'share', mine: 'user' })[dashKind(d)] }
function openBoard(d) { recordView(d); router.push(`/dashboard/${d.id}`) }
function del(d) { archiveDashboard(d) }

function openFull() { emit('close'); router.push('/dashboards') }
function newDashboard() { store.ui.cloneTarget = null; store.ui.editTarget = null; store.ui.createOpen = true }

// ---- per-row actions menu (Edit · Clone · Mark as default · Share · Archive) ----
const menuId = ref(null)
const menuPos = ref({ top: 0, left: 0 })
const menuDash = computed(() => (menuId.value ? live.value.find((d) => d.id === menuId.value) : null))
const shareTarget = ref(null)
// archiving from the listing used to fire on a single click — confirm it by name
const delTarget = ref(null)
function openMenu(d, e) {
  if (menuId.value === d.id) { menuId.value = null; return }
  const r = e.currentTarget.getBoundingClientRect()
  // open to the RIGHT of the ⋯ button (into the main area), clamped to the viewport
  menuPos.value = { top: r.bottom + 6, left: Math.min(r.right + 6, window.innerWidth - 210) }
  menuId.value = d.id
}
/* Capture the dashboard BEFORE closing the menu. `menuDash` is derived from
 * `menuId`, so clearing the menu first handed every action a null dashboard —
 * Edit, Clone, Mark-default, Share and Archive were all silently no-ops. */
function menuAct(fn) {
  const d = menuDash.value
  menuId.value = null
  if (d) fn(d)
}
function doEdit(d) { store.ui.cloneTarget = null; store.ui.editTarget = d; store.ui.createOpen = true }
function doClone(d) { store.ui.editTarget = null; store.ui.cloneTarget = d; store.ui.createOpen = true }
</script>

<template>
  <aside class="flyout">
    <div class="fhead">
      <!-- collapse is driven from the main screen's toggle now, so only the title here -->
      <span class="ftitle">Dashboards</span>
      <button class="new-ic" title="New dashboard" @click="newDashboard"><Icon name="plus" :size="17" /></button>
    </div>

    <div class="tabs2">
      <button class="t2" :class="{ on: tab === 'all' }" @click="tab = 'all'">All</button>
      <button class="t2" :class="{ on: tab === 'mine' }" @click="tab = 'mine'">Created by me</button>
      <button class="t2" :class="{ on: tab === 'shared' }" @click="tab = 'shared'">Shared with me</button>
    </div>

    <div class="fsearch"><Icon name="search" :size="15" class="muted" /><input v-model="store.ui.listingQuery" placeholder="Search dashboards…" /></div>

    <!-- default dashboard: pinned above the groups, home icon leading the name, ⋯ on hover -->
    <div v-if="defaultDash" class="def-row">
      <div class="item def" :class="{ active: route.params.id === defaultDash.id, 'menu-open': menuId === defaultDash.id }"
        title="Default dashboard — the one you land on" @click="openBoard(defaultDash)">
        <Icon name="default-home" :size="15" class="def-lead" />
        <span class="iname ellip">{{ defaultDash.name }}</span>
        <!-- home icon only + ⋯ on hover; this row IS the default, so no set-default action -->
        <span class="hov">
          <button class="hb" title="Actions" @click.stop="openMenu(defaultDash, $event)"><Icon name="dots-v" :size="14" /></button>
        </span>
      </div>
    </div>

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
              <!-- favourite is the quick action upfront on hover, and stays lit once set;
                   setting a different default landing board is a set-once action in ⋯ -->
              <button class="hb fav" :class="{ show: d.favorite }" :title="d.favorite ? 'Remove from favourites' : 'Add to favourites'" @click.stop="toggleFavorite(d)">
                <Icon :name="d.favorite ? 'star-fill' : 'star'" :size="14" />
              </button>
              <span class="hov">
                <button class="hb" title="Actions" @click.stop="openMenu(d, $event)"><Icon name="dots-v" :size="14" /></button>
              </span>
            </div>
          </div>
        </section>
      <div v-if="!groups.length" class="none">No dashboards match.</div>
    </div>

    <!-- footer: the one link that isn't reachable from the rail — creating lives in the
         header now, and Archive already has its own nav item with a count -->
    <div class="ffoot">
      <button class="manage-link" @click="openFull()"><Icon name="rows" :size="15" /> Manage all dashboards <Icon name="chevron-right" :size="14" class="ml-arrow" /></button>
    </div>

    <!-- per-row actions menu (teleported so it overlays instead of being clipped) -->
    <teleport to="body">
      <div v-if="menuId" class="row-backdrop" @click="menuId = null" />
      <transition name="pop">
        <div v-if="menuDash" class="menu row-menu" :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }" @click.stop>
          <button class="menu-item" @click="menuAct((d) => doEdit(d))"><Icon name="edit" :size="15" /> Edit</button>
          <button class="menu-item" @click="menuAct((d) => doClone(d))"><Icon name="copy" :size="15" /> Clone</button>
          <button v-if="!menuDash.default" class="menu-item" @click="menuAct((d) => markDefault(d))"><Icon name="default-home" :size="15" /> Mark as default landing</button>
          <button class="menu-item" @click="menuAct((d) => { shareTarget = d })"><Icon name="share" :size="15" /> Share</button>
          <!-- a predefined dashboard cannot be archived or deleted — the action is
               absent, not disabled: there is nothing the user could do to enable it -->
          <template v-if="!menuDash.predefined">
            <div class="menu-sep" />
            <button class="menu-item danger" @click="menuAct((d) => { delTarget = d })"><Icon name="archive" :size="15" /> Archive</button>
          </template>
        </div>
      </transition>
    </teleport>

    <ShareDialog v-if="shareTarget" :d="shareTarget" @close="shareTarget = null" />

    <ConfirmDialog
      v-if="delTarget"
      title="Archive this dashboard?"
      :target="delTarget.name"
      message="will be moved to the Archive, along with its widgets. You can restore it from there."
      confirm-label="Archive"
      @confirm="del(delTarget); delTarget = null"
      @cancel="delTarget = null"
    />
  </aside>
</template>

<style scoped>
/* retint: remap the neutral tokens on the root so every child follows the sidebar tint */
.flyout { --surface: var(--sidebar); --surface-2: var(--sidebar-hover); --border: var(--sidebar-border); width: 300px; background: var(--sidebar); border-right: 1px solid var(--sidebar-border); display: flex; flex-direction: column; height: 100%; }
.fhead { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 8px; }
.ftitle { font-weight: 600; font-size: 15px; }
.ic { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 8px; display: grid; place-items: center; }
.ic:hover { background: var(--surface-2); color: var(--ink); }
/* the primary create action — same filled treatment as the topbar's +, sized to this
   header so it sits level with the 30px ghost chevron opposite it */
.new-ic { width: 28px; height: 28px; border: none; border-radius: 8px; background: var(--primary); color: #fff; display: grid; place-items: center; box-shadow: var(--sh-sm); }
.new-ic:hover { background: var(--primary-600); }
.row { display: flex; align-items: center; } .gap-6 { gap: 6px; }
/* footer: Manage all dashboards, on its own */
.ffoot { border-top: 1px solid var(--border); padding: 10px; }
.manage-link { width: 100%; display: flex; align-items: center; gap: 9px; padding: 9px 12px; border: none; background: transparent; color: var(--ink-2); font-weight: 600; font-size: 13px; border-radius: 8px; }
.manage-link:hover { background: var(--surface-2); color: var(--ink); }
.manage-link .ml-arrow { margin-left: auto; color: var(--muted); }
/* inline underline tabs (matches the Add-Widget side popup) */
.tabs2 { display: flex; gap: 0; padding: 0 12px; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
.t2 { border: none; background: transparent; padding: 9px 2px; margin-right: 14px; color: var(--muted); font-weight: 500; font-size: 12.5px; border-bottom: 2px solid transparent; white-space: nowrap; flex: none; }
.t2:last-child { margin-right: 0; }
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
.iname { flex: 0 1 auto; min-width: 0; font-size: 13px; }
.tag-pre { font-size: 9.5px; font-weight: 500; color: var(--primary-700); background: var(--primary-soft); padding: 2px 6px; border-radius: 4px; flex: none; }
/* pinned default row — sits above the groups, so no chevron indent; home icon + ⋯ only */
.def-row { margin: 0 8px 6px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.item.def { padding-left: 8px; }
.item.def .iname { flex: 1; font-weight: 600; color: var(--ink); }
.def-lead { color: var(--primary); flex: none; }
.lk.arch { color: var(--muted); }
.hov { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .12s; }
.item:hover .hov, .item.menu-open .hov { opacity: 1; }
.item.menu-open { background: var(--surface-2); }
.hb { width: 24px; height: 24px; border: none; background: transparent; color: var(--muted); border-radius: 6px; display: grid; place-items: center; }
.hb:hover { background: var(--surface); }
.hb.del:hover { color: var(--red); background: var(--red-soft); }
/* favourite: pushed to the right, appears on hover, and stays lit (amber) once set */
.hb.fav { margin-left: auto; opacity: 0; transition: opacity .12s; }
.item:hover .hb.fav { opacity: 1; }
.hb.fav.show { opacity: 1; color: #f5a623; }
.hb.fav:hover { color: #f5a623; }
/* the star keeps its colour inside the menu, so "on" reads at a glance */
.menu-item .favon { color: #f5a623; }
/* teleported per-row menu — fixed to viewport so it isn't clipped by the scroll area */
.row-menu { position: fixed; z-index: 61; }
.row-backdrop { position: fixed; inset: 0; z-index: 59; }
.none { padding: 24px 12px; text-align: center; color: var(--muted); font-size: 13px; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
