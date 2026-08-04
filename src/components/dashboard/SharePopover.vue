<script setup>
/**
 * SharePopover — anchored under the Share button in the board header.
 *
 * Two tabs, because sharing a board and sending a copy of it are different acts with
 * different fields: "Share Access" grants people the live dashboard, "Export dashboard
 * as a PDF" mails a snapshot. Putting both in one flat form made half the fields
 * irrelevant whichever one you actually wanted.
 *
 * Email addresses are added one at a time: the [+] opens a single input, committing it
 * turns the address into a row and brings the [+] back. That keeps an empty input from
 * sitting on screen pretending to be a required field.
 */
import { ref, computed, nextTick } from 'vue'
import Icon from '../ui/Icon.vue'
import Dropdown from '../ui/Dropdown.vue'
import { store, toast } from '../../store/index.js'
const props = defineProps({ d: Object })
const emit = defineEmits(['close'])

const TABS = [
  { id: 'access', label: 'Share Access' },
  { id: 'pdf', label: 'Export dashboard as a PDF' },
]
const tab = ref('access')

// --- Share Access
const ACCESS_LABEL = { view: 'can view', edit: 'can edit' }
const techs = ref([])
const level = ref('view')
const lvlMenu = ref(false)
function setLevel(l) { level.value = l; lvlMenu.value = false }

// --- Export as PDF
const emails = ref([])
const newEmail = ref('')
const adding = ref(false)
const emailEl = ref(null)
function startEmail() { adding.value = true; nextTick(() => emailEl.value?.focus()) }
function cancelEmail() { adding.value = false; newEmail.value = '' }
const pwProtect = ref(false)
const password = ref('')
const showPw = ref(false)
const emailValid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.value.trim()))
function addEmail() {
  if (!emailValid.value) return
  emails.value.push(newEmail.value.trim())
  newEmail.value = ''
  adding.value = false          // the [+] comes back, ready for the next one
}
function removeEmail(i) { emails.value.splice(i, 1) }

function share() {
  if (tab.value === 'access') {
    if (!techs.value.length) { toast('Pick at least one technician or group', 'warn'); return }
    toast(`“${props.d.name}” shared with ${techs.value.length} recipient${techs.value.length > 1 ? 's' : ''} — ${ACCESS_LABEL[level.value]}`)
  } else {
    if (!emails.value.length) { toast('Add at least one email address', 'warn'); return }
    // a password that was asked for and left blank would send an unprotected file
    if (pwProtect.value && !password.value.trim()) { toast('Set an attachment password, or turn the protection off', 'warn'); return }
    toast(`PDF sent to ${emails.value.length} recipient${emails.value.length > 1 ? 's' : ''}${pwProtect.value ? ' — password protected' : ''}`)
  }
  emit('close')
}
</script>

<template>
  <div class="pv-back" @click="emit('close')" />
  <div class="pv card" @click.stop>
    <header class="pv-head">
      <span class="pv-title">Share Dashboard</span>
    </header>

    <div class="tabs">
      <button v-for="t in TABS" :key="t.id" class="tab" :class="{ on: tab === t.id }" @click="tab = t.id">{{ t.label }}</button>
    </div>

    <!-- grant people the live dashboard -->
    <template v-if="tab === 'access'">
      <label class="fl">Technician Access Level <i>*</i></label>
      <div class="row">
        <Dropdown class="grow" v-model="techs" :options="store.owners" :multiple="true" placeholder="Select technicians" />
        <div class="lvl-wrap">
          <button class="lvl-btn" @click="lvlMenu = !lvlMenu">{{ ACCESS_LABEL[level] }} <Icon name="chevron-down" :size="13" /></button>
          <div v-if="lvlMenu" class="lvl-back" @click.stop="lvlMenu = false" />
          <div v-if="lvlMenu" class="lvl-menu">
            <button class="lvl-opt" :class="{ on: level === 'view' }" @click="setLevel('view')"><Icon name="eye" :size="14" /> can view</button>
            <button class="lvl-opt" :class="{ on: level === 'edit' }" @click="setLevel('edit')"><Icon name="edit" :size="14" /> can edit</button>
          </div>
        </div>
      </div>
    </template>

    <!-- mail a snapshot -->
    <template v-else>
      <label class="fl">Add Email <i>*</i></label>
      <div class="emails">
        <div v-for="(e, i) in emails" :key="i" class="erow">
          <span class="eaddr">{{ e }}</span>
          <button class="ex" title="Remove" @click="removeEmail(i)"><Icon name="x" :size="13" /></button>
        </div>
        <!-- one input at a time: committing it returns the [+], which is how you add the next -->
        <div v-if="adding" class="erow">
          <input ref="emailEl" class="input" v-model="newEmail" placeholder="name@company.com" @keyup.enter="addEmail" @keyup.esc="cancelEmail" />
          <button class="ex" title="Cancel" @click="cancelEmail"><Icon name="x" :size="13" /></button>
        </div>
        <button v-else class="add-btn" title="Add an email address" @click="startEmail"><Icon name="plus" :size="16" /></button>
      </div>

      <label class="tgl-row">
        <span class="tgl-txt">
          <b>Password Protected</b>
          <em>The PDF is encrypted, and the recipient needs this password to open it.</em>
        </span>
        <button class="tgl" :class="{ on: pwProtect }" role="switch" :aria-checked="pwProtect" @click.prevent="pwProtect = !pwProtect"><i /></button>
      </label>

      <template v-if="pwProtect">
        <label class="fl">Attachment Password <i>*</i></label>
        <div class="pw">
          <input class="input" :type="showPw ? 'text' : 'password'" v-model="password" placeholder="Password" />
          <button class="eye" :title="showPw ? 'Hide' : 'Show'" @click="showPw = !showPw"><Icon name="eye" :size="15" /></button>
        </div>
      </template>
    </template>

    <footer class="pv-foot">
      <button class="btn" @click="emit('close')">Cancel</button>
      <button class="btn btn-primary" @click="share">{{ tab === 'access' ? 'Share' : 'Send PDF' }}</button>
    </footer>
  </div>
