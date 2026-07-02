<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import MiniPreview from './MiniPreview.vue'
import DashboardMenu from './DashboardMenu.vue'
import { toggleFavorite, recordView, folderName } from '../../store/index.js'
import { ACCESS } from '../../data/mock.js'
const props = defineProps({ d: Object })
const emit = defineEmits(['share'])
const router = useRouter()
const hov = ref(false)

const counts = computed(() => {
  const c = { kpi: 0, chart: 0, shortcut: 0 }
  props.d.tiles.forEach((t) => c[t.type]++)
  return c
})
const audience = computed(() => {
  if (props.d.access === 'public') return 'Everyone with portal access'
  if (props.d.access === 'private') return `Only ${props.d.owner}`
  return 'Service Desk group · +4 technicians'
})
function rel(iso) {
  if (!iso) return '—'
  const d = Math.round((Date.now() - new Date(iso)) / 864e5)
  if (d <= 0) return 'today'; if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`; if (d < 365) return `${Math.round(d / 30)}mo ago`
  return `${Math.round(d / 365)}y ago`
}
function openIt() { recordView(props.d); router.push(`/dashboard/${props.d.id}`) }
</script>

<template>
  <div class="card dcard" @mouseenter="hov = true" @mouseleave="hov = false">
    <div class="preview" @click="openIt"><MiniPreview :tiles="d.tiles" /></div>

    <div class="top">
      <button class="star" :class="{ on: d.favorite }" @click.stop="toggleFavorite(d)" :title="d.favorite ? 'Unfavorite' : 'Add to favorites'">
        <Icon :name="d.favorite ? 'star-fill' : 'star'" :size="16" />
      </button>
      <DashboardMenu :d="d" @share="emit('share', d)" @open="openIt" />
    </div>

    <div class="body" @click="openIt">
      <div class="name-row">
        <span class="name ellip">{{ d.name }}</span>
        <span v-if="d.predefined" class="chip badge-pre" title="Predefined / system">Predefined</span>
        <span v-if="d.certified" class="chip chip-green" title="Certified official board"><Icon name="check" :size="12" /></span>
      </div>
      <div class="desc">{{ d.description || 'No description' }}</div>
      <div class="meta">
        <span class="chip" :class="ACCESS[d.access].chip"><Icon :name="ACCESS[d.access].icon" :size="12" /> {{ ACCESS[d.access].label }}</span>
        <span v-if="d.category" class="chip">{{ d.category }}</span>
        <span class="dot-sep">·</span>
        <span class="mtxt">{{ d.owner }}</span>
        <span class="dot-sep">·</span>
        <span class="mtxt">{{ rel(d.updated) }}</span>
      </div>
    </div>

    <!-- Rich hover tooltip: contents + access (P4) -->
    <transition name="fade">
      <div v-if="hov" class="tt card-tt">
        <div class="tt-h">{{ d.name }}</div>
        <div class="tt-row"><Icon name="kpi" :size="13" /> {{ counts.kpi }} KPIs · {{ counts.chart }} Widgets · {{ counts.shortcut }} Shortcuts</div>
        <div class="tt-row"><Icon name="folder" :size="13" /> {{ folderName(d.folder) }}<template v-if="d.category"> · {{ d.category }}</template></div>
        <div class="tt-row"><Icon :name="ACCESS[d.access].icon" :size="13" /> {{ audience }}</div>
        <div class="tt-row muted2"><Icon name="user" :size="13" /> {{ d.owner }} · updated {{ rel(d.updated) }}</div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.dcard { position: relative; padding: 10px; transition: box-shadow .15s, transform .1s, border-color .15s; cursor: pointer; }
.dcard:hover { box-shadow: var(--sh); border-color: var(--border-strong); transform: translateY(-2px); }
.preview { border-radius: 10px; overflow: hidden; }
.top { position: absolute; top: 16px; right: 16px; display: flex; gap: 2px; }
.star { width: 30px; height: 30px; border-radius: 8px; border: none; background: rgba(255,255,255,.86); backdrop-filter: blur(3px); color: var(--muted); display: grid; place-items: center; box-shadow: var(--sh-sm); }
.star:hover { color: #f5a623; }
.star.on { color: #f5a623; }
.body { padding: 11px 6px 5px; }
.name-row { display: flex; align-items: center; gap: 7px; }
.name { font-weight: 600; font-size: 14.5px; }
.desc { color: var(--muted); font-size: 12.5px; margin: 3px 0 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.mtxt { font-size: 12px; color: var(--muted); }
.dot-sep { color: var(--muted-2); }
.card-tt { left: 12px; right: 12px; bottom: calc(100% - 4px); display: flex; flex-direction: column; gap: 6px; }
.tt-h { font-weight: 600; color: #fff; margin-bottom: 2px; }
.tt-row { display: flex; align-items: center; gap: 8px; }
.tt-row.muted2 { color: #b9bcd6; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
