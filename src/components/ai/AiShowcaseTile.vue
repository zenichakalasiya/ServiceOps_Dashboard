<script setup>
/**
 * AiShowcaseTile — a read-only tile renderer for the AI Capabilities showcase.
 * Deliberately lighter than WidgetCard (no drag / edit / ⋯ menu) so the AI
 * affordances (anomaly badge, citation highlight ring) can be layered on cleanly.
 * Charts reuse the real ChartTile; KPI/table markup mirrors WidgetCard's look.
 */
import ChartTile from '../dashboard/ChartTile.vue'
import Icon from '../ui/Icon.vue'

defineProps({
  tile: Object,
  highlight: Boolean,   // citation → ring the referenced tile (Power BI footnote pattern)
  dim: Boolean,         // de-emphasise the non-cited tiles while a citation is active
  alert: String,        // 'warn' | 'bad' → anomaly ring while the Anomaly tab is active
})

// same status/priority → pill mapping as WidgetCard
function pillClass(v) {
  const s = String(v).toLowerCase().trim()
  if (['open', 'pending', 'to do', 'new', 'assigned'].includes(s)) return 'pill pill-blue'
  if (['in progress', 'active', 'running', 'on hold', 'watch'].includes(s)) return 'pill pill-amber'
  if (['resolved', 'closed', 'done', 'completed', 'compliant'].includes(s)) return 'pill pill-green'
  if (['expired', 'breached', 'overdue', 'failed', 'critical'].includes(s)) return 'pill pill-red'
  const m = s.match(/^p([1-4])$/)
  if (m) return 'pill pill-p' + m[1]
  return ''
}
const STATUS_CLASS = { good: 'good', warn: 'warn', bad: 'bad' }
</script>

<template>
  <div class="tile card" :class="{ hl: highlight, dim, ['alert-' + alert]: alert, ['span-' + (tile.w || 3)]: true, ['rows-' + (tile.h || 1)]: true }">
    <header class="thead">
      <div class="left">
        <span class="title ellip">{{ tile.title }}</span>
        <span v-if="tile.info" class="info" :title="tile.info"><Icon name="info" :size="13" /></span>
      </div>
      <!-- AI affordance slot (anomaly badge) -->
      <div class="right"><slot name="badge" /></div>
    </header>

    <div class="tbody">
      <template v-if="tile.type === 'kpi'">
        <div class="kpi">
          <div class="kpinum">{{ tile.value }}<span v-if="tile.unit" class="unit">{{ tile.unit }}</span></div>
          <div v-if="tile.delta" class="delta" :class="STATUS_CLASS[tile.status]">
            <Icon :name="tile.delta.dir === 'up' ? 'sort-asc' : 'sort-desc'" :size="13" />
            {{ tile.delta.pct }}%
          </div>
        </div>
      </template>

      <template v-else-if="tile.type === 'chart'">
        <ChartTile :chart="tile.chart" :legend="true" :height="tile.h > 1 ? 168 : 116" />
      </template>

      <template v-else>
        <div class="stbl">
          <table>
            <thead><tr><th v-for="c in tile.columns" :key="c">{{ c }}</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in tile.rows.slice(0, 6)" :key="i">
                <td v-for="(cell, j) in r" :key="j">
                  <span v-if="pillClass(cell)" :class="pillClass(cell)">{{ cell }}</span>
                  <span v-else-if="/^[A-Z]{2,4}-\d/.test(String(cell))" class="id-link">{{ cell }}</span>
                  <template v-else>{{ cell }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tile { display: flex; flex-direction: column; overflow: hidden; min-height: 128px; transition: box-shadow .18s ease, opacity .18s ease, transform .18s ease; }
/* citation ring — the referenced tile lights up when a Focus line is hovered */
.tile.hl { box-shadow: 0 0 0 2px var(--primary), var(--sh); }
.tile.dim { opacity: .45; }
/* anomaly ring — the flagged tile stands out while the Anomaly tab is active */
.tile.alert-warn { box-shadow: 0 0 0 2px var(--amber), var(--sh); }
.tile.alert-bad { box-shadow: 0 0 0 2px var(--red), var(--sh); }
.thead { display: flex; align-items: center; justify-content: space-between; padding: 10px 10px 2px 12px; gap: 8px; min-height: 30px; }
.left { display: flex; align-items: center; gap: 6px; min-width: 0; }
.title { font-weight: 600; font-size: 13.5px; }
.info { color: var(--muted-2); display: inline-grid; place-items: center; cursor: help; }
.info:hover { color: var(--primary); }
.right { display: flex; align-items: center; gap: 4px; flex: none; }
.tbody { flex: 1; padding: 10px 14px 14px; display: flex; flex-direction: column; min-height: 0; }
/* KPI */
.kpi { display: flex; flex-direction: column; justify-content: center; align-items: center; flex: 1; text-align: center; gap: 6px; }
.kpinum { font-size: 42px; font-weight: 500; letter-spacing: -1px; line-height: 1; }
.kpinum .unit { font-size: 18px; font-weight: 600; color: var(--muted); margin-left: 2px; }
.delta { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: var(--r-pill); }
.delta.good { color: var(--green); background: var(--green-soft); }
.delta.warn { color: var(--amber); background: var(--amber-soft); }
.delta.bad { color: var(--red); background: var(--red-soft); }
/* table */
.stbl { flex: 1; overflow: auto; min-height: 0; }
table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
th { text-align: left; font-weight: 600; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .3px; padding: 4px 8px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); }
td { padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
tr:last-child td { border-bottom: none; }
.id-link { color: var(--primary-700); font-weight: 600; }
.pill { display: inline-flex; align-items: center; height: 20px; padding: 0 9px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.pill-blue { background: var(--blue-soft); color: var(--blue); }
.pill-amber { background: var(--amber-soft); color: var(--amber); }
.pill-green { background: var(--green-soft); color: var(--green); }
.pill-red { background: var(--red-soft); color: var(--red); }
.pill-p1 { background: var(--red-soft); color: var(--red); }
.pill-p2 { background: var(--amber-soft); color: var(--amber); }
.pill-p3 { background: var(--blue-soft); color: var(--blue); }
.pill-p4 { background: var(--surface-2); color: var(--muted); }
</style>
