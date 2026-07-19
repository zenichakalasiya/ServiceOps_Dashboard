<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Icon from '../ui/Icon.vue'
import { store, toast } from '../../store/index.js'
const router = useRouter()
const route = useRoute()
// ServiceOps modules, mirrored from the live .185 module rail.
const modules = [
  { key: 'dashboard', label: 'Dashboard', icon: 'layout', active: true },
  { key: 'requests', label: 'Requests', icon: 'inbox' },
  { key: 'problems', label: 'Problems', icon: 'alert' },
  { key: 'changes', label: 'Changes', icon: 'refresh' },
  { key: 'releases', label: 'Releases', icon: 'package' },
  { key: 'cmdb', label: 'CMDB', icon: 'sitemap' },
  { key: 'projects', label: 'Projects', icon: 'grid' },
  { key: 'knowledge', label: 'Knowledge', icon: 'bulb' },
  { key: 'reports', label: 'Reports', icon: 'file-text' },
  { key: 'approvals', label: 'My Approvals', icon: 'user-check' },
  { key: 'tasks', label: 'My Tasks', icon: 'clipboard' },
  { key: 'team', label: 'My Team', icon: 'team' },
]
const hover = ref('')
function go(m) { if (!m.active) toast(`${m.label} is outside this dashboards prototype`) }
</script>

<template>
  <nav class="rail">
    <!-- Expand-dashboards toggle: lives here only while the left panel is collapsed -->
    <transition name="fade">
      <button v-if="!store.ui.listingOpen" class="expand" title="Open dashboards panel"
        @click="store.ui.listingOpen = true" @mouseenter="hover = 'expand'" @mouseleave="hover = ''">
        <Icon name="chevron-right" :size="18" />
        <transition name="fade"><span v-if="hover === 'expand'" class="tip">Open dashboards panel</span></transition>
      </button>
    </transition>
    <div class="mods">
      <button v-for="m in modules" :key="m.key" class="mod" :class="{ active: m.active }"
        @click="go(m)" @mouseenter="hover = m.key" @mouseleave="hover = ''">
        <Icon :name="m.icon" :size="19" />
        <transition name="fade"><span v-if="hover === m.key" class="tip">{{ m.label }}</span></transition>
      </button>
    </div>
    <!-- AI Capabilities showcase — pinned to the foot of the rail, sparkle-accented -->
    <button class="mod ai" :class="{ active: route.path === '/ai' }"
      @click="router.push('/ai')" @mouseenter="hover = 'ai'" @mouseleave="hover = ''">
      <Icon name="sparkles" :size="19" />
      <transition name="fade"><span v-if="hover === 'ai'" class="tip">AI Capabilities</span></transition>
    </button>
  </nav>
</template>

<style scoped>
.rail { background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; padding: 8px 0; gap: 4px; }
.burger { width: 38px; height: 38px; border: none; background: transparent; color: var(--muted); border-radius: 9px; display: grid; place-items: center; margin-bottom: 6px; }
.burger:hover { background: var(--surface-2); color: var(--ink); }
/* expand toggle — distinct from module icons (bordered, primary tint) */
.expand { position: relative; width: 40px; height: 34px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--primary-700); border-radius: 10px; display: grid; place-items: center; margin-bottom: 6px; }
.expand:hover { background: var(--primary-soft); border-color: transparent; }
.mods { display: flex; flex-direction: column; gap: 3px; }
.mod { position: relative; width: 40px; height: 40px; border: none; background: transparent; color: var(--muted); border-radius: 10px; display: grid; place-items: center; }
.mod:hover { background: var(--surface-2); color: var(--ink); }
.mod.active { background: var(--primary-soft); color: var(--primary-700); }
/* AI showcase entry — sits at the foot of the rail, sparkle-tinted */
.mod.ai { margin-top: auto; color: var(--primary); }
.mod.ai:hover { background: var(--primary-soft); color: var(--primary-700); }
.mod.ai.active { background: var(--primary); color: #fff; }
.tip { position: absolute; left: 48px; top: 50%; transform: translateY(-50%); white-space: nowrap; background: #20223a; color: #fff; font-size: 12px; font-weight: 500; padding: 5px 9px; border-radius: 7px; box-shadow: var(--sh-pop); z-index: 90; }
</style>
