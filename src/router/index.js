import { createRouter, createWebHashHistory } from 'vue-router'
import { store } from '../store/index.js'

function defaultBoard() {
  const d = store.dashboards.find((x) => x.default && !x.archived) || store.dashboards.find((x) => !x.archived)
  return d ? `/dashboard/${d.id}` : '/archive'
}

const routes = [
  { path: '/', redirect: () => defaultBoard() },
  { path: '/archive', name: 'archive', component: () => import('../views/ArchivePage.vue') },
  { path: '/dashboard/:id', name: 'dashboard', component: () => import('../views/DashboardView.vue'), props: true },
  // full management listing (opened from the left drawer's entry points)
  { path: '/dashboards', name: 'manage', component: () => import('../views/ManageDashboards.vue') },
  { path: '/all', redirect: '/dashboards' },
]

export default createRouter({ history: createWebHashHistory(), routes })
