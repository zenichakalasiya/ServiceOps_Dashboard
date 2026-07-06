<script setup>
import { ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { store, toast } from '../../store/index.js'
const open = ref(false)
const from = ref(''); const to = ref('')
const fromEl = ref(null); const toEl = ref(null)
const search = ref('')

// Applied absolute range → compact two-line (From / To) display, like the reference.
const isCustom = computed(() => store.timeFilter.preset === 'custom' && store.timeFilter.from && store.timeFilter.to)
function fmtRange(s) {
  if (!s) return ''
  const [d, t = ''] = s.split('T')
  const [Y, M, D] = d.split('-')
  const hms = (t || '00:00').length === 5 ? `${t}:00` : (t || '00:00:00')
  return `${(Y || '').slice(2)}-${M}-${D} ${hms}`
}

// Quick ranges — ordered like the reference (Last N …), plus ITSM presets.
const QUICK = [
  { k: 'last5m', label: 'Last 5 minutes' }, { k: 'last15m', label: 'Last 15 minutes' }, { k: 'last30m', label: 'Last 30 minutes' },
  { k: 'last1h', label: 'Last 1 hour' }, { k: 'last3h', label: 'Last 3 hours' }, { k: 'last6h', label: 'Last 6 hours' },
  { k: 'last12h', label: 'Last 12 hours' }, { k: 'last24h', label: 'Last 24 hours' }, { k: 'last2d', label: 'Last 2 days' },
  { k: 'last7', label: 'Last 7 days' }, { k: 'last30', label: 'Last 30 days' },
  { k: 'today', label: 'Today' }, { k: 'yesterday', label: 'Yesterday' },
  { k: 'week', label: 'This week' }, { k: 'month', label: 'This month' },
  { k: 'qtr', label: 'This quarter' }, { k: 'ytd', label: 'Year to date' },
]
function pick(q) { store.timeFilter = { preset: q.k, label: q.label, from: null, to: null }; open.value = false }
function applyAbs() {
  if (!from.value || !to.value) { toast('Pick both From and To'); return }
  const fmt = (s) => s.replace('T', ' ')
  store.timeFilter = { preset: 'custom', label: `${fmt(from.value)} → ${fmt(to.value)}`, from: from.value, to: to.value }
  open.value = false
}
function openPicker(el) { try { el?.showPicker?.() } catch (e) { el?.focus() } }
</script>

<template>
  <div class="tf">
    <button class="btn trigger" :class="{ on: open, 'is-range': isCustom }" @click.stop="open = !open">
      <Icon name="clock" :size="16" />
      <span v-if="isCustom" class="rng">
        <span class="rl">{{ fmtRange(store.timeFilter.from) }}</span>
        <span class="rl">{{ fmtRange(store.timeFilter.to) }}</span>
      </span>
      <span v-else class="lbl-1">{{ store.timeFilter.label }}</span>
      <Icon name="chevron-down" :size="14" class="muted" />
    </button>
    <div v-if="open" class="backdrop" @click="open = false" />
    <transition name="pop">
      <div v-if="open" class="pop" @click.stop>
        <!-- Absolute time range (From / To stacked vertically) -->
        <div class="abs">
          <div class="lbl">Absolute time range</div>

          <div class="field-block">
            <label>From</label>
            <div class="dt">
              <input ref="fromEl" class="input" type="datetime-local" v-model="from" />
              <button class="cal" @click="openPicker(fromEl)" title="Pick date"><Icon name="calendar" :size="15" /></button>
            </div>
          </div>

          <div class="field-block">
            <label>To</label>
            <div class="dt">
              <input ref="toEl" class="input" type="datetime-local" v-model="to" />
              <button class="cal" @click="openPicker(toEl)" title="Pick date"><Icon name="calendar" :size="15" /></button>
            </div>
          </div>

          <button class="btn btn-primary apply" @click="applyAbs"><Icon name="check" :size="15" /> Apply time range</button>
        </div>

        <!-- Quick ranges -->
        <div class="quick">
          <div class="qsearch"><Icon name="search" :size="14" class="muted" /><input v-model="search" placeholder="Search quick ranges" /></div>
          <div class="qlist">
            <button v-for="q in QUICK.filter(x => x.label.toLowerCase().includes(search.toLowerCase()))" :key="q.k"
              class="qitem" :class="{ on: store.timeFilter.preset === q.k }" @click="pick(q)">
              {{ q.label }} <Icon v-if="store.timeFilter.preset === q.k" name="check" :size="14" />
            </button>
            <div v-if="!QUICK.filter(x => x.label.toLowerCase().includes(search.toLowerCase())).length" class="qnone">No matching ranges</div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.tf { position: relative; }
.trigger { height: 36px; max-width: 230px; }
.trigger.on { border-color: var(--primary); color: var(--primary-700); }
.lbl-1 { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* compact two-line From/To range inside the trigger */
.trigger.is-range { padding-top: 0; padding-bottom: 0; }
.rng { display: flex; flex-direction: column; justify-content: center; line-height: 1.2; font-size: 10.5px; font-variant-numeric: tabular-nums; text-align: left; }
.rl { white-space: nowrap; }
.backdrop { position: fixed; inset: 0; z-index: 55; }
.pop { position: absolute; top: 42px; right: 0; z-index: 60; display: grid; grid-template-columns: 264px 232px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--sh-pop); overflow: hidden; }
.abs { padding: 16px; border-right: 1px solid var(--border); display: flex; flex-direction: column; }
.lbl { font-weight: 600; font-size: 13px; margin-bottom: 12px; }
/* From / To stacked vertically */
.field-block { display: flex; flex-direction: column; margin-bottom: 12px; }
.field-block label { font-size: 12px; font-weight: 500; color: var(--ink-2); margin-bottom: 5px; }
.dt { position: relative; }
.dt .input { height: 36px; font-size: 12.5px; padding-right: 36px; width: 100%; }
.dt .input::-webkit-calendar-picker-indicator { opacity: 0; }
.cal { position: absolute; right: 4px; top: 4px; width: 28px; height: 28px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.cal:hover { background: var(--surface-2); color: var(--ink); }
.apply { width: 100%; margin-top: 4px; }
.quick { padding: 12px 10px; display: flex; flex-direction: column; min-height: 0; }
.qsearch { display: flex; align-items: center; gap: 7px; border: 1px solid var(--border-strong); border-radius: 8px; padding: 0 9px; height: 34px; margin-bottom: 8px; }
.qsearch input { border: none; outline: none; background: transparent; width: 100%; font-size: 12.5px; }
.qlist { display: flex; flex-direction: column; gap: 1px; overflow: auto; max-height: 300px; }
.qitem { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border: none; background: transparent; border-radius: 7px; font-size: 13px; color: var(--ink-2); text-align: left; }
.qitem:hover { background: var(--surface-2); }
.qitem.on { background: var(--primary-soft); color: var(--primary-700); font-weight: 600; }
.qnone { padding: 14px 10px; color: var(--muted-2); font-size: 12px; }
</style>
