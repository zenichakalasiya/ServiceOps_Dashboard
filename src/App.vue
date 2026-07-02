<script setup>
import { watchEffect } from 'vue'
import ModuleRail from './components/shell/ModuleRail.vue'
import ListingFlyout from './components/dashboard/ListingFlyout.vue'
import AppTopbar from './components/shell/AppTopbar.vue'
import Toasts from './components/ui/Toasts.vue'
import CreateDashboardPanel from './components/dashboard/CreateDashboardPanel.vue'
import { store } from './store/index.js'
watchEffect(() => { document.documentElement.dataset.theme = store.ui.theme })
</script>

<template>
  <div class="app">
    <AppTopbar />
    <div class="below">
      <ModuleRail />
      <transition name="slide">
        <ListingFlyout v-if="store.ui.listingOpen" @close="store.ui.listingOpen = false" />
      </transition>
      <div class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in"><component :is="Component" /></transition>
        </router-view>
      </div>
    </div>
    <Toasts />
    <transition name="fade"><CreateDashboardPanel v-if="store.ui.createOpen" /></transition>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.below { flex: 1; display: flex; min-height: 0; }
.below > .rail { width: 56px; flex: none; }
.below > .flyout { flex: none; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: auto; }
.slide-enter-active, .slide-leave-active { transition: width .18s ease, opacity .18s ease; overflow: hidden; }
.slide-enter-from, .slide-leave-to { width: 0 !important; opacity: 0; }
</style>
