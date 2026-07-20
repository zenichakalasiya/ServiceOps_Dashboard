<script setup>
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { store, toast } from '../../store/index.js'
const initials = computed(() => store.currentUser.split(' ').map((s) => s[0]).join('').slice(0, 2))
function nyi(label) { toast(`${label} — outside this dashboards prototype`) }
// The topbar sparkle is the ⑦ entry: open the dashboard AI panel (it renders on the board route).
function openAi() { store.ui.aiPanelOpen = true }
</script>

<template>
  <header class="topbar">
    <!-- Left: hamburger + motadata logo (ServiceOps style) -->
    <div class="left">
      <button class="ic" title="Menu" @click="store.ui.listingOpen = !store.ui.listingOpen"><Icon name="menu" :size="19" /></button>
      <div class="logo">
        <span class="mark"><i /><i /><i /><i /></span>
        <span class="word">motadata</span>
      </div>
    </div>

    <!-- Right: Ask AI · + (Create) · calendar · bell · history · settings · keyboard · info · avatar -->
    <div class="right">
      <button class="askai" @click="openAi"><Icon name="sparkles" :size="15" /> Ask AI</button>
      <button class="plus" title="Create Dashboard" @click="store.ui.cloneTarget = null; store.ui.editTarget = null; store.ui.createOpen = true"><Icon name="plus" :size="20" /></button>
      <button class="ic" title="Calendar" @click="nyi('Calendar')"><Icon name="calendar2" :size="18" /></button>
      <button class="ic" title="Notifications"><Icon name="bell" :size="18" /></button>
      <button class="ic" title="History" @click="nyi('History')"><Icon name="history" :size="18" /></button>
      <button class="ic" title="Settings" @click="nyi('Settings')"><Icon name="settings" :size="18" /></button>
      <button class="ic" title="Keyboard shortcuts" @click="nyi('Keyboard shortcuts')"><Icon name="keyboard" :size="18" /></button>
      <button class="ic" :title="store.ui.theme === 'dark' ? 'Light mode' : 'Dark mode'" @click="store.ui.theme = store.ui.theme === 'dark' ? 'light' : 'dark'">
        <Icon :name="store.ui.theme === 'dark' ? 'sun' : 'moon'" :size="18" />
      </button>
      <button class="ic" title="Info" @click="nyi('Info')"><Icon name="info" :size="18" /></button>
      <div class="avatar" :title="store.currentUser">{{ initials }}</div>
    </div>
  </header>
</template>

<style scoped>
.topbar { height: var(--topbar-h); border-bottom: 1px solid var(--border); background: var(--surface); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; flex: none; }
.left { display: flex; align-items: center; gap: 10px; }
.logo { display: flex; align-items: center; gap: 9px; }
.mark { display: grid; grid-template-columns: 6px 6px; gap: 3px; }
.mark i { width: 6px; height: 6px; border-radius: 50%; }
.mark i:nth-child(1) { background: #3d8bd0; } .mark i:nth-child(2) { background: #16b1c4; }
.mark i:nth-child(3) { background: #3279be; } .mark i:nth-child(4) { background: #25b0a8; }
.word { font-weight: 700; font-size: 19px; letter-spacing: -.5px; color: var(--ink); }
.right { display: flex; align-items: center; gap: 6px; }
.ic { width: 36px; height: 36px; border: none; background: transparent; color: var(--muted); border-radius: 9px; display: grid; place-items: center; }
.ic:hover { background: var(--surface-2); color: var(--ink); }
.askai { display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 13px; border-radius: var(--r-pill); border: 1px solid var(--ai-border); background: var(--ai-grad-soft); color: var(--ai-ink); font-weight: 600; font-size: 13px; margin-right: 2px; }
.askai :deep(.ico) { color: var(--ai); }
.askai:hover { background: var(--ai-soft); border-color: var(--ai); }
.plus { width: 36px; height: 36px; border-radius: 10px; border: none; background: var(--primary); color: #fff; display: grid; place-items: center; box-shadow: var(--sh-sm); }
.plus:hover { background: var(--primary-600); }
.avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #fff; display: grid; place-items: center; font-size: 12.5px; font-weight: 700; margin-left: 4px; }
</style>
