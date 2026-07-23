<script setup>
/**
 * ModuleStub — placeholder content for a non-dashboard module.
 *
 * The Dashboards prototype has no real Requests/Assets/… pages. This stub keeps the shell
 * coherent: the two sidebars work, the content header carries the same listing-collapse
 * toggle as the dashboard, and the body echoes the selected view/submodule so the
 * left-sidebar interaction reads as real.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '../components/ui/Icon.vue'
import { store } from '../store/index.js'
import { moduleByKey } from '../data/modules.js'
const route = useRoute()
const mod = computed(() => moduleByKey(route.params.key))
const selected = computed(() => (mod.value.kind === 'views' ? store.ui.activeView : store.ui.activeSub))
</script>

<template>
  <div class="stub">
    <header class="sh">
      <button class="sh-toggle" :title="store.ui.listingOpen ? 'Collapse listing' : 'Expand listing'"
        @click="store.ui.listingOpen = !store.ui.listingOpen">
        <Icon :name="store.ui.listingOpen ? 'panel-close' : 'panel-left'" :size="18" />
      </button>
      <h1>{{ mod.label }}</h1>
      <span v-if="selected" class="sh-view">{{ selected }}</span>
    </header>
    <div class="sh-body">
      <span class="sh-orb"><Icon :name="mod.icon" :size="30" /></span>
      <h2>{{ selected || mod.title }}</h2>
      <p>
        This is the <b>{{ mod.label }}</b> module. Its content isn’t part of the Dashboards
        prototype — but the <b>module sidebar</b> and the <b>{{ mod.kind === 'views' ? 'filter-based view' : 'sub-module' }} listing</b>
        on the left are the real thing. Pick an item on the left to switch the view.
      </p>
    </div>
  </div>
</template>

<style scoped>
.stub { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.sh { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--surface); }
.sh-toggle { width: 34px; height: 34px; border: 1px solid var(--border); background: var(--surface); color: var(--ink-2); border-radius: 9px; display: grid; place-items: center; }
.sh-toggle:hover { background: var(--surface-2); color: var(--ink); border-color: var(--border-strong); }
.sh h1 { margin: 0; font-size: 18px; font-weight: 600; }
.sh-view { font-size: 14px; color: var(--muted); }
.sh-view::before { content: '·'; margin-right: 10px; color: var(--muted-2); }
.sh-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 40px; color: var(--muted); }
.sh-orb { width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center; background: var(--surface-2); color: var(--muted); }
.sh-body h2 { margin: 4px 0 0; font-size: 20px; color: var(--ink); font-weight: 600; }
.sh-body p { margin: 0; max-width: 52ch; font-size: 14px; line-height: 1.6; }
</style>
