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
  // legacy paths redirect to the default board (listing is now the left flyout)
  { path: '/dashboards', redirect: () => defaultBoard() },
  { path: '/all', redirect: () => defaultBoard() },
]

export default createRouter({ history: createWebHashHistory(), routes })
