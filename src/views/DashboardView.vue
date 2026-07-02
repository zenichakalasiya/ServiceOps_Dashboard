<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/ui/Icon.vue'
import WidgetCard from '../components/dashboard/WidgetCard.vue'
import TimeFilter from '../components/dashboard/TimeFilter.vue'
import AutoRefresh from '../components/dashboard/AutoRefresh.vue'
import DashboardMenu from '../components/dashboard/DashboardMenu.vue'
import AddWidgetModal from '../components/dashboard/AddWidgetModal.vue'
import WidgetBuilderModal from '../components/dashboard/WidgetBuilderModal.vue'
import ShareDialog from '../components/dashboard/ShareDialog.vue'
import ScheduleDialog from '../components/dashboard/ScheduleDialog.vue'
import { store, byId, recordView, toggleFavorite, removeTile, toast, seedTemplate, TEMPLATES } from '../store/index.js'
import { ACCESS, uid } from '../data/mock.js'
const route = useRoute()
const router = useRouter()

const d = computed(() => byId(route.params.id))
const edit = ref(route.query.edit === '1')
const dirty = ref(false)
const showAdd = ref(false)
const showShare = ref(false)
const showSchedule = ref(false)
const accessOpen = ref(false)
const loadingBoard = ref(true)
const highlightId = ref(null)
const editTile = ref(null)   // tile currently open in the builder (edit mode)
const gridEl = ref(null)

// ---- drag-to-reorder (armed from each card's 6-dot handle) ----
const dragArmed = ref(null)
const dragFrom = ref(null)
const dragOver = ref(null)
function armDrag(i) { dragArmed.value = i; window.addEventListener('mouseup', disarmOnce, { once: true }) }
function disarmOnce() { if (dragFrom.value == null) dragArmed.value = null }
function onDragStart(i) { dragFrom.value = i }
function onDragOver(i) { dragOver.value = i }
function onDragEnd() { dragArmed.value = null; dragFrom.value = null; dragOver.value = null }
function onDrop(i) {
  const from = dragFrom.value
  if (from == null || from === i) return
  const arr = d.value.tiles
  const [moved] = arr.splice(from, 1)
  arr.splice(i, 0, moved)
  d.value.updated = new Date().toISOString(); dirty.value = true
}

// ---- per-tile size (default span/height) + drag-to-resize from bottom-right ----
function cellStyle(t) {
  const w = Math.min(12, Math.max(2, t.w || 3))
  const h = Math.max(1, t.h || 1)
  return { gridColumn: `span ${w}`, minHeight: (140 + (h - 1) * 110) + 'px' }
}
let resizeCtx = null
function startResize(e, t) {
  const grid = gridEl.value; if (!grid) return
  const gap = 14, col = (grid.getBoundingClientRect().width - gap * 11) / 12
  resizeCtx = { t, startX: e.clientX, startY: e.clientY, w0: t.w || 3, h0: t.h || 1, col, gap }
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeUp)
}
function onResizeMove(e) {
  if (!resizeCtx) return
  const { t, startX, startY, w0, h0, col, gap } = resizeCtx
  t.w = Math.min(12, Math.max(2, w0 + Math.round((e.clientX - startX) / (col + gap))))
  t.h = Math.min(4, Math.max(1, h0 + Math.round((e.clientY - startY) / 110)))
}
function onResizeUp() {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeUp)
  if (resizeCtx) { d.value.updated = new Date().toISOString(); dirty.value = true; resizeCtx = null }
}

// derive the builder's `type` descriptor from an existing tile
function typeForTile(t) {
  if (t.type === 'kpi') return { id: 'kpi', label: 'KPI', type: 'kpi', kind: null }
  if (t.type === 'shortcut') return { id: 'shortcut', label: 'Shortcut', type: 'shortcut', kind: null }
  const kind = t.chart?.kind || 'bar'
  const label = kind === 'line' ? 'Line' : kind === 'donut' ? 'Pie' : 'Bar'
  return { id: kind, label, type: 'chart', kind }
}

