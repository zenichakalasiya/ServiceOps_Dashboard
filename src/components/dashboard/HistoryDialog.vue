<script setup>
// Version / change history for a dashboard — range-filtered, ServiceOps UI treatment.
import { ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
const props = defineProps({ d: Object })
const emit = defineEmits(['close'])

const from = ref('2021-06-07')
const to = ref(new Date().toISOString().slice(0, 10))
const q = ref('')
const applied = ref({ from: from.value, to: to.value })
function search() { applied.value = { from: from.value, to: to.value } }

const rows = computed(() => {
  const list = props.d.history || []
  return list.filter((h) => h.date >= applied.value.from && h.date <= applied.value.to)
    .filter((h) => {
      const s = q.value.trim().toLowerCase()
      return !s || [h.event, h.user, h.summary, h.module].some((v) => String(v).toLowerCase().includes(s))
    })
})
</script>

<template>
  <div class="drawer-overlay" @click.self="emit('close')">
    <div class="hd">
      <header class="hd-head">
        <h3>History: {{ d.name }}</h3>
        <button class="ic" @click="emit('close')"><Icon name="x" :size="18" /></button>
      </header>

      <div class="hd-filters">
        <div class="fl"><label>From <i>*</i></label><input class="input" type="date" v-model="from" /></div>
        <div class="fl"><label>To <i>*</i></label><input class="input" type="date" v-model="to" /></div>
        <button class="btn btn-primary srch-btn" @click="search"><Icon name="search" :size="15" /> Search</button>
      </div>
      <div class="hd-filter2">
        <div class="qbox"><Icon name="search" :size="14" class="muted" /><input v-model="q" placeholder="Filter events…" /></div>
      </div>

      <div class="hd-body">
        <table class="htbl">
          <thead><tr><th>Event</th><th>Event Time</th><th>Module</th><th>User</th><th>Change Summary</th></tr></thead>
          <tbody>
            <tr v-for="(h, i) in rows" :key="i">
              <td><b>{{ h.event }}</b></td>
              <td class="muted">{{ h.when }}</td>
              <td>{{ h.module }}</td>
              <td><a class="user">{{ h.user }}</a></td>
              <td class="sum">{{ h.summary }}</td>
            </tr>
            <tr v-if="!rows.length"><td colspan="5" class="none">No changes in this range.</td></tr>
          </tbody>
        </table>
      </div>
      <footer class="hd-foot"><span class="muted">Showing {{ rows.length }} {{ rows.length === 1 ? 'event' : 'events' }}</span></footer>
    </div>
  </div>
</template>

<style scoped>
.drawer-overlay { position: fixed; inset: 0; background: rgba(20,21,38,.42); backdrop-filter: blur(2px); z-index: 100; display: flex; justify-content: flex-end; }
.hd { width: 860px; max-width: 96vw; height: 100%; background: var(--surface); box-shadow: var(--sh-lg); display: flex; flex-direction: column; overflow: hidden; animation: slideIn .22s cubic-bezier(.2,.8,.2,1); }
@keyframes slideIn { from { transform: translateX(30px); opacity: .4; } to { transform: translateX(0); opacity: 1; } }
.hd-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 14px; border-bottom: 1px solid var(--border); }
.hd-head h3 { margin: 0; font-size: 17px; }
.ic { width: 34px; height: 34px; border: none; background: transparent; color: var(--muted); border-radius: 9px; display: grid; place-items: center; }
.ic:hover { background: var(--surface-2); color: var(--ink); }
.hd-filters { display: flex; align-items: flex-end; gap: 12px; padding: 16px 22px 12px; }
.hd-filter2 { padding: 0 22px 16px; border-bottom: 1px solid var(--border); }
.fl { display: flex; flex-direction: column; }
.fl label { font-size: 12px; font-weight: 500; color: var(--ink-2); margin-bottom: 6px; } .fl label i { color: var(--red); font-style: normal; }
.srch-btn { height: 38px; }
.qbox { display: flex; align-items: center; gap: 8px; height: 38px; border: 1px solid var(--border-strong); border-radius: var(--r); padding: 0 11px; background: var(--surface-2); }
.qbox input { border: none; outline: none; background: transparent; width: 100%; font-size: 13.5px; }
.hd-body { flex: 1; overflow: auto; padding: 6px 22px 20px; }
.htbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.htbl th { position: sticky; top: 0; background: var(--surface); text-align: left; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .4px; font-weight: 600; padding: 12px 12px; border-bottom: 1px solid var(--border); }
.htbl td { padding: 12px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
.htbl tr:hover td { background: var(--surface-2); }
.user { color: var(--primary-700); font-weight: 500; }
.sum { color: var(--ink-2); }
.none { text-align: center; color: var(--muted-2); padding: 40px; }
.hd-foot { padding: 12px 22px; border-top: 1px solid var(--border); background: var(--surface-2); font-size: 12.5px; }
</style>
