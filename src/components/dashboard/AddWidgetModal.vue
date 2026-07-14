<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import Dropdown from '../ui/Dropdown.vue'
import WidgetBuilderModal from './WidgetBuilderModal.vue'
import { store, addTilesToDashboard, deleteLibTile, restoreLibTile, removeLibTileForever, libUsage, removeTileFromDashboard, toast } from '../../store/index.js'
import { uid } from '../../data/mock.js'
const props = defineProps({ d: Object, group: { type: String, default: null } })
const emit = defineEmits(['close', 'created', 'newgroup'])
const router = useRouter()
function tagGroup(id) { if (props.group && id != null) { const t = props.d.tiles.find((x) => x.id === id); if (t) t.group = props.group } }

const tab = ref('chart')              // chart | predefined | user | shared | trash
const fModule = ref('')
const fType = ref('')                 // '' | kpi | chart | shortcut
const search = ref('')
const TYPE_FILTERS = [{ v: '', label: 'All' }, { v: 'kpi', label: 'KPI' }, { v: 'chart', label: 'Widget' }, { v: 'shortcut', label: 'Shortcut' }]
const builder = ref(null)             // selected chart type → opens centered builder

// ---- Chart type tab: AIOps-style category grid ----
const GROUPS = [
  { cat: 'Widget', types: [
    { id: 'line', label: 'Line', icon: 'chart-line', type: 'chart', kind: 'line' },
    { id: 'bar', label: 'Bar', icon: 'chart-bar', type: 'chart', kind: 'hbar' },
    { id: 'column', label: 'Column', icon: 'chart-bar', type: 'chart', kind: 'bar' },
    { id: 'pie', label: 'Pie', icon: 'chart-pie', type: 'chart', kind: 'donut' },
  ] },
  { cat: 'KPI', types: [{ id: 'kpi', label: 'KPI', icon: 'kpi', type: 'kpi', kind: null }] },
  { cat: 'Shortcut', types: [{ id: 'shortcut', label: 'Shortcut', icon: 'table', type: 'shortcut', kind: null }] },
]
const filteredGroups = computed(() => GROUPS.map((g) => ({
  cat: g.cat, types: g.types.filter((t) => t.label.toLowerCase().includes(search.value.toLowerCase())),
})).filter((g) => g.types.length))

// ---- Reuse tabs: listing with actions ----
const provMap = { predefined: 'predefined', user: 'user', shared: 'shared' }
const isTrash = computed(() => tab.value === 'trash')

/* Module counts must describe WHAT YOU WILL GET, so they are scoped to the tab and
 * the type filter you already have on. They used to count the whole library, so
 * "Request (20)" on the Created-by-me tab would open three rows — the badge and the
 * result disagreed. A module with nothing in the current tab isn't offered at all;
 * a filter that can only ever return nothing isn't a filter.
 * "All modules" carries no count: it is the absence of a filter, not a bucket. */
