<script setup>
/**
 * ModuleRail — the leftmost "module-based sidebar".
 *
 * Icon-only by default; the top toggle expands it to show labels. Modules with
 * submodules (Assets, CMDB, Patches, Packages) reveal a flyout on hover. Clicking a
 * module selects it and opens the "listing based sidebar" (ListingFlyout for Dashboard,
 * ModuleListing for the rest).
 */
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Icon from '../ui/Icon.vue'
import { store, toast } from '../../store/index.js'
import { MODULES } from '../../data/modules.js'
const router = useRouter()
const route = useRoute()

const hoverKey = ref('')                 // for the collapsed-rail tooltip
const flyout = ref(null)                 // { key, top } — the submodule flyout
let flyTimer = null

function toggleRail() { store.ui.railExpanded = !store.ui.railExpanded }

function selectModule(m) {
  store.ui.activeModule = m.key
  store.ui.listingOpen = true
  flyout.value = null
  if (m.key === 'dashboard') {
    if (!route.path.startsWith('/dashboard/')) router.push('/')
  } else {
    router.push(`/m/${m.key}`)
  }
}

function openFly(m, e) {
  clearTimeout(flyTimer)
  if (!m.submodules) { flyout.value = null; return }
  const r = e.currentTarget.getBoundingClientRect()
  flyout.value = { key: m.key, mod: m, top: Math.min(r.top, window.innerHeight - 340), left: r.right + 6 }
}
function closeFlySoon() { flyTimer = setTimeout(() => { flyout.value = null }, 160) }
function keepFly() { clearTimeout(flyTimer) }
function pickSub(m, sub) {
  store.ui.activeModule = m.key
  store.ui.listingOpen = true
  store.ui.activeSub = sub.t
  flyout.value = null
  router.push(`/m/${m.key}`)
}
</script>

<template>
  <nav class="rail" :class="{ expanded: store.ui.railExpanded }">
    <!-- expand / collapse the rail -->
    <button class="rail-toggle" :title="store.ui.railExpanded ? 'Collapse' : 'Expand'" @click="toggleRail">
      <Icon :name="store.ui.railExpanded ? 'panel-close' : 'menu'" :size="18" />
      <span v-if="store.ui.railExpanded" class="rt-label">Menu</span>
    </button>

    <div class="mods">
      <button
        v-for="m in MODULES" :key="m.key" class="mod" :class="{ active: store.ui.activeModule === m.key }"
        @click="selectModule(m)"
        @mouseenter="hoverKey = m.key; openFly(m, $event)" @mouseleave="hoverKey = ''; closeFlySoon()"
      >
        <span class="mod-ic"><Icon :name="m.icon" :size="19" /></span>
        <span v-if="store.ui.railExpanded" class="mod-nm">{{ m.label }}</span>
        <Icon v-if="store.ui.railExpanded && m.submodules" name="chevron-right" :size="14" class="mod-caret" />
        <!-- collapsed tooltip (only when the rail has no labels and the item has no flyout) -->
        <transition name="fade">
          <span v-if="!store.ui.railExpanded && hoverKey === m.key && !m.submodules" class="tip">{{ m.label }}</span>
        </transition>
      </button>
    </div>

    <!-- AI Capabilities showcase — pinned to the foot -->
    <button class="mod ai" :class="{ active: route.path === '/ai' }"
      @click="router.push('/ai')" @mouseenter="hoverKey = 'ai'" @mouseleave="hoverKey = ''">
      <span class="mod-ic"><Icon name="sparkles" :size="19" /></span>
      <span v-if="store.ui.railExpanded" class="mod-nm">AI Capabilities</span>
      <transition name="fade"><span v-if="!store.ui.railExpanded && hoverKey === 'ai'" class="tip">AI Capabilities</span></transition>
    </button>

    <!-- submodule flyout (Assets / CMDB / Patches / Packages) -->
    <teleport to="body">
      <div v-if="flyout" class="fly" :style="{ top: flyout.top + 'px', left: flyout.left + 'px' }"
        @mouseenter="keepFly" @mouseleave="closeFlySoon">
        <div class="fly-h">{{ flyout.mod.label }}</div>
        <template v-for="g in flyout.mod.submodules" :key="g.group">
          <div class="fly-g">{{ g.group }}</div>
          <button v-for="s in g.items" :key="s.t" class="fly-i" @click="pickSub(flyout.mod, s)">
            <Icon :name="s.ic || 'chevron-right'" :size="15" class="fly-ii" />
            <span class="fly-t">{{ s.t }}</span>
            <span v-if="s.n" class="fly-n">{{ s.n }}</span>
          </button>
        </template>
      </div>
    </teleport>
  </nav>
