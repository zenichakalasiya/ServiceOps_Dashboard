<script setup>
import { ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { toast } from '../../store/index.js'
const props = defineProps({ d: Object })
const emit = defineEmits(['close'])
const cadence = ref('weekly')
const time = ref('09:00')
const fmt = ref('PDF')
const recipients = ref(props.d.access === 'restricted' ? 'Service Desk (group)' : '')
const CAD = [{ k: 'daily', l: 'Daily' }, { k: 'weekly', l: 'Weekly' }, { k: 'monthly', l: 'Monthly' }]
function save() { toast(`Scheduled “${props.d.name}” — ${cadence.value}, ${fmt.value}`, 'success'); emit('close') }
</script>
<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal sc">
      <div class="head"><div class="row gap-10"><Icon name="calendar2" :size="18" /><h3>Schedule report</h3></div><button class="btn btn-icon" @click="emit('close')"><Icon name="x" :size="18" /></button></div>
      <div class="body">
        <p class="muted intro">Deliver “{{ d.name }}” on a recurring cadence — honoring the board's access audience.</p>
        <label class="field">Cadence</label>
        <div class="seg">
          <button v-for="c in CAD" :key="c.k" class="seg-btn" :class="{ on: cadence === c.k }" @click="cadence = c.k">{{ c.l }}</button>
        </div>
        <div class="two">
          <div><label class="field">Time</label><input class="input" type="time" v-model="time" /></div>
          <div><label class="field">Format</label>
            <div class="select"><select v-model="fmt" class="input"><option>PDF</option><option>Image</option><option>CSV</option></select><Icon name="chevron-down" :size="13" class="chev" /></div>
          </div>
        </div>
        <label class="field">Recipients</label>
        <input class="input" v-model="recipients" placeholder="Add technicians or groups…" />
        <p class="note"><Icon name="lock" :size="12" /> Recipients are validated against the board's access — no out-of-band leaks.</p>
      </div>
      <div class="foot"><button class="btn" @click="emit('close')">Cancel</button><button class="btn btn-primary" @click="save"><Icon name="check" :size="16" /> Schedule</button></div>
    </div>
  </div>
</template>
<style scoped>
.sc { width: 480px; }
.head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 10px; } .head h3 { margin: 0; font-size: 16px; }
.body { padding: 4px 20px 14px; } .intro { font-size: 13px; margin: 0 0 14px; }
.field { margin: 12px 0 6px; }
.seg { display: flex; gap: 6px; } .seg-btn { flex: 1; height: 36px; border: 1px solid var(--border-strong); background: var(--surface); border-radius: 9px; font-weight: 500; font-size: 13px; color: var(--ink-2); }
.seg-btn.on { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-700); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.select { position: relative; } .select select { appearance: none; padding-right: 30px; } .chev { position: absolute; right: 11px; top: 12px; color: var(--muted); pointer-events: none; }
.note { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted); margin: 9px 0 0; }
.foot { display: flex; justify-content: flex-end; gap: 10px; padding: 13px 20px; border-top: 1px solid var(--border); background: var(--surface-2); }
</style>
