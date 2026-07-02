<script setup>
import { useRouter, useRoute } from 'vue-router'
import Icon from '../ui/Icon.vue'
import { store, live, favorites, archived } from '../../store/index.js'
const router = useRouter()
const route = useRoute()
const go = (to) => router.push(to)
const isActive = (name) => route.name === name
</script>

<template>
  <aside class="sidebar">
    <div class="brand" @click="go('/dashboards')">
      <div class="logo"><Icon name="layout" :size="18" /></div>
      <span v-if="!store.ui.sidebarCollapsed" class="brand-name">ServiceOps</span>
      <span v-if="!store.ui.sidebarCollapsed" class="brand-tag">Dashboards</span>
    </div>

    <nav class="nav">
      <button class="nav-item" :class="{ active: isActive('listing') }" @click="go('/dashboards')">
        <Icon name="home" :size="18" /><span v-if="!store.ui.sidebarCollapsed">Discover</span>
      </button>
      <button class="nav-item" :class="{ active: isActive('all') }" @click="go('/all')">
        <Icon name="grid" :size="18" /><span v-if="!store.ui.sidebarCollapsed">All Dashboards</span>
        <span v-if="!store.ui.sidebarCollapsed" class="count">{{ live.length }}</span>
      </button>
      <button class="nav-item" :class="{ active: isActive('archive') }" @click="go('/archive')">
        <Icon name="archive" :size="18" /><span v-if="!store.ui.sidebarCollapsed">Archive</span>
        <span v-if="!store.ui.sidebarCollapsed && archived.length" class="count">{{ archived.length }}</span>
      </button>
    </nav>

    <template v-if="!store.ui.sidebarCollapsed">
      <div class="sec-label">Favorites</div>
      <div class="list">
        <button v-for="d in favorites" :key="d.id" class="link" :class="{ active: route.params.id === d.id }" @click="go(`/dashboard/${d.id}`)">
          <Icon name="star-fill" :size="14" class="fav" /><span class="ellip">{{ d.name }}</span>
        </button>
        <div v-if="!favorites.length" class="empty-hint">Star a dashboard to pin it here.</div>
      </div>

      <div class="sec-label">Folders</div>
      <div class="list">
        <button v-for="f in store.folders" :key="f.id" class="link" @click="go({ path: '/dashboards', query: { folder: f.id } })">
          <span class="dot" :style="{ background: f.color }" /><span class="ellip">{{ f.name }}</span>
          <span class="count">{{ live.filter(d => d.folder === f.id).length }}</span>
        </button>
      </div>
    </template>

    <div class="spacer" />
    <button class="nav-item collapse" @click="store.ui.sidebarCollapsed = !store.ui.sidebarCollapsed">
      <Icon :name="store.ui.sidebarCollapsed ? 'chevron-right' : 'chevron-left'" :size="18" />
      <span v-if="!store.ui.sidebarCollapsed">Collapse</span>
    </button>
  </aside>
</template>

<style scoped>
.sidebar { background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 12px 10px; gap: 4px; overflow: hidden; }
.brand { display: flex; align-items: center; gap: 9px; padding: 6px 8px 12px; cursor: pointer; }
.logo { width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #fff; display: grid; place-items: center; flex: none; }
.brand-name { font-weight: 700; font-size: 15px; letter-spacing: -.2px; }
.brand-tag { font-size: 11px; color: var(--muted); font-weight: 500; }
.nav { display: flex; flex-direction: column; gap: 2px; }
.nav-item { display: flex; align-items: center; gap: 11px; height: 38px; padding: 0 10px; border-radius: 9px; border: none; background: transparent; color: var(--ink-2); font-weight: 500; font-size: 13.5px; width: 100%; }
.nav-item:hover { background: var(--surface-2); }
.nav-item.active { background: var(--primary-soft); color: var(--primary-700); }
.nav-item .count, .link .count { margin-left: auto; font-size: 11px; color: var(--muted); background: var(--surface-2); padding: 1px 7px; border-radius: 999px; font-weight: 600; }
.sec-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .6px; color: var(--muted-2); font-weight: 600; padding: 14px 10px 5px; }
.list { display: flex; flex-direction: column; gap: 1px; }
.link { display: flex; align-items: center; gap: 9px; height: 32px; padding: 0 10px; border-radius: 8px; border: none; background: transparent; color: var(--ink-2); font-size: 13px; font-weight: 500; width: 100%; text-align: left; }
.link:hover { background: var(--surface-2); }
.link.active { background: var(--primary-softer); color: var(--primary-700); }
.fav { color: #f5a623; }
.dot { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.empty-hint { font-size: 12px; color: var(--muted-2); padding: 4px 10px; }
.spacer { flex: 1; }
.collapse { color: var(--muted); }
</style>
