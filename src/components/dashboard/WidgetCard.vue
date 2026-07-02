<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import Icon from '../ui/Icon.vue'
import MiniChart from './MiniChart.vue'
import { toast } from '../../store/index.js'
const props = defineProps({ tile: Object, edit: Boolean })
const emit = defineEmits(['remove', 'edit', 'duplicate', 'armdrag'])

const loading = ref(false)
const menu = ref(false)
const menuBtn = ref(null)
const menuPos = ref({ top: 0, left: 0 })
function toggleMenu() {
  if (menu.value) { menu.value = false; exportOpen.value = false; return }
  const r = menuBtn.value?.getBoundingClientRect()
  if (r) menuPos.value = { top: r.bottom + 6, left: Math.max(8, r.right - 190) }
  menu.value = true
}
const exportOpen = ref(false)
const showLegend = ref(true)
const EXPORTS = ['PDF', 'PNG', 'JPEG', 'SVG', 'CSV']
const searchOpen = ref(false)
const tableSearch = ref('')
const searchInput = ref(null)
watch(searchOpen, (v) => { if (v) nextTick(() => searchInput.value?.focus()) })
const filteredRows = computed(() => {
  const rows = props.tile.rows || []
  const q = tableSearch.value.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((r) => r.some((cell) => String(cell).toLowerCase().includes(q)))
})
const present = ref(false)
const infoHover = ref(false)
function refresh() { loading.value = true; setTimeout(() => { loading.value = false }, 750) }

function download(fmt) { menu.value = false; exportOpen.value = false; toast(`Exporting “${props.tile.title}” as ${fmt}`) }
function duplicate() { menu.value = false; emit('duplicate', props.tile) }
</script>

