<script setup>
import { ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { toast } from '../../store/index.js'
import { ACCESS } from '../../data/mock.js'
const props = defineProps({ d: Object })
const emit = defineEmits(['close'])

const ALL = ['Service Desk (group)', 'Network Team (group)', 'Aarav Mehta', 'Priya Nair', 'Rohan Iyer', 'Sneha Patil', 'Vikram Deshpande', 'NOC Viewers (group)']
const picked = ref(props.d.access === 'restricted' ? ['Service Desk (group)'] : [])
const query = ref('')
const suggestions = computed(() => ALL.filter((p) => !picked.value.includes(p) && p.toLowerCase().includes(query.value.toLowerCase())))
function add(p) { picked.value.push(p); query.value = '' }
function remove(p) { picked.value = picked.value.filter((x) => x !== p) }

const link = computed(() => `${location.origin}${location.pathname}#/dashboard/${props.d.id}`)
function copy() { navigator.clipboard?.writeText(link.value).catch(() => {}); toast('Governed link copied') }
const audience = computed(() => {
  if (props.d.access === 'public') return 'Everyone with portal access can open this board.'
  if (props.d.access === 'private') return 'Private — only you, plus anyone you add below.'
  return `Restricted — ${picked.value.length} recipient${picked.value.length === 1 ? '' : 's'} can open this board.`
})
function done() { toast(`Shared “${props.d.name}” with ${picked.value.length} recipient${picked.value.length === 1 ? '' : 's'}`, 'success'); emit('close') }
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal sh">
      <div class="head">
        <div class="row gap-10"><Icon name="share" :size="18" /><h3>Share “{{ d.name }}”</h3></div>
        <button class="btn btn-icon" @click="emit('close')"><Icon name="x" :size="18" /></button>
      </div>
      <div class="body">
        <div class="aud">
          <Icon :name="ACCESS[d.access].icon" :size="15" />
          <span><b>{{ ACCESS[d.access].label }}.</b> {{ audience }}</span>
        </div>

        <label class="field">Add technicians or groups</label>
        <div class="picker">
          <div class="chips">
            <span v-for="p in picked" :key="p" class="chip chip-primary">{{ p }} <button @click="remove(p)"><Icon name="x" :size="11" /></button></span>
            <input v-model="query" :placeholder="picked.length ? '' : 'Search people & groups…'" />
          </div>
          <div v-if="query && suggestions.length" class="sug">
            <button v-for="s in suggestions" :key="s" class="sug-item" @click="add(s)">
              <Icon :name="s.includes('group') ? 'users' : 'user'" :size="15" /> {{ s }}
            </button>
          </div>
        </div>
        <p class="note"><Icon name="lock" :size="13" /> Recipients are validated against the board's access audience — you can't over-share a Restricted board.</p>

        <label class="field" style="margin-top:14px">Governed link</label>
        <div class="link"><Icon name="link" :size="15" class="muted" /><span class="ellip">{{ link }}</span><button class="btn btn-sm" @click="copy"><Icon name="copy" :size="14" /> Copy</button></div>
      </div>
      <div class="foot">
        <span class="muted" style="font-size:12.5px">Replaces the old silent “Export &amp; email PDF”.</span>
        <div class="row gap-10">
          <button class="btn" @click="emit('close')">Cancel</button>
          <button class="btn btn-primary" @click="done"><Icon name="check" :size="16" /> Share</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sh { width: 540px; }
.head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 12px; }
.head h3 { margin: 0; font-size: 16px; }
.body { padding: 4px 20px 16px; }
.aud { display: flex; align-items: center; gap: 9px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 11px 13px; font-size: 13px; margin-bottom: 16px; }
.picker { position: relative; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; border: 1px solid var(--border-strong); border-radius: 10px; padding: 7px 8px; min-height: 42px; }
.chips input { border: none; outline: none; flex: 1; min-width: 120px; font-size: 13.5px; }
.chip button { border: none; background: transparent; display: inline-grid; place-items: center; cursor: pointer; color: inherit; padding: 0; }
.sug { position: absolute; left: 0; right: 0; top: calc(100% + 4px); background: #fff; border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--sh-pop); padding: 5px; z-index: 5; max-height: 200px; overflow: auto; }
.sug-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px 10px; border: none; background: transparent; border-radius: 7px; font-size: 13.5px; text-align: left; }
.sug-item:hover { background: var(--surface-2); }
.note { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--muted); margin: 9px 2px 0; }
.link { display: flex; align-items: center; gap: 9px; border: 1px solid var(--border-strong); border-radius: 10px; padding: 8px 10px; font-size: 12.5px; color: var(--ink-2); }
.link .ellip { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 20px; border-top: 1px solid var(--border); background: var(--surface-2); }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