const moduleBase = computed(() => {
  const arr = isTrash.value
    ? store.library.filter((l) => l.trashed)
    : store.library.filter((l) => l.prov === provMap[tab.value] && !l.trashed)
  return fType.value ? arr.filter((l) => l.type === fType.value) : arr
})
const moduleCount = (m) => moduleBase.value.filter((l) => l.module === m).length
const moduleOptions = computed(() => [
  { value: '', label: 'All modules' },
  ...store.modules.filter((m) => moduleCount(m) > 0).map((m) => ({ value: m, label: `${m} (${moduleCount(m)})` })),
])
// switching tab/type can retire the module you had picked — don't leave a dead filter on
watch(moduleOptions, (opts) => {
  if (fModule.value && !opts.some((o) => o.value === fModule.value)) fModule.value = ''
})
const trashCount = computed(() => store.library.filter((l) => l.trashed).length)
const list = computed(() => {
  let arr = isTrash.value
    ? store.library.filter((l) => l.trashed)
    : store.library.filter((l) => l.prov === provMap[tab.value] && !l.trashed)
  if (fType.value) arr = arr.filter((l) => l.type === fType.value)
  if (fModule.value) arr = arr.filter((l) => l.module === fModule.value)
  if (search.value.trim()) arr = arr.filter((l) => l.title.toLowerCase().includes(search.value.trim().toLowerCase()))
  return arr
})
// per-type counts for the current tab (before the type filter is applied)
const typeCounts = computed(() => {
  const base = isTrash.value
    ? store.library.filter((l) => l.trashed && (!fModule.value || l.module === fModule.value))
    : store.library.filter((l) => l.prov === provMap[tab.value] && !l.trashed && (!fModule.value || l.module === fModule.value))
  return { '': base.length, kpi: base.filter((l) => l.type === 'kpi').length, chart: base.filter((l) => l.type === 'chart').length, shortcut: base.filter((l) => l.type === 'shortcut').length }
})
// ---- multi-select: add is ONLY via checkbox + footer (no per-row quick add) ----
const MAX_SEL = 10
const selected = ref(new Set())
// a library item already on this dashboard can't be added again — it shows as checked+locked
function isPlaced(l) { return props.d.tiles.some((t) => t.title === l.title && t.type === l.type) }
function isSel(l) { return selected.value.has(l.id) }
function toggleSel(l) {
  if (isPlaced(l)) return   // already on the dashboard
  const s = new Set(selected.value)
  if (s.has(l.id)) s.delete(l.id)
  else if (s.size >= MAX_SEL) { toast(`You can add up to ${MAX_SEL} at once`, 'warn'); return }
  else s.add(l.id)
  selected.value = s
}
function clearSel() { selected.value = new Set() }
function addSelected() {
  const items = store.library.filter((l) => selected.value.has(l.id))
  if (!items.length) return
  const before = props.d.tiles.length
  addTilesToDashboard(props.d, items)
  if (props.group) for (let i = before; i < props.d.tiles.length; i++) props.d.tiles[i].group = props.group
  emit('close')
}

// ---- Duplicate / Edit → open the builder (live preview); Update returns a copy to the listing ----
const libBuilder = ref(null)
function typeDesc(l) {
  if (l.type === 'kpi') return { id: 'kpi', label: 'KPI', type: 'kpi', kind: null }
  if (l.type === 'shortcut') return { id: 'shortcut', label: 'Shortcut', type: 'shortcut', kind: null }
  return { id: 'bar', label: 'Widget', type: 'chart', kind: 'bar' }
}
function openLibBuilder(l) { libBuilder.value = { type: typeDesc(l), item: l } }
function uniqueName(base) {
  const names = new Set(store.library.map((l) => l.title.toLowerCase()))
  if (!names.has(base.toLowerCase())) return base
  let n = 1
  while (names.has(`${base} copy ${n}`.toLowerCase())) n++
  return `${base} Copy ${n}`
}
function onLibrarySaved({ title, module, type, sharedAccess, place }) {
  const item = { id: uid('lt'), type, title: uniqueName(title), prov: provMap[tab.value], module, favorite: false, sharedAccess: sharedAccess || 'view' }
  store.library.unshift(item)     // shows at top of the current tab's listing
  libBuilder.value = null
  if (place) {                    // "Clone & Add Widget" → place on canvas + redirect
    addTilesToDashboard(props.d, [item])
    const newId = props.d.tiles[props.d.tiles.length - 1].id
    tagGroup(newId)
    emit('created', newId)
    emit('close')
  } else {
    toast(`Saved “${item.title}” — select it to add`, 'success')
  }
}
// "Create Widget" (no place) → save the new definition into User Defined
function onSavedToLibrary({ title, module, type, sharedAccess }) {
  const item = { id: uid('lt'), type, title: uniqueName(title), prov: 'user', module, favorite: false, sharedAccess: sharedAccess || 'view' }
  store.library.unshift(item)
  builder.value = null
  tab.value = 'user'
  toast(`Saved “${item.title}” to User Defined`, 'success')
}

// ---- Delete = soft-delete to Trash · Trash tab: Restore + Delete forever (confirm) ----
const delTarget = ref(null)
function delLib(l) { deleteLibTile(l) }          // → Trash (reversible)
function restore(l) { restoreLibTile(l) }
function delForever(l) { delTarget.value = l }    // opens the confirm modal
function confirmDel() { removeLibTileForever(delTarget.value); delTarget.value = null }

