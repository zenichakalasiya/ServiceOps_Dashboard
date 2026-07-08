<script setup>
import { ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { toast } from '../../store/index.js'
const props = defineProps({ d: Object })
const emit = defineEmits(['close'])

const ACCESS_LABEL = { view: 'Can view', edit: 'Can edit' }
const people = ref([])
const newPerson = ref('')
const notify = ref(false)
const accessLevel = ref('view')   // access granted to newly added technicians/groups
const linkLevel = ref('view')     // access granted to anyone with the link
const accMenu = ref(false)
const linkMenu = ref(false)

function addPerson() { const p = newPerson.value.trim(); if (p) { people.value.push({ name: p, level: accessLevel.value }); newPerson.value = '' } }
function removePerson(i) { people.value.splice(i, 1) }
function setAcc(l) { accessLevel.value = l; accMenu.value = false }
function setLink(l) { linkLevel.value = l; linkMenu.value = false }
function copyLink() {
  const url = `${location.origin}${location.pathname}#/dashboard/${props.d.id}`
  navigator.clipboard?.writeText(url).catch(() => {})
  toast(`Link copied — people with the link ${linkLevel.value === 'edit' ? 'can edit' : 'can view'}`)
  emit('close')
}
</script>

<template>
  <div class="pv-back" @click="emit('close')" />
  <div class="pv card" @click.stop>
    <div class="pv-head">
      <div class="pv-titles">
        <span class="pv-title">Share Dashboard</span>
        <span class="pv-sub ellip">{{ d.name }}</span>
      </div>
      <button class="ic" title="Close" @click="emit('close')"><Icon name="x" :size="17" /></button>
    </div>
    <div class="sep" />

    <!-- Share access: technicians / groups -->
    <div class="sec-h"><Icon name="users" :size="15" /> Share access <Icon name="info" :size="13" class="muted" /></div>
    <div class="acc-row">
      <div class="acc-input">
        <input v-model="newPerson" placeholder="Add technicians and groups…" @keyup.enter="addPerson" />
        <Icon name="chevron-down" :size="14" class="muted" />
      </div>
      <div class="lvl-wrap">
        <button class="lvl-btn" @click="accMenu = !accMenu"><Icon name="eye" :size="14" /> {{ ACCESS_LABEL[accessLevel] }} <Icon name="chevron-down" :size="13" /></button>
        <div v-if="accMenu" class="lvl-back" @click.stop="accMenu = false" />
        <div v-if="accMenu" class="lvl-menu">
          <button class="lvl-opt" :class="{ on: accessLevel === 'view' }" @click="setAcc('view')"><Icon name="eye" :size="14" /> Can view</button>
          <button class="lvl-opt" :class="{ on: accessLevel === 'edit' }" @click="setAcc('edit')"><Icon name="edit" :size="14" /> Can edit</button>
        </div>
      </div>
    </div>
    <div v-if="people.length" class="people">
      <span v-for="(p, i) in people" :key="i" class="pchip"><Icon name="user" :size="11" /> {{ p.name }} · {{ ACCESS_LABEL[p.level] }} <button @click="removePerson(i)"><Icon name="x" :size="10" /></button></span>
    </div>
    <label class="notify"><input type="checkbox" v-model="notify" /> Notify people</label>

    <div class="sep" />

    <!-- Share link: anyone with the link -->
    <div class="sec-h"><Icon name="link" :size="15" /> Share link <Icon name="info" :size="13" class="muted" /></div>
    <p class="link-txt">People in your environment with the link</p>
    <div class="link-row">
      <div class="lvl-wrap">
        <button class="lvl-btn" @click="linkMenu = !linkMenu"><Icon name="eye" :size="14" /> {{ ACCESS_LABEL[linkLevel] }} <Icon name="chevron-down" :size="13" /></button>
        <div v-if="linkMenu" class="lvl-back" @click.stop="linkMenu = false" />
        <div v-if="linkMenu" class="lvl-menu">
          <button class="lvl-opt" :class="{ on: linkLevel === 'view' }" @click="setLink('view')"><Icon name="eye" :size="14" /> Can view</button>
          <button class="lvl-opt" :class="{ on: linkLevel === 'edit' }" @click="setLink('edit')"><Icon name="edit" :size="14" /> Can edit</button>
        </div>
      </div>
      <div class="grow" />
      <button class="copy-btn" @click="copyLink"><Icon name="copy" :size="14" /> Copy link</button>
    </div>
  </div>
</template>

<style scoped>
.pv-back { position: fixed; inset: 0; z-index: 55; }
.pv { position: absolute; top: 44px; right: 0; z-index: 60; width: 380px; padding: 16px; }
.pv-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.pv-titles { display: flex; flex-direction: column; min-width: 0; }
.pv-title { font-weight: 700; font-size: 15px; color: var(--ink); }
.pv-sub { font-size: 12px; color: var(--muted); margin-top: 1px; }
.ic { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 8px; display: grid; place-items: center; flex: none; }
.ic:hover { background: var(--surface-2); color: var(--ink); }
.sep { height: 1px; background: var(--border); margin: 12px 0; }
.sec-h { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 14px; color: var(--ink); margin-bottom: 10px; }
.sec-h .muted { color: var(--muted-2); }
/* share access row: input + level */
.acc-row { display: flex; gap: 8px; }
.acc-input { flex: 1; display: flex; align-items: center; gap: 6px; border: 1px solid var(--border-strong); border-radius: 9px; padding: 0 10px; height: 38px; background: var(--surface-2); }
.acc-input input { border: none; outline: none; background: transparent; flex: 1; font-size: 13px; }
.lvl-wrap { position: relative; flex: none; }
.lvl-btn { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 11px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); border-radius: 9px; font-size: 13px; font-weight: 500; white-space: nowrap; }
.lvl-btn:hover { background: var(--surface-2); }
.lvl-back { position: fixed; inset: 0; z-index: 61; }
.lvl-menu { position: absolute; top: calc(100% + 4px); right: 0; z-index: 62; min-width: 140px; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; box-shadow: var(--sh-pop); padding: 5px; }
.lvl-opt { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 9px; border: none; background: transparent; border-radius: 7px; font-size: 13px; color: var(--ink-2); text-align: left; }
.lvl-opt:hover { background: var(--surface-2); }
.lvl-opt.on { color: var(--primary-700); font-weight: 600; }
.people { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.pchip { display: inline-flex; align-items: center; gap: 5px; background: var(--primary-soft); color: var(--primary-700); border-radius: 6px; padding: 3px 8px; font-size: 12px; }
.pchip button { border: none; background: transparent; color: var(--primary-700); display: grid; place-items: center; }
.notify { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.notify input { width: 16px; height: 16px; accent-color: var(--primary); }
/* share link */
.link-txt { font-size: 13px; color: var(--ink-2); margin: 0 0 10px; }
.link-row { display: flex; align-items: center; gap: 8px; }
.copy-btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; border: none; background: var(--primary); color: #fff; border-radius: 9px; font-weight: 600; font-size: 13px; }
.copy-btn:hover { background: var(--primary-600); }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
