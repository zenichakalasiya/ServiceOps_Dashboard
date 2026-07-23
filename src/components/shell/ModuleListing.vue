<script setup>
/**
 * ModuleListing — the "listing based sidebar" for every NON-dashboard module.
 *
 * Two shapes, decided by the module:
 *   views       — the filter-based saved-view list (Requests, Problems, Changes …),
 *                 grouped, searchable, with counts and a pin — matching the live product's
 *                 header saved-view dropdown, but on the left.
 *   submodules  — the module's sub-nav (Assets, CMDB, Patches, Packages).
 *
 * Selecting a row sets store.ui.activeView / activeSub so the content stub can echo it.
 */
import { ref, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { store } from '../../store/index.js'
import { moduleByKey } from '../../data/modules.js'
const emit = defineEmits(['close'])

const mod = computed(() => moduleByKey(store.ui.activeModule))
const q = ref('')
const groups = computed(() => mod.value.views || mod.value.submodules || [])
const isViews = computed(() => mod.value.kind === 'views')
const filtered = computed(() => groups.value
  .map((g) => ({ ...g, items: g.items.filter((i) => i.t.toLowerCase().includes(q.value.toLowerCase())) }))
  .filter((g) => g.items.length))

const selected = computed(() => (isViews.value ? store.ui.activeView : store.ui.activeSub))
function pick(it) {
  if (isViews.value) store.ui.activeView = it.t
  else store.ui.activeSub = it.t
}
</script>

<template>
  <aside class="mlist">
    <!-- collapse is driven from the main screen's toggle now, so only the title here -->
    <div class="ml-head">
      <h2>{{ mod.title }}</h2>
    </div>
    <div class="ml-search"><Icon name="search" :size="15" class="muted" /><input v-model="q" :placeholder="`Search ${mod.label.toLowerCase()}…`" /></div>

    <div class="ml-body">
      <template v-for="g in filtered" :key="g.group">
        <div class="ml-g">{{ g.group }}</div>
        <button v-for="it in g.items" :key="it.t" class="ml-i" :class="{ on: selected === it.t }" @click="pick(it)">
          <Icon v-if="it.ic" :name="it.ic" :size="14" class="ml-ic" />
          <Icon v-else-if="it.star" name="star-fill" :size="13" class="ml-star" />
          <span v-else class="ml-dot" />
          <span class="ml-t">{{ it.t }}</span>
          <span v-if="it.n" class="ml-n">{{ it.n }}</span>
          <button class="ml-pin" title="Pin" @click.stop><Icon name="pin" :size="13" /></button>
        </button>
      </template>
      <div v-if="!filtered.length" class="ml-none">Nothing matches “{{ q }}”.</div>
    </div>

    <div class="ml-foot">
      <button><Icon name="rows" :size="15" /> Manage {{ isViews ? 'views' : mod.label.toLowerCase() }} <Icon name="chevron-right" :size="14" class="ml-fa" /></button>
    </div>
  </aside>
</template>

<style scoped>
/* retint: remap the neutral tokens so every child follows the sidebar tint */
.mlist { --surface: var(--sidebar); --surface-2: var(--sidebar-hover); --border: var(--sidebar-border); width: 300px; background: var(--sidebar); border-right: 1px solid var(--sidebar-border); display: flex; flex-direction: column; height: 100%; }
.ml-head { display: flex; align-items: center; gap: 8px; padding: 12px 8px 8px 14px; }
.ml-head h2 { flex: 1; margin: 0; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ml-x { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 8px; display: grid; place-items: center; }
.ml-x:hover { background: var(--surface-2); color: var(--ink); }
.ml-search { display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px; padding: 0 10px; height: 34px; }
.ml-search input { border: none; outline: none; background: transparent; width: 100%; font-size: 13px; color: inherit; }
.ml-body { flex: 1; overflow-y: auto; padding: 2px 8px 12px; }
.ml-body::-webkit-scrollbar { width: 6px; } .ml-body::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
.ml-g { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted-2); padding: 10px 6px 4px; }
.ml-i { display: flex; align-items: center; gap: 9px; width: 100%; border: none; background: transparent; padding: 7px 8px; border-radius: 8px; color: var(--ink-2); text-align: left; }
.ml-i:hover { background: var(--surface-2); color: var(--ink); }
.ml-i.on { background: var(--primary-soft); color: var(--primary-700); }
.ml-ic { color: var(--muted-2); flex: none; }
.ml-i.on .ml-ic { color: var(--primary); }
.ml-star { color: #f5a623; flex: none; }
.ml-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--muted-2); flex: none; margin: 0 5px; }
.ml-t { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ml-n { flex: none; font-size: 11px; font-weight: 600; color: var(--muted); background: var(--surface-2); border-radius: 999px; padding: 1px 7px; }
.ml-i.on .ml-n { background: var(--surface); color: var(--primary-700); }
.ml-pin { flex: none; width: 22px; height: 22px; border: none; background: transparent; color: var(--muted-2); border-radius: 6px; display: none; place-items: center; }
.ml-i:hover .ml-pin { display: grid; }
.ml-pin:hover { background: var(--surface); color: #f5a623; }
.ml-none { padding: 24px 12px; text-align: center; color: var(--muted); font-size: 13px; }
.ml-foot { border-top: 1px solid var(--border); padding: 8px; }
.ml-foot button { display: flex; align-items: center; gap: 9px; width: 100%; border: none; background: transparent; padding: 9px 12px; border-radius: 8px; color: var(--ink-2); font-weight: 600; font-size: 13px; }
.ml-foot button:hover { background: var(--surface-2); color: var(--ink); }
.ml-fa { margin-left: auto; color: var(--muted); }
</style>
