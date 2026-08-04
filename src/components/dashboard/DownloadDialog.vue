<script setup>
/**
 * DownloadDialog — anchored under the Download button in the board header.
 * Shares its visual language with SharePopover (same segmented control, toggle and
 * password field), because they sit side by side under adjacent buttons and reading
 * as two different products is the fastest way to make a header feel assembled.
 */
import { ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { toast } from '../../store/index.js'
const props = defineProps({ d: Object })
const emit = defineEmits(['close'])

const FORMATS = [
  { id: 'Image', label: 'Image', icon: 'image' },
  { id: 'PDF', label: 'PDF', icon: 'file-text' },
]
const fmt = ref('PDF')
const pwd = ref(false)
const password = ref('')
const showPwd = ref(false)

function download() {
  // asking for protection and leaving it blank would write an unprotected file
  if (pwd.value && !password.value.trim()) { toast('Set an attachment password, or turn the protection off', 'warn'); return }
  toast(`Downloading “${props.d.name}” as ${fmt.value}${pwd.value ? ' — password protected' : ''}`, 'success')
  emit('close')
}
</script>

<template>
  <div class="pv-back" @click="emit('close')" />
  <div class="pv card" @click.stop>
    <header class="pv-head"><span class="pv-title">Download dashboard</span></header>

    <div class="tabs">
      <button v-for="f in FORMATS" :key="f.id" class="tab" :class="{ on: fmt === f.id }" @click="fmt = f.id">
        <Icon :name="f.icon" :size="15" /> {{ f.label }}
      </button>
    </div>

    <label class="tgl-row">
      <span class="tgl-txt">
        <b>Password Protected</b>
        <em>The file is encrypted, and anyone opening it needs this password.</em>
      </span>
      <button class="tgl" :class="{ on: pwd }" role="switch" :aria-checked="pwd" @click.prevent="pwd = !pwd"><i /></button>
    </label>

    <template v-if="pwd">
      <label class="fl">Attachment Password <i>*</i></label>
      <div class="pw">
        <input class="input" :type="showPwd ? 'text' : 'password'" v-model="password" placeholder="Password" />
        <button class="eye" :title="showPwd ? 'Hide' : 'Show'" @click="showPwd = !showPwd"><Icon name="eye" :size="15" /></button>
      </div>
    </template>

    <footer class="pv-foot">
      <button class="btn" @click="emit('close')">Cancel</button>
      <button class="btn btn-primary" @click="download"><Icon name="download" :size="15" /> Download</button>
    </footer>
  </div>
</template>

<style scoped>
.pv-back { position: fixed; inset: 0; z-index: 55; }
/* anchored directly under the Download button, right-aligned to it */
.pv { position: absolute; top: 44px; right: 0; z-index: 60; width: 360px; padding: 14px 16px 12px; }
.pv-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pv-title { font-weight: 700; font-size: 15px; color: var(--ink); }

.tabs { display: flex; gap: 4px; margin: 12px 0 4px; padding: 3px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; }
.tab { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 32px; border: none; background: transparent; color: var(--muted); border-radius: 8px; font-size: 12.5px; font-weight: 600; }
.tab:hover { color: var(--ink); }
.tab.on { background: var(--primary); color: #fff; box-shadow: var(--sh-sm); }

.fl { display: block; font-size: 12px; font-weight: 500; color: var(--ink-2); margin: 14px 0 6px; }
.fl i { color: var(--red); font-style: normal; }

.tgl-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 14px; cursor: pointer; }
.tgl-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tgl-txt b { font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.tgl-txt em { font-style: normal; font-size: 11.5px; color: var(--muted); line-height: 1.45; }
.tgl { flex: none; width: 38px; height: 22px; padding: 0; border: none; border-radius: 999px; background: var(--border-strong); position: relative; transition: background .15s; }
.tgl i { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: var(--sh-sm); transition: transform .15s; }
.tgl.on { background: var(--primary); }
.tgl.on i { transform: translateX(16px); }

.pw { position: relative; }
.pw .input { width: 100%; padding-right: 38px; }
.eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: none; background: transparent; color: var(--muted); border-radius: 6px; display: grid; place-items: center; }
.eye:hover { background: var(--surface-2); color: var(--ink); }

.pv-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
</style>