// After a widget is created, smooth-scroll to it (it's appended last) + briefly highlight.
function onWidgetCreated(id) {
  showAdd.value = false
  nextTick(() => {
    const el = document.querySelector(`[data-tile="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightId.value = id
    setTimeout(() => { if (highlightId.value === id) highlightId.value = null }, 1800)
  })
}

onMounted(() => { recordView(d.value); setTimeout(() => (loadingBoard.value = false), 550) })

function onRemove(t) { removeTile(d.value, t); dirty.value = true }
// Open the builder pre-filled with this tile, in edit mode (with live preview).
function onEditTile(t) { editTile.value = t }
function onTileSaved(id) {
  editTile.value = null
  toast('Widget updated', 'success')
  nextTick(() => { highlightId.value = id; setTimeout(() => { if (highlightId.value === id) highlightId.value = null }, 1500) })
}
// Duplicate a tile in place (inserted right after the original).
function onDuplicate(t) {
  const copy = JSON.parse(JSON.stringify(t)); copy.id = uid('t')
  const i = d.value.tiles.findIndex((x) => x.id === t.id)
  d.value.tiles.splice(i + 1, 0, copy)
  d.value.updated = new Date().toISOString()
  dirty.value = true
  toast(`Duplicated “${t.title}”`)
}
function saveEdit() { dirty.value = false; edit.value = false; toast('Layout saved', 'success') }
function discard() { if (dirty.value && !confirm('Discard unsaved changes?')) return; dirty.value = false; edit.value = false }
</script>

<template>
  <div v-if="d" class="board">
    <!-- Header -->
    <header class="bhead">
      <div class="bh-left">
        <button class="star" :class="{ on: d.favorite }" @click="toggleFavorite(d)"><Icon :name="d.favorite ? 'star-fill' : 'star'" :size="17" /></button>
        <div class="titles">
          <div class="t-row">
            <h1>{{ d.name }}</h1>
            <span v-if="d.predefined" class="chip badge-pre">Predefined</span>
            <div class="acc-wrap">
              <button class="acc-btn" :class="'acc-' + d.access" @click.stop="accessOpen = !accessOpen" title="Who can access this dashboard">
                {{ ACCESS[d.access].label }} <Icon name="chevron-down" :size="11" class="acc-chev" />
              </button>
              <div v-if="accessOpen" class="backdrop" @click="accessOpen = false" />
              <transition name="pop">
                <div v-if="accessOpen" class="acc-pop card" @click.stop>
                  <div class="ap-h"><Icon :name="ACCESS[d.access].icon" :size="14" /> {{ ACCESS[d.access].label }} — who can access</div>
                  <!-- Technician / group access levels apply only to Restricted dashboards -->
                  <template v-if="d.access === 'restricted'">
                    <div class="ap-sec">
                      <label>Technician Access Level</label>
                      <div class="ap-chips"><span v-for="t in d.techAccess" :key="t" class="chip sm"><Icon name="user" :size="11" /> {{ t }}</span><span v-if="!d.techAccess.length" class="muted small">None</span></div>
                    </div>
                    <div class="ap-sec">
                      <label>Technician Group Access Level</label>
                      <div class="ap-chips"><span v-for="g in d.groupAccess" :key="g" class="chip sm"><Icon name="users" :size="11" /> {{ g }}</span><span v-if="!d.groupAccess.length" class="muted small">None</span></div>
                    </div>
                  </template>
                  <p v-else class="ap-desc">{{ d.access === 'public' ? 'Everyone with portal access can open this dashboard.' : `Private — only ${d.owner} can open this dashboard.` }}</p>
                  <button class="ap-edit" @click="accessOpen = false; showShare = true"><Icon name="edit" :size="13" /> Manage access &amp; sharing</button>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </div>
      <div class="bh-right">
        <TimeFilter />
        <AutoRefresh />
        <span class="vsep" />
        <button v-if="!edit" class="btn" @click="edit = true"><Icon name="edit" :size="16" /> Edit</button>
        <button class="btn" @click="showSchedule = true"><Icon name="calendar2" :size="16" /> Schedule</button>
        <button class="btn" @click="showShare = true"><Icon name="share" :size="16" /> Share</button>
        <DashboardMenu :d="d" align="right" @share="showShare = true" @open="() => {}" />
      </div>
    </header>

    <!-- Edit banner (unsaved-changes guard, P2·4) -->
    <transition name="fade">
      <div v-if="edit" class="editbar">
        <Icon name="edit" :size="15" /> <b>Editing</b> — drag, add or remove tiles.
        <span v-if="dirty" class="unsaved">● Unsaved changes</span>
        <div class="grow" />
        <button class="btn btn-sm" @click="discard">Discard</button>
        <button class="btn btn-sm btn-primary" @click="saveEdit"><Icon name="check" :size="14" /> Save</button>
      </div>
    </transition>

    <!-- Body -->
    <div class="bbody">
      <!-- loading skeleton (P2·9) -->
      <div v-if="loadingBoard" class="grid">
        <div v-for="n in 6" :key="n" class="card sk" :class="n <= 4 ? 'span-3' : 'span-6'"><div class="skeleton" style="height:100%" /></div>
      </div>

      <!-- empty state → template gallery (P2·9, P3·tour, ClickUp pattern) -->
      <div v-else-if="!d.tiles.length" class="empty">
        <div class="empty-ill"><Icon name="template" :size="30" /></div>
        <h3>Start your dashboard</h3>
        <p>Pick a starter template, or build it yourself with Add Widget.</p>
        <div class="tpl-grid">
          <button v-for="t in TEMPLATES" :key="t.key" class="tpl card" @click="t.key === 'blank' ? showAdd = true : seedTemplate(d, t.key)">
            <span class="tpl-ico" :style="{ background: t.color + '1f', color: t.color }"><Icon :name="t.icon" :size="20" /></span>
            <div class="tpl-body"><b>{{ t.name }}</b><span class="muted">{{ t.desc }}</span></div>
          </button>
        </div>
      </div>

      <!-- tiles -->
      <div v-else class="grid" ref="gridEl">
        <div v-for="(t, i) in d.tiles" :key="t.id" :data-tile="t.id" class="cell"
          :class="{ flash: highlightId === t.id, dragging: dragFrom === i, dropzone: dragOver === i && dragFrom !== i }"
          :style="cellStyle(t)" :draggable="dragArmed === i"
          @dragstart="onDragStart(i)" @dragend="onDragEnd" @dragover.prevent="onDragOver(i)" @drop="onDrop(i)">
          <WidgetCard :tile="t" :edit="edit" @remove="onRemove" @edit="onEditTile" @duplicate="onDuplicate" @armdrag="() => armDrag(i)" />
          <span class="resize" title="Drag to resize" @mousedown.stop.prevent="startResize($event, t)" />
        </div>
      </div>
    </div>

    <!-- Floating Add-Widget FAB (bottom-right) -->
    <button class="fab" @click="showAdd = true" title="Add widget"><Icon name="plus" :size="26" /></button>

    <AddWidgetModal v-if="showAdd" :d="d" @close="showAdd = false" @created="onWidgetCreated" />
    <WidgetBuilderModal v-if="editTile" :d="d" :type="typeForTile(editTile)" :existing="editTile" @close="editTile = null" @saved="onTileSaved" />
    <ShareDialog v-if="showShare" :d="d" @close="showShare = false" />
    <ScheduleDialog v-if="showSchedule" :d="d" @close="showSchedule = false" />
  </div>

  <div v-else class="missing">
    <Icon name="search" :size="28" class="muted" />
    <p>Dashboard not found.</p>
    <button class="btn" @click="router.push('/dashboards')">Back to Discover</button>
  </div>
</template>

<style scoped>
.board { display: flex; flex-direction: column; min-height: 100%; }
.bhead { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 24px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: nowrap; }
.bh-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.star { width: 34px; height: 34px; border-radius: 9px; border: none; background: transparent; color: var(--muted); display: grid; place-items: center; }
.star:hover, .star.on { color: #f5a623; }
.titles { min-width: 0; }
.t-row { display: flex; align-items: center; gap: 9px; }
.t-row h1 { margin: 0; font-size: 19px; letter-spacing: -.3px; }
.acc-wrap { position: relative; }
/* access control — outlined button (distinct from the flat filled Predefined tag) */
.acc-btn { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px 0 9px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); border-radius: 7px; font-size: 12px; font-weight: 500; cursor: pointer; }
.acc-btn:hover { background: var(--surface-2); border-color: #c7cad9; }
.acc-chev { color: var(--muted-2); }
.backdrop { position: fixed; inset: 0; z-index: 55; }
.acc-pop { position: absolute; top: 30px; left: 0; z-index: 60; width: 300px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.ap-h { display: flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13px; }
.ap-sec label { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted-2); font-weight: 600; margin-bottom: 7px; }
.ap-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ap-chips .chip.sm { height: 22px; font-size: 11.5px; padding: 0 8px; }
.small { font-size: 12px; }
.ap-desc { margin: 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.5; }
.ap-edit { display: flex; align-items: center; gap: 7px; justify-content: center; border: 1px solid var(--border-strong); background: var(--surface); border-radius: 8px; padding: 7px; font-weight: 500; font-size: 12.5px; color: var(--ink-2); }
.ap-edit:hover { background: var(--surface-2); }
.bh-right { display: flex; align-items: center; gap: 8px; flex: none; }
.titles { min-width: 0; }
.t-row h1 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 360px; }
.vsep { width: 1px; height: 24px; background: var(--border); margin: 0 2px; }
.editbar { display: flex; align-items: center; gap: 9px; padding: 9px 24px; background: var(--primary-softer); border-bottom: 1px solid var(--primary-soft); color: var(--primary-700); font-size: 13px; }
.unsaved { color: var(--amber); font-weight: 600; font-size: 12px; }
.bbody { flex: 1; padding: 18px 24px 28px; }
.grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 14px; align-items: start; }
.cell { position: relative; border-radius: var(--r-lg); display: flex; flex-direction: column; }
/* minimal highlight on a just-added widget */
.cell.flash { animation: flash 1.8s ease-out; }
.cell.flash :deep(.tile) { border-color: var(--primary); }
@keyframes flash {
  0% { box-shadow: 0 0 0 3px var(--primary-soft), 0 0 0 1px var(--primary); }
  60% { box-shadow: 0 0 0 3px var(--primary-soft), 0 0 0 1px var(--primary); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.span-3 { grid-column: span 3; } .span-6 { grid-column: span 6; } .span-4 { grid-column: span 4; } .span-12 { grid-column: span 12; }
.cell > :deep(.tile) { flex: 1; min-height: 0; }
.sk { min-height: 140px; padding: 10px; } .sk.span-6 { min-height: 248px; }
/* drag-reorder states */
.cell.dragging { opacity: .4; }
.cell.dropzone { outline: 2px dashed var(--primary); outline-offset: 2px; border-radius: var(--r-lg); }
/* bottom-right resize grip (diagonal lines), on hover */
.resize { position: absolute; right: 4px; bottom: 4px; width: 15px; height: 15px; z-index: 6; cursor: nwse-resize; opacity: 0; transition: opacity .14s;
  background: linear-gradient(135deg, transparent 0 54%, var(--muted-2) 54% 61%, transparent 61% 73%, var(--muted-2) 73% 80%, transparent 80%); }
.cell:hover .resize { opacity: 1; }
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 70px 20px; text-align: center; }
.empty-ill { width: 70px; height: 70px; border-radius: 18px; background: var(--primary-soft); color: var(--primary); display: grid; place-items: center; margin-bottom: 6px; }
.empty h3 { margin: 0; font-size: 17px; } .empty p { margin: 0 0 8px; color: var(--muted); }
.tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; max-width: 740px; margin-top: 10px; text-align: left; }
.tpl { display: flex; align-items: center; gap: 12px; padding: 14px; border: none; background: var(--surface); cursor: pointer; transition: box-shadow .15s, transform .1s; }
.tpl:hover { box-shadow: var(--sh); transform: translateY(-2px); }
.tpl-ico { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; flex: none; }
.tpl-body { display: flex; flex-direction: column; min-width: 0; }
.tpl-body b { font-size: 14px; } .tpl-body span { font-size: 12px; }
.missing { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 90px; color: var(--muted); }
.fab { position: fixed; right: 26px; bottom: 26px; z-index: 40; width: 56px; height: 56px; border-radius: 50%; border: none; background: var(--primary); color: #fff; display: grid; place-items: center; box-shadow: 0 8px 22px rgba(61,139,208,.42); transition: transform .12s, box-shadow .15s, background .15s; }
.fab:hover { background: var(--primary-600); transform: translateY(-2px) scale(1.04); box-shadow: 0 12px 28px rgba(61,139,208,.5); }
.fab:active { transform: translateY(0) scale(.98); }
@media (max-width: 1100px) { .span-3 { grid-column: span 6; } .span-6 { grid-column: span 12; } }
</style>