</template>

<style scoped>
.pv-back { position: fixed; inset: 0; z-index: 55; }
/* anchored directly under the Share button, right-aligned to it */
.pv { position: absolute; top: 44px; right: 0; z-index: 60; width: 420px; padding: 14px 16px 12px; }
.pv-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pv-title { font-weight: 700; font-size: 15px; color: var(--ink); }

/* the two acts, as a segmented control — our primary, not a black fill */
.tabs { display: flex; gap: 4px; margin: 12px 0 14px; padding: 3px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; }
.tab { flex: 1; height: 32px; border: none; background: transparent; color: var(--muted); border-radius: 8px; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.tab:hover { color: var(--ink); }
.tab.on { background: var(--primary); color: #fff; box-shadow: var(--sh-sm); }

.fl { display: block; font-size: 12px; font-weight: 500; color: var(--ink-2); margin-bottom: 6px; }
/* the password label belongs to the toggle above it, but not THAT closely */
.tgl-row + .fl { margin-top: 18px; }
.fl i { color: var(--red); font-style: normal; }
.row { display: flex; align-items: center; gap: 8px; }
.grow { flex: 1; min-width: 0; }

.lvl-wrap { position: relative; flex: none; }
.lvl-btn { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 11px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); border-radius: 9px; font-size: 13px; font-weight: 500; white-space: nowrap; }
.lvl-btn:hover { background: var(--surface-2); }
.lvl-back { position: fixed; inset: 0; z-index: 61; }
.lvl-menu { position: absolute; top: calc(100% + 4px); right: 0; z-index: 62; min-width: 140px; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; box-shadow: var(--sh-pop); padding: 5px; }
.lvl-opt { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 9px; border: none; background: transparent; border-radius: 7px; font-size: 13px; color: var(--ink-2); text-align: left; }
.lvl-opt:hover { background: var(--surface-2); }
.lvl-opt.on { color: var(--primary-700); font-weight: 600; }

/* one address per row, with the [+] as the only affordance when nothing is being typed */
.emails { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.erow { display: flex; align-items: center; gap: 6px; width: 100%; }
.erow .input { flex: 1; min-width: 0; }
.eaddr { flex: 1; min-width: 0; height: 34px; display: flex; align-items: center; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); font-size: 12.5px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex { flex: none; width: 28px; height: 28px; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.ex:hover { background: var(--surface-2); color: var(--red); }
.add-btn { flex: none; width: 34px; height: 34px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--primary-700); border-radius: 8px; display: grid; place-items: center; }
.add-btn:hover { background: var(--primary-soft); border-color: var(--primary); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip { display: inline-flex; align-items: center; gap: 5px; background: var(--primary-soft); color: var(--primary-700); border-radius: 6px; padding: 3px 8px; font-size: 12px; }
.chip button { border: none; background: transparent; color: var(--primary-700); display: grid; place-items: center; }

.tgl-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 14px 0 0; cursor: pointer; }
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
