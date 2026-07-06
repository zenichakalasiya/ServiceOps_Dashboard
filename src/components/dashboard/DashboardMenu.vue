<script setup>
import { ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { store, markDefault, archiveDashboard } from '../../store/index.js'
const props = defineProps({ d: Object, align: { type: String, default: 'right' } })
const emit = defineEmits(['present'])
const open = ref(false)
function act(fn) { open.value = false; fn() }
</script>

<template>
  <div class="wrap">
    <button class="btn btn-icon" :class="{ on: open }" @click.stop="open = !open" title="Actions">
      <Icon name="dots-v" :size="18" />
    </button>
    <div v-if="open" class="backdrop" @click="open = false" />
    <transition name="pop">
      <div v-if="open" class="menu" :class="align" @click.stop>
        <button class="menu-item" @click="act(() => { store.ui.cloneTarget = null; store.ui.editTarget = d; store.ui.createOpen = true })"><Icon name="edit" :size="16" /> Edit</button>
        <button class="menu-item" @click="act(() => emit('present'))"><Icon name="maximize-tile" :size="16" /> Present</button>
        <button class="menu-item" @click="act(() => { store.ui.cloneTarget = d; store.ui.createOpen = true })"><Icon name="copy" :size="16" /> Clone</button>
        <button class="menu-item" @click="act(() => markDefault(d))"><Icon name="pin" :size="16" /> Mark as default landing</button>
        <div class="menu-sep" />
        <button class="menu-item danger" @click="act(() => archiveDashboard(d))"><Icon name="archive" :size="16" /> Delete / Archive</button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.wrap { position: relative; }
.btn-icon.on { background: var(--surface-2); color: var(--ink); }
.backdrop { position: fixed; inset: 0; z-index: 55; }
.menu { top: 38px; }
.menu-item:disabled { opacity: .45; cursor: not-allowed; }
.menu.right { right: 0; }
.menu.left { left: 0; }
</style>
