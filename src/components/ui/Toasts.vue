<script setup>
import { store, dismissToast } from '../../store/index.js'
import Icon from './Icon.vue'
const ic = { success: 'check', warn: 'archive', danger: 'trash', info: 'info' }
function runAction(t) { t.action?.fn?.(); dismissToast(t.id) }
</script>

<template>
  <div class="toasts">
    <transition-group name="toast">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.kind">
        <Icon :name="ic[t.kind] || 'info'" :size="16" />
        <span>{{ t.message }}</span>
        <button v-if="t.action" class="toast-act" @click="runAction(t)">{{ t.action.label }}</button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toasts { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 200; display: flex; flex-direction: column; gap: 8px; align-items: center; }
.toast { display: flex; align-items: center; gap: 9px; background: #20223a; color: #fff; padding: 10px 15px; border-radius: 10px; box-shadow: var(--sh-pop); font-size: 13.5px; font-weight: 500; }
.toast.success { background: #11724a; }
.toast.warn { background: #9a6207; }
.toast.danger { background: #b3271d; }
.toast-act { margin-left: 4px; border: none; background: rgba(255,255,255,.16); color: #fff; font-weight: 600; font-size: 12.5px; padding: 4px 10px; border-radius: 7px; cursor: pointer; }
.toast-act:hover { background: rgba(255,255,255,.28); }
.toast-enter-active, .toast-leave-active { transition: all .22s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(10px); }
</style>