// ---- per-tab action rules (same for Widget / KPI / Shortcut) ----
// Predefined: Duplicate only · User Defined: Duplicate·Edit·Delete
// Shared: Duplicate always, Edit only if the owner granted Edit access
function canDuplicate() { return true }
function canEdit(l) {
  if (tab.value === 'user') return true
  if (tab.value === 'shared') return l.sharedAccess === 'edit' || l.sharedAccess === 'both'
  return false   // predefined → no edit
}
function canDelete() { return tab.value === 'user' }
function hasActions(l) { return canDuplicate(l) || canEdit(l) || canDelete(l) }

const TYPE_LABEL = { kpi: 'KPI', chart: 'Widget', shortcut: 'Shortcut' }

/* ---- Where is this widget used? ------------------------------------------------
 * The count sits on the widget's NAME, and hovering it lists the dashboards. From
 * there you can jump straight to the widget on that board, or pull it off. This is
 * the impact view a tenant-wide library needs: the point of the count is to answer
 * "what will I break if I change this", and a number alone can't. */
const usageOpen = ref(null)
const usagePos = ref({ top: 0, left: 0 })
let closeTimer = null

function usageOf(l) { return libUsage(l) }
function openUsage(l, e) {
  clearTimeout(closeTimer)
  const r = e.currentTarget.getBoundingClientRect()
  const W = 250
  usagePos.value = {
    top: r.bottom + 6,
    left: Math.max(8, Math.min(r.left - 8, window.innerWidth - W - 8)),
  }
  usageOpen.value = l.id
}
// a grace period, or the popover would vanish the moment the cursor left the badge
// and there would be no way to reach the rows inside it
function closeUsageSoon() { closeTimer = setTimeout(() => { usageOpen.value = null }, 180) }
function keepUsage() { clearTimeout(closeTimer) }
onBeforeUnmount(() => clearTimeout(closeTimer))

const usageItem = computed(() => store.library.find((l) => l.id === usageOpen.value) || null)

function removeFromDash(l, dash) { removeTileFromDashboard(dash, l); if (!usageOf(l).length) usageOpen.value = null }

/* Jump to this widget where it lives. The tile is matched by title+type — the same
 * identity the library uses everywhere else — and DashboardView focuses it once the
 * board has finished its skeleton, so the scroll lands on a widget that exists. */
function goToWidget(l, dash) {
  usageOpen.value = null
  store.ui.focusTile = { title: l.title, type: l.type }
  emit('close')
  if (dash.id === props.d.id) return    // already here — DashboardView's watcher picks it up
  router.push(`/dashboard/${dash.id}`)
}
// short description shown in a left-pointing tooltip on hover of each library row
function libDesc(l) {
  const kind = l.type === 'kpi' ? 'A headline KPI number' : l.type === 'shortcut' ? 'A record list / table' : 'A chart widget'
  return `${kind} from the ${l.module} module.`
}
const tip = ref({ show: false, text: '', top: 0, right: 0 })
function showTip(l, e) {
  const r = e.currentTarget.getBoundingClientRect()
  tip.value = { show: true, text: libDesc(l), top: r.top + r.height / 2, right: window.innerWidth - r.left + 12 }
}
function hideTip() { tip.value.show = false }
const TAB_LABEL = { predefined: 'Ready-made', user: 'Created by me', shared: 'Shared with me', trash: 'Trash' }
const emptyMsg = computed(() => {
  const plural = fType.value ? (fType.value === 'kpi' ? 'KPIs' : TYPE_LABEL[fType.value] + 's') : 'items'
  if (isTrash.value) return `Trash is empty.`
  return `No ${plural} in ${TAB_LABEL[tab.value] || 'this tab'} yet.`
})
const emptyHelp = computed(() => {
  if (tab.value === 'trash') return 'Deleted widgets, KPIs and Shortcuts land here — restore them, or delete forever.'
  if (tab.value === 'shared') return 'Widgets, KPIs and Shortcuts shared with you will appear here.'
  if (tab.value === 'user') return 'Create one from the Create Widget tab, then it appears here.'
  return 'Ready-made tiles curated by your admin will appear here.'
})
watch([tab], () => { search.value = ''; fModule.value = ''; fType.value = ''; selected.value = new Set() })
watch(fType, (v) => { if (v === 'shortcut') fModule.value = '' })   // Shortcut listing has no module filter

function onCreated(id) { tagGroup(id); emit('created', id); emit('close') }
</script>

