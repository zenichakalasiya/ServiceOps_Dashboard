<script setup>
import { ref, watch, onUnmounted } from 'vue'
import Icon from '../ui/Icon.vue'
import { store, toast } from '../../store/index.js'
const emit = defineEmits(['refresh'])
const open = ref(false)
const spin = ref(false)

// Off · Auto · 5s · 10s · 30s · 1m · 5m · 15m · 30m · 1h · 2h · 1d  (per reference)
const OPTS = [
  { k: 'off', label: 'Off', sec: 0 }, { k: 'auto', label: 'Auto', sec: 60 },
  { k: '5s', label: '5s', sec: 5 }, { k: '10s', label: '10s', sec: 10 }, { k: '30s', label: '30s', sec: 30 },
  { k: '1m', label: '1m', sec: 60 }, { k: '5m', label: '5m', sec: 300 }, { k: '15m', label: '15m', sec: 900 },
  { k: '30m', label: '30m', sec: 1800 }, { k: '1h', label: '1h', sec: 3600 }, { k: '2h', label: '2h', sec: 7200 }, { k: '1d', label: '1d', sec: 86400 },
]

let timer = null
function pulse() { spin.value = true; setTimeout(() => (spin.value = false), 700); emit('refresh') }
function manual() { pulse(); toast('Dashboard refreshed') }
function restart(sec) {
  if (timer) { clearInterval(timer); timer = null }
  if (sec > 0) timer = setInterval(pulse, sec * 1000)
}
function pick(o) { store.autoRefresh = { interval: o.k, label: o.label }; open.value = false; restart(o.sec) }
watch(() => store.autoRefresh.interval, (k) => restart((OPTS.find((o) => o.k === k) || {}).sec || 0), { immediate: true })
onUnmounted(() => timer && clearInterval(timer))
</script>

<template>
  <div class="ar">
    <button class="refresh" @click="manual" title="Refresh now">
      <Icon name="refresh" :size="16" :class="{ spin }" /> Refresh
    </button>
    <div class="rel">
      <button class="interval" :class="{ on: open || store.autoRefresh.interval !== 'off' }" @click.stop="open = !open" title="Auto-refresh interval">
        {{ store.autoRefresh.label }} <Icon name="chevron-down" :size="13" />
      </button>
      <div v-if="open" class="backdrop" @click="open = false" />
      <transition name="pop"><div v-if="open" class="menu" @click.stop>
        <button v-for="o in OPTS" :key="o.k" class="menu-item" :class="{ on: store.autoRefresh.interval === o.k }" @click="pick(o)">
          {{ o.label }} <Icon v-if="store.autoRefresh.interval === o.k" name="check" :size="14" />
        </button>
      </div></transition>
    </div>
  </div>
</template>

<style scoped>
.ar { display: inline-flex; align-items: stretch; height: 36px; }
.refresh { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 12px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); font-weight: 500; font-size: 13px; border-radius: 9px 0 0 9px; border-right: none; }
.refresh:hover { background: var(--surface-2); }
.spin { animation: sp .7s linear infinite; } @keyframes sp { to { transform: rotate(360deg); } }
.rel { position: relative; }
.interval { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 11px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); font-weight: 500; font-size: 13px; border-radius: 0 9px 9px 0; min-width: 62px; justify-content: space-between; }
.interval:hover { background: var(--surface-2); }
.interval.on { border-color: var(--primary); color: var(--primary-700); }
.backdrop { position: fixed; inset: 0; z-index: 55; }
.menu { position: absolute; right: 0; top: 42px; z-index: 60; min-width: 130px; }
.menu-item { justify-content: space-between; }
.menu-item.on { color: var(--primary-700); font-weight: 600; background: var(--primary-soft); }
</style>
