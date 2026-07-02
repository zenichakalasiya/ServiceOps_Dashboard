<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import { cloneDashboard, markDefault, archiveDashboard, toast } from '../../store/index.js'
const props = defineProps({ d: Object, align: { type: String, default: 'right' } })
const emit = defineEmits(['share', 'open'])
const router = useRouter()
const open = ref(false)
function act(fn) { open.value = false; fn() }
function copyLink() {
  const url = `${location.origin}${location.pathname}#/dashboard/${props.d.id}`
  navigator.clipboard?.writeText(url).catch(() => {})
  toast('Governed link copied to clipboard')
}
</script>

<template>
  <div class="wrap">
    <button class="btn btn-icon" :class="{ on: open }" @click.stop="open = !open" title="Actions">
      <Icon name="dots-v" :size="18" />
    </button>
    <div v-if="open" class="backdrop" @click="open = false" />
    <transition name="pop">
      <div v-if="open" class="menu" :class="align" @click.stop>
        <button class="menu-item" @click="act(() => router.push(`/dashboard/${d.id}?edit=1`))"><Icon name="edit" :size="16" /> Edit</button>
        <button class="menu-item" @click="act(() => cloneDashboard(d))"><Icon name="copy" :size="16" /> Clone</button>
        <button class="menu-item" @click="act(() => markDefault(d))"><Icon name="pin" :size="16" /> Mark as default</button>
        <div class="menu-sep" />
        <button class="menu-item" @click="act(() => emit('share'))"><Icon name="share" :size="16" /> Share dashboard</button>
        <button class="menu-item" @click="act(copyLink)"><Icon name="link" :size="16" /> Copy link</button>
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
.menu.right { right: 0; }
.menu.left { left: 0; }
</style>
