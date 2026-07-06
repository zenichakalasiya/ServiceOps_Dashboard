<script setup>
// Full-screen (TV) view of a single dashboard — Esc or ✕ to exit.
import { computed, onMounted, onUnmounted } from 'vue'
import Icon from '../ui/Icon.vue'
import WidgetCard from './WidgetCard.vue'
import { byId } from '../../store/index.js'
const props = defineProps({ startId: String })
const emit = defineEmits(['close'])
const cur = computed(() => byId(props.startId))
function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

const FONT_PX = { S: 12.5, M: 13.5, L: 15 }
const boardVars = computed(() => ({ '--tile-title': (FONT_PX[cur.value?.headerFont] || 13.5) + 'px' }))
const gridStyle = computed(() => ({ columnGap: (cur.value?.hGap ?? 14) + 'px', rowGap: (cur.value?.vGap ?? 14) + 'px' }))
function cellStyle(t) {
  const w = Math.min(12, Math.max(2, t.w || 3)), h = Math.max(1, t.h || 1)
  return { gridColumn: `span ${w}`, minHeight: ((cur.value?.rowHeight ?? 140) + (h - 1) * 110) + 'px' }
}
</script>

<template>
  <teleport to="body">
    <div class="pm" :style="boardVars">
      <header class="pm-bar">
        <div class="pm-title"><Icon name="layout" :size="16" /><b>{{ cur?.name }}</b></div>
        <button class="pm-exit" title="Exit (Esc)" @click="emit('close')"><Icon name="x" :size="20" /></button>
      </header>
      <div class="pm-body">
        <div v-if="cur && cur.tiles.length" class="pm-grid" :style="gridStyle">
          <div v-for="t in cur.tiles" :key="t.id" class="pm-cell" :style="cellStyle(t)"><WidgetCard :tile="t" /></div>
        </div>
        <div v-else class="pm-empty"><Icon name="layout" :size="40" /><p>This dashboard has no widgets.</p></div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.pm { position: fixed; inset: 0; z-index: 200; background: var(--bg); display: flex; flex-direction: column; }
.pm-bar { height: 60px; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; background: var(--surface); border-bottom: 1px solid var(--border); }
.pm-title { display: flex; align-items: center; gap: 10px; font-size: 17px; color: var(--ink); }
.pm-title b { font-weight: 600; }
.pm-exit { width: 44px; height: 44px; border: none; background: transparent; color: var(--muted); border-radius: 12px; display: grid; place-items: center; }
.pm-exit:hover { background: var(--red-soft); color: var(--red); }
.pm-body { flex: 1; overflow: auto; padding: 22px 26px; }
.pm-grid { display: grid; grid-template-columns: repeat(12, 1fr); align-items: start; }
.pm-cell { position: relative; display: flex; flex-direction: column; }
.pm-cell > :deep(.tile) { flex: 1; min-height: 0; }
/* wallboard: hide per-tile hover controls + drag handle */
.pm-cell :deep(.right), .pm-cell :deep(.draghandle) { display: none !important; }
.pm-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; color: var(--muted-2); }
</style>
