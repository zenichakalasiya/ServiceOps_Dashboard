<script setup>
// Google Material Symbols (Rounded). Same API as before: <Icon name="…" :size="…" />.
import { computed } from 'vue'
const props = defineProps({
  name: String,
  size: { type: [Number, String], default: 18 },
  strokeWidth: { type: [Number, String], default: 2 }, // kept for API compat (unused)
})

// our icon names → Material Symbols ligatures
const MAP = {
  plus: 'add', search: 'search', star: 'star', 'star-fill': 'star',
  folder: 'folder', 'folder-open': 'folder_open', clock: 'schedule', refresh: 'refresh',
  share: 'share', link: 'link', copy: 'content_copy', edit: 'edit', trash: 'delete',
  archive: 'archive', restore: 'restore', 'dots-v': 'more_vert', 'dots-h': 'more_horiz',
  fullscreen: 'fullscreen', info: 'info', 'chevron-down': 'keyboard_arrow_down',
  'chevron-right': 'chevron_right', 'chevron-left': 'chevron_left', grid: 'grid_view',
  list: 'format_list_bulleted', check: 'check', x: 'close', eye: 'visibility', filter: 'filter_alt',
  kpi: 'numbers', 'chart-bar': 'bar_chart', 'chart-line': 'show_chart', 'chart-pie': 'pie_chart',
  table: 'table_chart', home: 'home', layout: 'dashboard', sparkles: 'auto_awesome',
  user: 'person', users: 'group', lock: 'lock', globe: 'public', calendar: 'calendar_today',
  download: 'download', image: 'image', 'file-text': 'description', bell: 'notifications',
  settings: 'settings', 'arrow-left': 'arrow_back', pin: 'push_pin', wand: 'auto_fix_high',
  'maximize-tile': 'open_in_full', drag: 'drag_indicator', inbox: 'inbox', trend: 'trending_up',
  moon: 'dark_mode', sun: 'light_mode', calendar2: 'event', rows: 'view_list',
  template: 'dashboard_customize', alert: 'warning', package: 'inventory_2', sitemap: 'account_tree',
  bulb: 'lightbulb', 'user-check': 'how_to_reg', clipboard: 'checklist', team: 'groups',
  menu: 'menu', keyboard: 'keyboard', history: 'history', 'predefined-monitor': 'desktop_windows',
  ungroup: 'layers_clear', 'default-home': 'home_pin', 'new-group': 'create_new_folder',
  verified: 'verified', undo: 'undo', redo: 'redo',
}
const FILLED = new Set(['star-fill'])

const ligature = computed(() => MAP[props.name] || props.name || '')
const px = computed(() => (typeof props.size === 'number' ? props.size : parseFloat(props.size) || 18))
const opsz = computed(() => Math.max(20, Math.min(48, px.value)))
const styleVar = computed(() => ({
  fontSize: px.value + 'px',
  fontVariationSettings: `'FILL' ${FILLED.has(props.name) ? 1 : 0}, 'wght' 300, 'GRAD' 0, 'opsz' ${opsz.value}`,
}))
</script>

<template>
  <span class="material-symbols-rounded ico" :style="styleVar" aria-hidden="true">{{ ligature }}</span>
</template>
