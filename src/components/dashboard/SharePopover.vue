<script setup>
import { ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { toast } from '../../store/index.js'
const props = defineProps({ d: Object })
const emit = defineEmits(['close'])
const emails = ref([])
const newEmail = ref('')
const pwd = ref(false)
const password = ref('')
const showPwd = ref(false)
function copyLink() {
  const url = `${location.origin}${location.pathname}#/dashboard/${props.d.id}`
  navigator.clipboard?.writeText(url).catch(() => {})
  toast('Governed link copied to clipboard')
  emit('close')
}
function addEmail() { const e = newEmail.value.trim(); if (e) { emails.value.push(e); newEmail.value = '' } }
function removeEmail(i) { emails.value.splice(i, 1) }
function exportPdf() { toast(`Exporting “${props.d.name}” as PDF${pwd.value ? ' (password protected)' : ''}`, 'success'); emit('close') }
</script>

<template>
  <div class="pv-back" @click="emit('close')" />
  <div class="pv card" @click.stop>
    <div class="pv-head">
      <span class="pv-h-title">Share Dashboard</span>
      <button class="copylink" @click="copyLink"><Icon name="link" :size="14" /> Copy link</button>
    </div>
    <div class="sep" />
    <div class="pv-title">Export Dashboard as PDF</div>

    <label class="fld">Emails <i>*</i></label>
    <div class="emails">
      <span v-for="(e, i) in emails" :key="i" class="echip">{{ e }} <button @click="removeEmail(i)"><Icon name="x" :size="11" /></button></span>
      <input class="einput" v-model="newEmail" placeholder="add email…" @keyup.enter="addEmail" />
      <button class="eadd" @click="addEmail"><Icon name="plus" :size="14" /></button>
    </div>

    <label class="fld">Password Protected</label>
    <button class="sw" :class="{ on: pwd }" @click="pwd = !pwd"><i /></button>

    <template v-if="pwd">
      <label class="fld">Attachment Password <i>*</i></label>
      <div class="pwd-input">
        <Icon name="lock" :size="14" class="muted" />
        <input :type="showPwd ? 'text' : 'password'" v-model="password" placeholder="Attachment Password" />
        <button class="eye" @click="showPwd = !showPwd"><Icon name="eye" :size="15" /></button>
      </div>
    </template>

    <div class="btns"><button class="btn btn-sm btn-primary" @click="exportPdf">Export</button><button class="btn btn-sm" @click="emit('close')">Cancel</button></div>
  </div>
</template>

<style scoped>
.pv-back { position: fixed; inset: 0; z-index: 55; }
.pv { position: absolute; top: 44px; right: 0; z-index: 60; width: 320px; padding: 14px; }
.pv-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pv-h-title { font-weight: 700; font-size: 14px; color: var(--ink); }
.copylink { display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--primary); font-weight: 500; font-size: 13px; padding: 2px 2px; }
.copylink:hover { color: var(--primary-700); }
.sep { height: 1px; background: var(--border); margin: 10px 0 12px; }
.pv-title { font-weight: 700; font-size: 14px; color: var(--primary-700); margin-bottom: 10px; }
.fld { display: block; font-size: 12px; font-weight: 500; color: var(--ink-2); margin: 12px 0 6px; } .fld i { color: var(--red); font-style: normal; }
.fld:first-of-type { margin-top: 0; }
.emails { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border: 1px solid var(--border-strong); border-radius: var(--r); padding: 6px 8px; min-height: 38px; }
.echip { display: inline-flex; align-items: center; gap: 5px; background: var(--primary-soft); color: var(--primary-700); border-radius: 6px; padding: 2px 8px; font-size: 12px; } .echip button { border: none; background: transparent; color: var(--primary-700); display: grid; place-items: center; }
.einput { border: none; outline: none; background: transparent; flex: 1; min-width: 80px; font-size: 13px; }
.eadd { width: 26px; height: 26px; border: none; background: var(--primary); color: #fff; border-radius: 6px; display: grid; place-items: center; }
.sw { width: 40px; height: 22px; border-radius: 999px; border: none; background: var(--border-strong); position: relative; }
.sw i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: var(--sh-sm); }
.sw.on { background: var(--green); } .sw.on i { left: 20px; }
.pwd-input { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-strong); border-radius: var(--r); padding: 0 10px; height: 38px; }
.pwd-input input { border: none; outline: none; background: transparent; flex: 1; font-size: 13.5px; }
.eye { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; }
.btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>
