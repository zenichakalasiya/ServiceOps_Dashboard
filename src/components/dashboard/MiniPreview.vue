<script setup>
// Tiny visual preview of a board's tiles for the gallery cards (P1·5 previews).
import { computed } from 'vue'
const props = defineProps({ tiles: Array })
const blocks = computed(() => (props.tiles || []).slice(0, 6).map((t) => t.type))
const col = { kpi: '#7b68ee', chart: '#2f80ed', shortcut: '#1f9d63' }
</script>
<template>
  <div class="mini">
    <div v-if="!blocks.length" class="empty"><span>Empty</span></div>
    <template v-else>
      <div v-for="(b, i) in blocks" :key="i" class="blk" :class="b" :style="{ background: col[b] + '22', borderColor: col[b] + '55' }">
        <div v-if="b === 'kpi'" class="num" :style="{ color: col[b] }" />
        <div v-else-if="b === 'chart'" class="bars"><i v-for="n in 4" :key="n" :style="{ background: col[b], height: (30 + n * 14) + '%' }" /></div>
        <div v-else class="rows"><i v-for="n in 3" :key="n" :style="{ background: col[b] }" /></div>
      </div>
    </template>
  </div>
</template>
<style scoped>
.mini { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; padding: 9px; background: var(--surface-2); border-radius: 10px; height: 92px; overflow: hidden; }
.blk { border: 1px solid; border-radius: 6px; padding: 6px; display: flex; align-items: flex-end; }
.blk.kpi { align-items: center; }
.num { width: 60%; height: 12px; border-radius: 3px; }
.bars { display: flex; align-items: flex-end; gap: 3px; width: 100%; height: 100%; }
.bars i { flex: 1; border-radius: 2px 2px 0 0; }
.rows { display: flex; flex-direction: column; gap: 3px; width: 100%; }
.rows i { height: 4px; border-radius: 2px; opacity: .6; }
.empty { grid-column: 1 / -1; display: grid; place-items: center; color: var(--muted-2); font-size: 12px; font-weight: 500; }
</style>