<template>
  <div class="drawer-overlay" @click.self="emit('close')">
    <div class="aw">
      <header class="aw-head">
        <h3>Add New Widget</h3>
        <button class="ic" @click="emit('close')"><Icon name="x" :size="18" /></button>
      </header>

      <!-- top tabs -->
      <div class="aw-tabs">
        <button class="awt" :class="{ on: tab === 'chart' }" @click="tab = 'chart'">Create Widget</button>
        <button class="awt" :class="{ on: tab === 'predefined' }" @click="tab = 'predefined'">Ready-made</button>
        <button class="awt" :class="{ on: tab === 'user' }" @click="tab = 'user'">Created by me</button>
        <button class="awt" :class="{ on: tab === 'shared' }" @click="tab = 'shared'">Shared with me</button>
        <button class="awt" :class="{ on: tab === 'trash' }" @click="tab = 'trash'"><Icon name="trash" :size="13" /> Trash <span v-if="trashCount" class="awt-count">{{ trashCount }}</span></button>
      </div>

      <!-- module filter + search (reuse tabs only — the Create Widget tab has no search) -->
      <div v-if="tab !== 'chart'" class="aw-filters">
        <div class="srch"><Icon name="search" :size="15" class="muted" /><input v-model="search" placeholder="Search…" /></div>
        <div v-if="fType !== 'shortcut'" class="modsel"><Dropdown v-model="fModule" :options="moduleOptions" placeholder="All modules" /></div>
      </div>

      <!-- type filter (reuse tabs) — bifurcate KPI / Widget / Shortcut -->
      <div v-if="tab !== 'chart'" class="type-chips">
        <button v-for="t in TYPE_FILTERS" :key="t.v" class="tchip" :class="{ on: fType === t.v }" @click="fType = t.v">
          {{ t.label }} <span class="tc-count">{{ typeCounts[t.v] }}</span>
        </button>
      </div>

      <div class="aw-body">
        <!-- CHART TYPE: category card grid → opens centered builder -->
        <template v-if="tab === 'chart'">
          <section v-for="g in filteredGroups" :key="g.cat" class="cat">
            <div class="cat-h">{{ g.cat }}</div>
            <div class="cards">
              <button v-for="t in g.types" :key="t.id" class="tc" @click="builder = t">
                <div class="tc-ico" :class="{ rot90: t.id === 'bar' }"><Icon :name="t.icon" :size="40" /></div>
                <span class="tc-label">{{ t.label }}</span>
              </button>
            </div>
          </section>
          <!-- Empty Group is the last option (charts come first) -->
          <section class="cat">
            <div class="cat-h">Layout</div>
            <div class="cards">
              <button class="tc tc-group" @click="emit('newgroup')">
                <div class="tc-ico"><Icon name="new-group" :size="40" /></div>
                <span class="tc-label">Empty Group</span>
              </button>
            </div>
          </section>
          <div v-if="!filteredGroups.length" class="none">No types match “{{ search }}”.</div>
        </template>

        <!-- REUSE TABS: listing with actions -->
        <template v-else>
          <div v-if="list.length" class="lst">
            <div v-for="l in list" :key="l.id" class="lrow" :class="{ sel: isSel(l), placed: isPlaced(l) }" @mouseenter="showTip(l, $event)" @mouseleave="hideTip">
              <input v-if="!isTrash" type="checkbox" class="lcb" :checked="isSel(l) || isPlaced(l)" :disabled="isPlaced(l)" @change="toggleSel(l)" />
              <span v-else class="trash-ic"><Icon name="trash" :size="15" /></span>
              <div class="lt-main">
                <div class="lt-name-row">
                  <span class="lt-name ellip">{{ l.title }}</span>
                  <!-- usage lives beside the NAME: it is a property of the widget, not
                       of its module. Hover it to see where, click a row to go there. -->
                  <span
                    v-if="!isTrash && usageOf(l).length" class="use-badge"
                    :class="{ on: usageOpen === l.id }"
                    :title="`On ${usageOf(l).length} dashboard${usageOf(l).length > 1 ? 's' : ''}`"
                    @mouseenter="openUsage(l, $event)" @mouseleave="closeUsageSoon" @click.stop
                  >{{ usageOf(l).length }}</span>
                  <span v-if="isPlaced(l)" class="placed-tag"><Icon name="check" :size="11" /> On dashboard</span>
                </div>
                <div class="lt-meta">{{ TYPE_LABEL[l.type] }} · {{ l.module }}</div>
              </div>
              <!-- Trash: Restore + Delete forever · other tabs: Duplicate / Edit / Delete -->
              <div v-if="isTrash" class="lt-acts always">
                <button class="la" title="Restore" @click="restore(l)"><Icon name="restore" :size="15" /></button>
                <button class="la del" title="Delete forever" @click="delForever(l)"><Icon name="trash" :size="15" /></button>
              </div>
              <div v-else-if="hasActions(l) && !isPlaced(l)" class="lt-acts">
                <button v-if="canDuplicate(l)" class="la" title="Duplicate" @click="openLibBuilder(l)"><Icon name="copy" :size="15" /></button>
                <button v-if="canEdit(l)" class="la" title="Edit" @click="openLibBuilder(l)"><Icon name="edit" :size="15" /></button>
                <button v-if="canDelete(l)" class="la del" title="Delete" @click="delLib(l)"><Icon name="trash" :size="15" /></button>
              </div>
            </div>
          </div>
          <div v-else class="none"><Icon name="inbox" :size="24" /><p class="none-t">{{ emptyMsg }}</p><span class="none-h">{{ emptyHelp }}</span></div>
        </template>
      </div>

      <!-- multi-select footer: Add (n) / Cancel -->
      <transition name="slideup">
        <footer v-if="tab !== 'chart' && selected.size" class="aw-foot">
          <span class="selinfo">{{ selected.size }} selected<span v-if="selected.size >= MAX_SEL"> · max {{ MAX_SEL }}</span></span>
          <div class="fbtns">
            <button class="btn" @click="clearSel">Cancel</button>
            <button class="btn btn-primary" @click="addSelected"><Icon name="plus" :size="15" /> Add</button>
          </div>
        </footer>
      </transition>
    </div>

    <!-- Centered builder — create from Chart type -->
    <WidgetBuilderModal v-if="builder" :d="d" :type="builder" @close="builder = null" @created="onCreated" @savedToLibrary="onSavedToLibrary" />
    <!-- Centered builder — duplicate/edit a library tile (Update returns a copy to the listing) -->
    <WidgetBuilderModal v-if="libBuilder" :d="d" :type="libBuilder.type" :libItem="libBuilder.item" @close="libBuilder = null" @librarySaved="onLibrarySaved" />

    <!-- Where the widget is used. Teleported: the list scrolls, and an in-flow popover
         would be clipped by its overflow. -->
    <teleport to="body">
      <div
        v-if="usageItem" class="usage-pop"
        :style="{ top: usagePos.top + 'px', left: usagePos.left + 'px' }"
        @mouseenter="keepUsage" @mouseleave="closeUsageSoon"
      >
        <div class="up-h">Placed on {{ usageOf(usageItem).length }} dashboard{{ usageOf(usageItem).length > 1 ? 's' : '' }}</div>
        <button
          v-for="dash in usageOf(usageItem)" :key="dash.id" class="up-row"
          :title="`Go to “${usageItem.title}” on ${dash.name}`"
          @click="goToWidget(usageItem, dash)"
        >
          <Icon name="layout" :size="13" class="up-ic" />
          <span class="ellip">{{ dash.name }}</span>
          <span class="up-rm" title="Remove from this dashboard" @click.stop="removeFromDash(usageItem, dash)"><Icon name="trash" :size="13" /></span>
        </button>
        <p class="up-f">Click a dashboard to jump to this widget on it.</p>
      </div>
    </teleport>

    <!-- Row description tooltip — opens to the left of the hovered row, arrow points right -->
    <teleport to="body">
      <transition name="fade">
        <div v-if="tip.show" class="lib-tip" :style="{ top: tip.top + 'px', right: tip.right + 'px' }">{{ tip.text }}<span class="lib-tip-arrow" /></div>
      </transition>
    </teleport>

    <!-- Delete confirmation -->
    <teleport to="body">
      <div v-if="delTarget" class="cf-overlay" @click.self="delTarget = null">
        <div class="cf">
          <div class="cf-ico"><Icon name="trash" :size="22" /></div>
          <h4>Delete “{{ delTarget.title }}” forever?</h4>
          <p>This permanently removes it from the library. This action can’t be undone.</p>
          <div class="cf-btns">
            <button class="btn" @click="delTarget = null">Cancel</button>
            <button class="btn cf-del" @click="confirmDel"><Icon name="trash" :size="15" /> Delete forever</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.drawer-overlay { position: fixed; inset: 0; background: rgba(20,21,38,.42); backdrop-filter: blur(2px); z-index: 100; display: flex; justify-content: flex-end; }