<template>
  <div class="tile card" :class="{ ['span-' + (tile.w || 3)]: true, ['rows-' + (tile.h || 1)]: true, searching: searchOpen }">
    <!-- Standardized header: title + info (left) · refresh · fullscreen · edit · ⋯ (right) -->
    <header class="thead">
      <div class="left">
        <span class="draghandle" title="Drag to move" @mousedown="emit('armdrag', tile)"><Icon name="drag" :size="16" /></span>
        <span class="title ellip">{{ tile.title }}</span>
        <span class="info" @mouseenter="infoHover = true" @mouseleave="infoHover = false">
          <Icon name="info" :size="14" />
          <transition name="fade"><span v-if="infoHover && tile.info" class="tt info-tt">{{ tile.info }}</span></transition>
        </span>
      </div>
      <div class="right">
        <button v-if="tile.type === 'shortcut'" class="ti" :class="{ on: searchOpen }" @click="searchOpen = !searchOpen" title="Search records"><Icon name="search" :size="15" /></button>
        <button class="ti" @click="refresh" title="Refresh"><Icon name="refresh" :size="15" :class="{ spin: loading }" /></button>
        <button class="ti" @click="present = true" title="Full screen"><Icon name="maximize-tile" :size="15" /></button>
        <button class="ti" @click="emit('edit', tile)" title="Edit"><Icon name="edit" :size="15" /></button>
        <div class="mwrap">
          <button ref="menuBtn" class="ti" @click.stop="toggleMenu" title="More"><Icon name="dots-v" :size="15" /></button>
        </div>
      </div>
    </header>

    <!-- ⋯ menu: teleported so it overlays the card instead of being clipped by overflow -->
    <teleport to="body">
      <div v-if="menu" class="backdrop" @click="menu = false; exportOpen = false" />
      <transition name="pop">
        <div v-if="menu" class="menu tile-menu" :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }" @click.stop>
          <button class="menu-item" @click="duplicate"><Icon name="copy" :size="15" /> Duplicate</button>
          <button v-if="tile.type === 'chart'" class="menu-item" @click="showLegend = !showLegend"><Icon name="list" :size="15" /> {{ showLegend ? 'Hide legend' : 'Show legend' }}</button>
          <!-- Export → submenu (PDF / PNG / JPEG / SVG / CSV) -->
          <div class="menu-item sub" @mouseenter="exportOpen = true" @mouseleave="exportOpen = false">
            <span class="mi-l"><Icon name="share" :size="15" /> Export</span><Icon name="chevron-right" :size="14" class="mi-c" />
            <transition name="pop"><div v-if="exportOpen" class="submenu">
              <button v-for="f in EXPORTS" :key="f" class="menu-item" @click="download(f)">{{ f }}</button>
            </div></transition>
          </div>
          <div class="menu-sep" />
          <button class="menu-item danger" @click="menu = false; emit('remove', tile)"><Icon name="trash" :size="15" /> Delete card</button>
        </div>
      </transition>
    </teleport>

    <!-- Body -->
    <div class="tbody">
      <div v-if="loading" class="loading">
        <div class="skeleton" style="height:60%;width:80%" />
        <div class="skeleton" style="height:14px;width:50%;margin-top:10px" />
      </div>

      <template v-else-if="tile.type === 'kpi'">
        <div class="kpi">
          <div class="kpinum">{{ tile.value }}<span v-if="tile.unit" class="unit">{{ tile.unit }}</span></div>
        </div>
      </template>

      <template v-else-if="tile.type === 'chart'">
        <MiniChart v-if="tile.chart" :chart="tile.chart" :legend="showLegend" :height="tile.h > 1 ? 170 : 120" />
      </template>

      <template v-else>
        <div class="stbl">
          <!-- search bar (toggled from the header search icon, beside Refresh) -->
          <transition name="fade">
            <div v-if="searchOpen" class="stbl-bar">
              <div class="sbox">
                <Icon name="search" :size="14" class="muted" />
                <input v-model="tableSearch" placeholder="Search records…" ref="searchInput" />
                <button class="sx" title="Close" @click="searchOpen = false; tableSearch = ''"><Icon name="x" :size="14" /></button>
              </div>
            </div>
          </transition>
          <!-- scrollable table container (sticky header) -->
          <div class="stbl-scroll">
            <table>
              <thead><tr><th v-for="c in tile.columns" :key="c">{{ c }}</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in filteredRows" :key="i"><td v-for="(cell, j) in r" :key="j">{{ cell }}</td></tr>
                <tr v-if="!filteredRows.length"><td :colspan="tile.columns.length" class="nodata">{{ tableSearch ? 'No records match your search' : 'No records in this range' }}</td></tr>
              </tbody>
            </table>
          </div>
          <a class="viewall">View all <Icon name="chevron-right" :size="13" /></a>
        </div>
      </template>
    </div>

    <!-- Present mode (single tile) -->
    <teleport to="body">
      <div v-if="present" class="overlay" @click.self="present = false">
        <div class="present">
          <div class="phead"><b>{{ tile.title }}</b><button class="btn btn-icon" @click="present = false"><Icon name="x" :size="18" /></button></div>
          <div class="pbody">
            <MiniChart v-if="tile.type === 'chart'" :chart="tile.chart" :legend="showLegend" :height="420" />
            <div v-else-if="tile.type === 'kpi'" class="kpi big"><div class="kpinum">{{ tile.value }}<span class="unit">{{ tile.unit }}</span></div></div>
            <div v-else class="stbl big"><table><thead><tr><th v-for="c in tile.columns" :key="c">{{ c }}</th></tr></thead><tbody><tr v-for="(r,i) in tile.rows" :key="i"><td v-for="(c,j) in r" :key="j">{{ c }}</td></tr></tbody></table></div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.tile { display: flex; flex-direction: column; overflow: hidden; min-height: 130px; }
