<script setup>
import { ref, computed } from 'vue'
import Icon from '../components/ui/Icon.vue'
import DashboardCard from '../components/dashboard/DashboardCard.vue'
import ShareDialog from '../components/dashboard/ShareDialog.vue'
import { store, live } from '../store/index.js'
const shareFor = ref(null)
const groups = computed(() => {
  const g = []
  store.folders.forEach((f) => {
    const items = live.value.filter((d) => d.folder === f.id)
    if (items.length) g.push({ name: f.name, color: f.color, items })
  })
  const unfiled = live.value.filter((d) => !d.folder)
  if (unfiled.length) g.push({ name: 'Unfiled', color: '#9a9db2', items: unfiled })
  return g
})
</script>
<template>
  <div class="page">
    <div class="page-head">
      <div><h1>All Dashboards</h1><p class="muted">The full estate — {{ live.length }} dashboards across {{ groups.length }} groups, with previews and metadata.</p></div>
      <button class="btn btn-primary" @click="store.ui.createOpen = true"><Icon name="plus" :size="17" /> Create Dashboard</button>
    </div>
    <section v-for="g in groups" :key="g.name" class="grp">
      <div class="grp-head"><span class="dot" :style="{ background: g.color }" /> {{ g.name }} <span class="cnt">{{ g.items.length }}</span></div>
      <div class="grid"><DashboardCard v-for="d in g.items" :key="d.id" :d="d" @share="shareFor = $event" /></div>
    </section>
    <ShareDialog v-if="shareFor" :d="shareFor" @close="shareFor = null" />
  </div>
</template>
<style scoped>
.page { padding: 22px 26px 60px; max-width: 1320px; margin: 0 auto; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.page-head h1 { margin: 0; font-size: 22px; } .page-head p { margin: 4px 0 0; font-size: 13px; }
.grp { margin-top: 22px; }
.grp-head { display: flex; align-items: center; gap: 9px; font-weight: 600; font-size: 13.5px; margin-bottom: 12px; }
.dot { width: 10px; height: 10px; border-radius: 3px; }
.cnt { font-size: 11px; color: var(--muted); background: var(--surface-2); border: 1px solid var(--border); padding: 1px 8px; border-radius: 999px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
</style>