.aw { width: 720px; max-width: 96vw; height: 100%; background: var(--surface); box-shadow: var(--sh-lg); display: flex; flex-direction: column; overflow: hidden; animation: slideIn .22s cubic-bezier(.2,.8,.2,1); }
@keyframes slideIn { from { transform: translateX(30px); opacity: .4; } to { transform: translateX(0); opacity: 1; } }
.aw-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 12px; }
.aw-head h3 { margin: 0; font-size: 17px; }
.ic { width: 34px; height: 34px; border: none; background: transparent; color: var(--muted); border-radius: 9px; display: grid; place-items: center; }
.ic:hover { background: var(--surface-2); color: var(--ink); }
.aw-tabs { display: flex; gap: 4px; padding: 0 22px; border-bottom: 1px solid var(--border); }
.awt { display: inline-flex; align-items: center; gap: 5px; border: none; background: transparent; padding: 10px 4px; margin-right: 14px; font-weight: 500; font-size: 13.5px; color: var(--muted); border-bottom: 2px solid transparent; }
.awt:hover { color: var(--ink); }
.awt.on { color: var(--primary-700); border-bottom-color: var(--primary); }
.awt-count { font-size: 10.5px; font-weight: 700; background: var(--red-soft); color: var(--red); border-radius: 999px; padding: 0 6px; }
.aw-filters { display: flex; gap: 9px; padding: 14px 22px 6px; }
.srch { display: flex; align-items: center; gap: 8px; background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 9px; padding: 0 11px; height: 38px; flex: 1; }
.srch input { border: none; outline: none; background: transparent; width: 100%; font-size: 13.5px; }
.modsel { width: 172px; flex: none; }
.type-chips { display: flex; gap: 7px; padding: 10px 22px 2px; }
.tchip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); border-radius: 999px; font-size: 12.5px; font-weight: 500; }
.tchip:hover { background: var(--surface-2); }
.tchip.on { background: var(--primary-soft); border-color: transparent; color: var(--primary-700); }
.tc-count { font-size: 10.5px; font-weight: 600; background: var(--surface-2); border-radius: 999px; padding: 0 6px; color: var(--muted); }
.tchip.on .tc-count { background: #fff; color: var(--primary-700); }
.aw-body { flex: 1; overflow: auto; padding: 14px 22px 22px; }
.cat { margin-bottom: 18px; }
.cat-h { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--muted-2); font-weight: 600; margin: 6px 0 10px; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.tc { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 30px 12px; border: 1px solid var(--border); background: var(--surface-2); border-radius: 12px; color: var(--ink-2); }
.tc:hover { border-color: var(--primary); background: var(--primary-softer); color: var(--primary-700); box-shadow: var(--sh-sm); transform: translateY(-2px); }
.tc-group { border-style: dashed; border-color: var(--border-strong); }
.tc-ico { width: 60px; height: 60px; display: grid; place-items: center; }
.tc-ico.rot90 { transform: rotate(90deg); }
.tc-label { font-size: 13px; font-weight: 500; }
.lst { display: flex; flex-direction: column; gap: 2px; }
.lrow { display: flex; align-items: center; gap: 12px; padding: 10px 10px; border-radius: 10px; }
.lrow:hover { background: var(--surface-2); }
.lrow.sel { background: var(--primary-softer); }
.lrow.placed { opacity: .72; }
.lrow.placed .lcb { cursor: not-allowed; }
.placed-tag { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 600; color: var(--green); background: var(--green-soft); padding: 1px 7px 1px 5px; border-radius: 999px; flex: none; }
.lcb { width: 16px; height: 16px; accent-color: var(--primary); flex: none; cursor: pointer; margin: 0; }
.lt-main { flex: 1; min-width: 0; }
.lt-name-row { display: flex; align-items: center; gap: 7px; } .lt-name { font-weight: 500; font-size: 13.5px; }
.lt-meta { position: relative; font-size: 11.5px; color: var(--muted); margin-top: 2px; }
/* usage count — a pill on the widget's NAME */
.use-badge { flex: none; min-width: 18px; height: 18px; padding: 0 5px; display: inline-grid; place-items: center;
  background: var(--primary-soft); color: var(--primary-700); border-radius: 999px;
  font-size: 10.5px; font-weight: 700; line-height: 1; cursor: pointer; }
.use-badge:hover, .use-badge.on { background: var(--primary); color: #fff; }

.usage-pop { position: fixed; z-index: 160; width: 250px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--sh-pop); padding: 8px; }
.up-h { font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted-2); font-weight: 700; padding: 2px 6px 6px; }
.up-row { display: flex; align-items: center; gap: 7px; width: 100%; padding: 6px; border: none; background: transparent; border-radius: 7px; font-size: 12.5px; color: var(--ink-2); text-align: left; cursor: pointer; }
.up-row:hover { background: var(--primary-softer); color: var(--primary-700); }
.up-ic { color: var(--muted-2); flex: none; }
.up-row:hover .up-ic { color: var(--primary); }
.up-row .ellip { flex: 1; min-width: 0; }
.up-rm { width: 24px; height: 24px; color: var(--muted-2); border-radius: 6px; display: grid; place-items: center; flex: none; }
.up-rm:hover { color: var(--red); background: var(--red-soft); }
.up-f { margin: 6px 0 0; padding-top: 6px; border-top: 1px solid var(--border); font-size: 10.5px; line-height: 1.4; color: var(--muted); }
/* left-pointing description tooltip (teleported, fixed to viewport) */
.lib-tip { position: fixed; z-index: 200; transform: translateY(-50%); width: 232px; background: #20223a; color: #fff; font-size: 11.5px; line-height: 1.45; padding: 8px 11px; border-radius: 8px; box-shadow: var(--sh-pop); pointer-events: none; text-align: left; }
.lib-tip-arrow { position: absolute; left: 100%; top: 50%; transform: translateY(-50%); border: 6px solid transparent; border-left-color: #20223a; }
/* hover actions (Duplicate / Edit / Delete) — revealed on row hover */
.lt-acts { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .12s; }
.lrow:hover .lt-acts { opacity: 1; }
.lt-acts.always { opacity: 1; }
.trash-ic { width: 16px; display: inline-grid; place-items: center; color: var(--muted-2); flex: none; }
.la { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.la:hover { background: var(--surface); color: var(--ink); }
.la.del:hover { color: var(--red); background: var(--red-soft); }
/* delete confirmation modal */
.cf-overlay { position: fixed; inset: 0; background: rgba(20,21,38,.5); backdrop-filter: blur(2px); z-index: 130; display: grid; place-items: center; padding: 24px; }
.cf { width: min(400px, 92vw); background: var(--surface); border-radius: var(--r-xl); box-shadow: var(--sh-lg); padding: 24px; text-align: center; }
.cf-ico { width: 48px; height: 48px; border-radius: 50%; background: var(--red-soft); color: var(--red); display: grid; place-items: center; margin: 0 auto 14px; }
.cf h4 { margin: 0 0 6px; font-size: 16px; }
.cf p { margin: 0 0 18px; font-size: 13px; color: var(--muted); line-height: 1.5; }
.cf-btns { display: flex; justify-content: center; gap: 10px; }
.cf-del { background: var(--red); border-color: var(--red); color: #fff; }
.cf-del:hover { background: #c73f34; border-color: #c73f34; }
/* multi-select footer */
.aw-foot { display: flex; align-items: center; justify-content: space-between; padding: 12px 22px; border-top: 1px solid var(--border); background: var(--surface-2); flex: none; }
.selinfo { font-size: 12.5px; font-weight: 500; color: var(--muted); }
.fbtns { display: flex; gap: 10px; }
.slideup-enter-active, .slideup-leave-active { transition: transform .2s ease, opacity .2s ease; }
.slideup-enter-from, .slideup-leave-to { transform: translateY(100%); opacity: 0; }
.none { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--muted-2); padding: 54px 20px; text-align: center; }
.none-t { margin: 4px 0 0; font-size: 14px; font-weight: 600; color: var(--ink-2); }
.none-h { font-size: 12.5px; color: var(--muted); max-width: 300px; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