.thead { display: flex; align-items: center; justify-content: space-between; padding: 10px 8px 2px 14px; gap: 8px; }
.left { display: flex; align-items: center; gap: 6px; min-width: 0; }
/* 6-dot drag handle — appears on hover, before the title */
.draghandle { display: inline-grid; place-items: center; color: var(--muted-2); cursor: grab; opacity: 0; transition: opacity .14s; flex: none; margin-left: -4px; }
.draghandle:active { cursor: grabbing; }
.tile:hover .draghandle { opacity: 1; }
.title { font-weight: 600; font-size: 13.5px; }
.info { position: relative; color: var(--muted-2); display: inline-grid; place-items: center; cursor: help; }
.info:hover { color: var(--primary); }
.info-tt { top: 22px; left: -6px; width: 240px; }
.right { display: flex; align-items: center; gap: 1px; opacity: 0; transition: opacity .14s; }
.tile:hover .right, .tile.searching .right { opacity: 1; }
.ti { width: 28px; height: 28px; border-radius: 7px; border: none; background: transparent; color: var(--muted); display: grid; place-items: center; }
.ti:hover { background: var(--surface-2); color: var(--ink); }
.ti.on { background: var(--primary-soft); color: var(--primary-700); }
.spin { animation: sp 0.75s linear infinite; } @keyframes sp { to { transform: rotate(360deg); } }
.mwrap { position: relative; }
.backdrop { position: fixed; inset: 0; z-index: 130; }
/* teleported menu — fixed to viewport, above the card so it is never clipped */
.tile-menu { position: fixed; z-index: 140; min-width: 190px; }
.menu-item.sub { justify-content: space-between; position: relative; }
.mi-l { display: flex; align-items: center; gap: 10px; }
.mi-c { color: var(--muted); }
.submenu { position: absolute; top: -7px; right: 100%; min-width: 124px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh-pop); padding: 6px; }
.tbody { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; min-height: 0; }
.loading { flex: 1; display: flex; flex-direction: column; justify-content: center; }
/* full-area hover: the whole numeric region (below the title) fills on hover,
   with generous padding so the highlight surrounds the number on every side */
.kpi { display: flex; flex-direction: column; justify-content: center; align-items: center; flex: 1; text-align: center; padding: 18px 16px; border-radius: 12px; background: transparent; transition: background .15s; }
.tile:hover .kpi { background: var(--surface-2); }
.kpinum { font-size: 46px; font-weight: 500; letter-spacing: -1px; line-height: 1; }
.kpinum .unit { font-size: 20px; font-weight: 600; color: var(--muted); margin-left: 3px; }
.stbl { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.stbl-bar { margin-bottom: 6px; }
.sbox { display: flex; align-items: center; gap: 7px; width: 100%; height: 30px; border: 1px solid var(--border-strong); border-radius: 8px; padding: 0 8px; background: var(--surface); }
.sbox:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.sbox input { border: none; outline: none; background: transparent; width: 100%; font-size: 12.5px; }
.sx { border: none; background: transparent; color: var(--muted); cursor: pointer; display: grid; place-items: center; padding: 0; }
.sx:hover { color: var(--ink); }
.stbl-scroll { flex: 1; overflow: auto; min-height: 0; max-height: 200px; }
.stbl-scroll thead th { position: sticky; top: 0; z-index: 1; background: var(--surface); }
table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
th { text-align: left; color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; padding: 4px 8px; border-bottom: 1px solid var(--border); }
td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
.nodata { text-align: center; color: var(--muted-2); padding: 18px; }
.viewall { display: inline-flex; align-items: center; gap: 3px; margin-top: 6px; color: var(--primary-700); font-weight: 600; font-size: 12px; cursor: pointer; }
.present { background: #fff; border-radius: var(--r-xl); width: min(880px, 92vw); box-shadow: var(--sh-lg); overflow: hidden; }
.phead { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); font-size: 15px; }
.pbody { padding: 24px; }
.kpi.big .kpinum { font-size: 88px; } .stbl.big table { font-size: 14px; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