</template>

<style scoped>
/* retint the whole rail: remap the neutral tokens so every child follows, then paint it */
.rail { --surface: var(--sidebar); --surface-2: var(--sidebar-hover); --border: var(--sidebar-border); background: var(--sidebar); border-right: 1px solid var(--sidebar-border); display: flex; flex-direction: column; padding: 8px; gap: 3px; width: 56px; transition: width .16s ease; overflow: hidden; }
.rail.expanded { width: 208px; }
.rail-toggle { display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 10px; border: none; background: transparent; color: var(--muted); border-radius: 9px; margin-bottom: 4px; white-space: nowrap; }
.rail:not(.expanded) .rail-toggle { justify-content: center; padding: 0; }
.rail-toggle:hover { background: var(--surface-2); color: var(--ink); }
.rt-label { font-size: 12px; font-weight: 600; letter-spacing: .02em; color: var(--muted); }
.mods { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; overflow-x: hidden; flex: 1; }
.mods::-webkit-scrollbar { width: 5px; } .mods::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
.mod { position: relative; display: flex; align-items: center; gap: 11px; height: 40px; padding: 0 8px; border: none; background: transparent; color: var(--ink-2); border-radius: 10px; width: 100%; white-space: nowrap; }
.rail:not(.expanded) .mod { justify-content: center; padding: 0; }
.mod:hover { background: var(--surface-2); color: var(--ink); }
.mod.active { background: var(--primary-soft); color: var(--primary-700); }
.mod-ic { flex: none; display: grid; place-items: center; width: 24px; }
.mod-nm { flex: 1; text-align: left; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
.mod.active .mod-nm { font-weight: 600; }
.mod-caret { color: var(--muted-2); flex: none; }
.mod.ai { margin-top: 4px; color: var(--primary); }
.mod.ai:hover { background: var(--primary-soft); color: var(--primary-700); }
.mod.ai.active { background: var(--primary); color: #fff; }
.tip { position: absolute; left: 46px; top: 50%; transform: translateY(-50%); white-space: nowrap; background: #20223a; color: #fff; font-size: 12px; font-weight: 500; padding: 5px 9px; border-radius: 7px; box-shadow: var(--sh-pop); z-index: 90; }
/* submodule flyout */
.fly { position: fixed; z-index: 120; width: 250px; max-height: 78vh; overflow: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 11px; box-shadow: var(--sh-pop); padding: 7px; }
.fly-h { font-size: 13px; font-weight: 700; color: var(--ink); padding: 5px 8px 7px; }
.fly-g { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted-2); padding: 8px 8px 4px; }
.fly-i { display: flex; align-items: center; gap: 9px; width: 100%; border: none; background: transparent; padding: 7px 8px; border-radius: 8px; color: var(--ink-2); text-align: left; }
.fly-i:hover { background: var(--surface-2); color: var(--ink); }
.fly-ii { color: var(--muted-2); flex: none; }
.fly-t { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fly-n { flex: none; font-size: 11px; font-weight: 600; color: var(--muted); background: var(--surface-2); border-radius: 999px; padding: 1px 7px; }
</style>
