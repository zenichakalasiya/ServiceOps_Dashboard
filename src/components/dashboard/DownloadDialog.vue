<script setup>
import { ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { toast } from '../../store/index.js'
const props = defineProps({ d: Object })
const emit = defineEmits(['close'])
const fmt = ref('PDF')
const pwd = ref(false)
const password = ref('')
const showPwd = ref(false)
function download() {
  toast(`Downloading “${props.d.name}” as ${fmt.value}${pwd.value ? ' (password protected)' : ''}`, 'success')
  emit('close')
}
</script>

<template>
  <div class="pv-back" @click="emit('close')" />
  <div class="pv card" @click.stop>
    <div class="pv-title">Download dashboard</div>
    <label class="fld">Format</label>
    <div class="tabs2">
      <button class="t2" :class="{ on: fmt === 'Image' }" @click="fmt = 'Image'"><Icon name="image" :size="16" /> Image</button>
      <button class="t2" :class="{ on: fmt === 'PDF' }" @click="fmt = 'PDF'"><Icon name="file-text" :size="16" /> PDF</button>
    </div>
    <div class="pwrow">
      <span class="fld" style="margin:0">Password Protected</span>
      <button class="sw" :class="{ on: pwd }" @click="pwd = !pwd"><i /></button>
    </div>
    <template v-if="pwd">
      <label class="fld">Attachment Password</label>
      <div class="pwd-input">
        <Icon name="lock" :size="14" class="muted" />
        <input :type="showPwd ? 'text' : 'password'" v-model="password" placeholder="Attachment Password" />
        <button class="eye" @click="showPwd = !showPwd"><Icon name="eye" :size="15" /></button>
      </div>
    </template>
    <div class="btns"><button class="btn btn-sm btn-primary" @click="download"><Icon name="download" :size="15" /> Download</button><button class="btn btn-sm" @click="emit('close')">Cancel</button></div>
  </div>
</template>

<style scoped>
.pv-back { position: fixed; inset: 0; z-index: 55; }
.pv { position: absolute; top: 44px; right: 0; z-index: 60; width: 300px; padding: 14px; }
.pv-title { font-weight: 700; font-size: 14px; margin-bottom: 12px; }
.fld { display: block; font-size: 12px; font-weight: 500; color: var(--ink-2); margin: 12px 0 8px; }
.tabs2 { display: flex; gap: 8px; }
.t2 { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 50px; border: 1px solid var(--border-strong); background: var(--surface); border-radius: 10px; font-weight: 500; font-size: 13px; color: var(--ink-2); }
.t2:hover { background: var(--surface-2); }
.t2.on { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-700); }
.pwrow { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 16px; }
.sw { width: 40px; height: 22px; border-radius: 999px; border: none; background: var(--border-strong); position: relative; }
.sw i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: var(--sh-sm); }
.sw.on { background: var(--green); } .sw.on i { left: 20px; }
.pwd-input { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-strong); border-radius: var(--r); padding: 0 10px; height: 38px; }
.pwd-input input { border: none; outline: none; background: transparent; flex: 1; font-size: 13.5px; }
.eye { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; }
.btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>
