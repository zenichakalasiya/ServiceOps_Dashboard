<script setup>
import { ref, computed, watch } from 'vue'
import Icon from '../ui/Icon.vue'
import Dropdown from '../ui/Dropdown.vue'
import WidgetBuilderModal from './WidgetBuilderModal.vue'
import { store, addTilesToDashboard, deleteLibTile, toast } from '../../store/index.js'
import { uid } from '../../data/mock.js'
const props = defineProps({ d: Object, group: { type: String, default: null } })
const emit = defineEmits(['close', 'created'])
function tagGroup(id) { if (props.group && id != null) { const t = props.d.tiles.find((x) => x.id === id); if (t) t.group = props.group } }

const tab = ref('chart')              // chart | predefined | user | shared
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
const moduleOptions = computed(() => [{ value: '', label: 'All modules' }, ...store.modules.map((m) => ({ value: m, label: m }))])
const list = computed(() => {
  let arr = store.library.filter((l) => l.prov === provMap[tab.value])
  if (fType.value) arr = arr.filter((l) => l.type === fType.value)
  if (fModule.value) arr = arr.filter((l) => l.module === fModule.value)
  if (search.value.trim()) arr = arr.filter((l) => l.title.toLowerCase().includes(search.value.trim().toLowerCase()))
  return arr
})
// per-type counts for the current tab (before the type filter is applied)
const typeCounts = computed(() => {
  const base = store.library.filter((l) => l.prov === provMap[tab.value] && (!fModule.value || l.module === fModule.value))
  return { '': base.length, kpi: base.filter((l) => l.type === 'kpi').length, chart: base.filter((l) => l.type === 'chart').length, shortcut: base.filter((l) => l.type === 'shortcut').length }
})
// ---- multi-select: add is ONLY via checkbox + footer (no per-row quick add) ----
const MAX_SEL = 10
const selected = ref(new Set())
function isSel(l) { return selected.value.has(l.id) }
function toggleSel(l) {
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

// ---- Delete → centered confirm ----
const delTarget = ref(null)
function delLib(l) { delTarget.value = l }
function confirmDel() { deleteLibTile(delTarget.value); delTarget.value = null }

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
const TAB_LABEL = { predefined: 'Predefined', user: 'User Defined', shared: 'Shared with me' }
const emptyMsg = computed(() => {
  const plural = fType.value ? (fType.value === 'kpi' ? 'KPIs' : TYPE_LABEL[fType.value] + 's') : 'items'
  return `No ${plural} in ${TAB_LABEL[tab.value] || 'this tab'} yet.`
})
const emptyHelp = computed(() => {
  if (tab.value === 'shared') return 'Widgets, KPIs and Shortcuts shared with you will appear here.'
  if (tab.value === 'user') return 'Create one from the Chart type tab, then it appears here.'
  return 'Predefined tiles curated by your admin will appear here.'
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
        <button class="awt" :class="{ on: tab === 'predefined' }" @click="tab = 'predefined'">Predefined</button>
        <button class="awt" :class="{ on: tab === 'user' }" @click="tab = 'user'">User Defined</button>
        <button class="awt" :class="{ on: tab === 'shared' }" @click="tab = 'shared'">Shared with me</button>
      </div>

      <!-- module filter + search (every tab) -->
      <div class="aw-filters">
        <div class="srch"><Icon name="search" :size="15" class="muted" /><input v-model="search" placeholder="Search…" /></div>
        <div v-if="tab !== 'chart' && fType !== 'shortcut'" class="modsel"><Dropdown v-model="fModule" :options="moduleOptions" placeholder="All modules" /></div>
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
          <div v-if="!filteredGroups.length" class="none">No types match “{{ search }}”.</div>
        </template>

        <!-- REUSE TABS: listing with actions -->
        <template v-else>
          <div v-if="list.length" class="lst">
            <div v-for="l in list" :key="l.id" class="lrow" :class="{ sel: isSel(l) }">
              <input type="checkbox" class="lcb" :checked="isSel(l)" @change="toggleSel(l)" />
              <div class="lt-main">
                <div class="lt-name-row"><span class="lt-name ellip">{{ l.title }}</span></div>
                <div class="lt-meta">{{ TYPE_LABEL[l.type] }} · {{ l.module }}</div>
              </div>
              <!-- actions per tab/type (see canDuplicate / canEdit / canDelete) -->
              <div v-if="hasActions(l)" class="lt-acts">
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

    <!-- Delete confirmation -->
    <teleport to="body">
      <div v-if="delTarget" class="cf-overlay" @click.self="delTarget = null">
        <div class="cf">
          <div class="cf-ico"><Icon name="trash" :size="22" /></div>
          <h4>Delete “{{ delTarget.title }}”?</h4>
          <p>This removes it from the library. This action can’t be undone.</p>
          <div class="cf-btns">
            <button class="btn" @click="delTarget = null">Cancel</button>
            <button class="btn cf-del" @click="confirmDel"><Icon name="trash" :size="15" /> Delete</button>
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
.awt { border: none; background: transparent; padding: 10px 4px; margin-right: 14px; font-weight: 500; font-size: 13.5px; color: var(--muted); border-bottom: 2px solid transparent; }
.awt:hover { color: var(--ink); }
.awt.on { color: var(--primary-700); border-bottom-color: var(--primary); }
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
.tc-ico { width: 60px; height: 60px; display: grid; place-items: center; }
.tc-ico.rot90 { transform: rotate(90deg); }
.tc-label { font-size: 13px; font-weight: 500; }
.lst { display: flex; flex-direction: column; gap: 2px; }
.lrow { display: flex; align-items: center; gap: 12px; padding: 10px 10px; border-radius: 10px; }
.lrow:hover { background: var(--surface-2); }
.lrow.sel { background: var(--primary-softer); }
.lcb { width: 16px; height: 16px; accent-color: var(--primary); flex: none; cursor: pointer; margin: 0; }
.lt-main { flex: 1; min-width: 0; }
.lt-name-row { display: flex; align-items: center; gap: 7px; } .lt-name { font-weight: 500; font-size: 13.5px; }
.lt-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
/* hover actions (Duplicate / Edit / Delete) — revealed on row hover */
.lt-acts { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .12s; }
.lrow:hover .lt-acts { opacity: 1; }
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
