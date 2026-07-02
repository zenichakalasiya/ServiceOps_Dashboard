<script setup>
import { useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import DashboardMenu from './DashboardMenu.vue'
import { toggleFavorite, recordView, folderName } from '../../store/index.js'
import { ACCESS } from '../../data/mock.js'
const props = defineProps({ items: Array })
const emit = defineEmits(['share'])
const router = useRouter()
function rel(iso) { if (!iso) return '—'; const d = Math.round((Date.now() - new Date(iso)) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d}d ago` : d < 365 ? `${Math.round(d / 30)}mo ago` : `${Math.round(d / 365)}y ago` }
function open(d) { recordView(d); router.push(`/dashboard/${d.id}`) }
function initials(n) { return n.split(' ').map(s => s[0]).join('').slice(0, 2) }
</script>

<template>
  <div class="card tbl">
    <div class="th">
      <span></span><span>Name</span><span>Location</span><span>Access</span><span>Updated</span><span>Owner</span><span></span>
    </div>
    <div v-for="d in items" :key="d.id" class="tr" @click="open(d)">
      <button class="star" :class="{ on: d.favorite }" @click.stop="toggleFavorite(d)"><Icon :name="d.favorite ? 'star-fill' : 'star'" :size="15" /></button>
      <div class="nm">
        <Icon name="layout" :size="15" class="muted" />
        <span class="ellip">{{ d.name }}</span>
        <span v-if="d.predefined" class="chip badge-pre sm">Predefined</span>
        <span v-if="d.default" class="chip chip-primary sm"><Icon name="pin" :size="10" /></span>
      </div>
      <span class="loc muted">{{ folderName(d.folder) }}</span>
      <span><span class="chip" :class="ACCESS[d.access].chip"><Icon :name="ACCESS[d.access].icon" :size="11" /> {{ ACCESS[d.access].label }}</span></span>
      <span class="muted">{{ rel(d.updated) }}</span>
      <span class="own"><span class="av">{{ initials(d.owner) }}</span> <span class="muted ellip">{{ d.owner }}</span></span>
      <span class="act" @click.stop><DashboardMenu :d="d" @share="emit('share', d)" @open="open(d)" /></span>
    </div>
    <div v-if="!items.length" class="tr empty"><span></span><span class="muted">No dashboards.</span></div>
  </div>
</template>

<style scoped>
.tbl { padding: 4px; overflow: visible; }
.th, .tr { display: grid; grid-template-columns: 34px 2.4fr 1fr 1.1fr .9fr 1.3fr 44px; align-items: center; gap: 10px; padding: 9px 12px; }
.th { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted-2); font-weight: 600; }
.tr { border-top: 1px solid var(--border); font-size: 13px; cursor: pointer; border-radius: 8px; }
.tr:hover { background: var(--surface-2); }
.star { width: 26px; height: 26px; border: none; background: transparent; color: var(--muted-2); border-radius: 6px; display: grid; place-items: center; }
.star:hover, .star.on { color: #f5a623; }
.nm { display: flex; align-items: center; gap: 8px; min-width: 0; font-weight: 500; }
.chip.sm { height: 18px; font-size: 10px; padding: 0 6px; }
.own { display: flex; align-items: center; gap: 7px; min-width: 0; }
.av { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #fff; font-size: 10px; font-weight: 700; display: grid; place-items: center; flex: none; }
.act { display: flex; justify-content: flex-end; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tr.empty { grid-template-columns: 34px 1fr; }
</style>
