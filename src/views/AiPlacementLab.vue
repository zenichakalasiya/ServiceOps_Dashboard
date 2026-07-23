<script setup>
/**
 * AiPlacementLab — a lab page to compare three placements of the AI-insights entry point
 * over the REAL Helpdesk Overview board, with a segmented switcher and a live readout.
 *
 * Increment 1 (this pass): the frame, the shared panel, the live readout, and Variant C
 * (baseline banner). Variants A (header chip + popover) and B (KPI tile) land next.
 *
 * Docking: the panel is a flex SIBLING of the content column, so opening it PUSHES the
 * board narrower rather than overlaying it (the Variant-A requirement). Real WidgetCard
 * components render every tile — the dashboard itself is not rebuilt.
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import Icon from '../components/ui/Icon.vue'
import WidgetCard from '../components/dashboard/WidgetCard.vue'
import AiSummaryCard from '../components/ai/AiSummaryCard.vue'
import AiInsightsPanel from '../components/ai/AiInsightsPanel.vue'
import { store } from '../store/index.js'

const VARIANTS = [
  { id: 'A', label: 'Header chip + popover' },
  { id: 'B', label: 'First KPI tile' },
  { id: 'C', label: 'Current banner (baseline)' },
]
const variant = ref('C')

// the real board — reuse its tiles, don't rebuild them
const board = computed(() => store.dashboards.find((d) => d.name === 'Helpdesk Overview') || store.dashboards[0])
const tiles = computed(() => board.value?.tiles || [])

// ---- the shared panel (open/pinned persist per user via store.ui) ----
const panelOpen = computed(() => store.ui.aiInsightsOpen)
let trigger = null
function openPanel() { trigger = document.activeElement; store.ui.aiInsightsOpen = true }
function closePanel() { store.ui.aiInsightsOpen = false }

// ---- live readout: px above the KPI row, and whether widget row 3 clears a 900px fold ----
const aboveEl = ref(null)
const gridEl = ref(null)
const frameEl = ref(null)
const pxAbove = ref(0)
const row3Top = ref(0)
const row3Clears = ref(true)
const FOLD = 900

function measure() {
  if (!aboveEl.value || !gridEl.value || !frameEl.value) return
  pxAbove.value = Math.round(aboveEl.value.getBoundingClientRect().height)
  const frameTop = frameEl.value.getBoundingClientRect().top
  // distinct visual rows = distinct rounded top offsets of the tiles
  const tops = [...gridEl.value.querySelectorAll('.tile')]
    .map((el) => Math.round(el.getBoundingClientRect().top - frameTop))
  const rows = [...new Set(tops)].sort((a, b) => a - b)
  const t = rows[2]   // the third visual row
  row3Top.value = t == null ? 0 : t
  row3Clears.value = t != null && t <= FOLD
}

let ro
onMounted(() => {
  ro = new ResizeObserver(() => measure())
  if (frameEl.value) ro.observe(frameEl.value)
  if (gridEl.value) ro.observe(gridEl.value)
  nextTick(measure)
})
onBeforeUnmount(() => ro?.disconnect())
watch([variant, panelOpen], () => nextTick(measure))
</script>

<template>
  <div class="lab">
    <!-- switcher + readout live OUTSIDE the dashboard frame -->
    <div class="lab-bar">
      <div class="seg" role="group" aria-label="Placement variant">
        <button
          v-for="v in VARIANTS" :key="v.id" class="seg-b" :class="{ on: variant === v.id }"
          :aria-pressed="variant === v.id" @click="variant = v.id"
        ><b>{{ v.id }}</b> {{ v.label }}</button>
      </div>
      <div class="readout">
        <span class="ro"><span class="ro-k">Above KPI row</span><span class="ro-v">{{ pxAbove }}px</span></span>
        <span class="ro"><span class="ro-k">Widget row 3 top</span><span class="ro-v">{{ row3Top }}px</span></span>
        <span class="ro-verdict" :class="row3Clears ? 'ok' : 'bad'">
          <Icon :name="row3Clears ? 'check' : 'x'" :size="13" />
          row 3 {{ row3Clears ? 'clears' : 'below' }} the 900px fold
        </span>
      </div>
    </div>

    <!-- content column | panel (flex siblings → the panel pushes) -->
    <div class="lab-stage">
      <div ref="frameEl" class="frame" :class="{ pushed: panelOpen }">
        <div ref="aboveEl" class="above">
          <!-- dashboard header row; Variant A's chip will sit here, left of the ⋮ -->
          <header class="fhead">
            <h1>{{ board?.name }}</h1>
            <div class="fhead-actions">
              <span v-if="variant !== 'C'" class="soon">Variant {{ variant }} — chip / tile arrives next</span>
              <button class="fh-ic" title="More"><Icon name="dots-v" :size="17" /></button>
            </div>
          </header>

          <!-- Variant C: the current banner, minus "Add a new widget"; its CTAs open the panel -->
          <AiSummaryCard v-if="variant === 'C'" :board="board" hide-add-widget @ask="openPanel" />
        </div>

        <!-- real tiles in a 12-col grid; WidgetCard carries its own span-{w} class -->
        <div ref="gridEl" class="grid">
          <WidgetCard v-for="t in tiles" :key="t.id" :tile="t" />
        </div>
      </div>

      <div class="panel-slot" :class="{ open: panelOpen }">
        <AiInsightsPanel
          :open="panelOpen" v-model:pinned="store.ui.aiInsightsPinned"
          :return-focus-to="trigger" @close="closePanel"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg); }
/* switcher bar */
.lab-bar { display: flex; align-items: center; gap: 16px 24px; flex-wrap: wrap; padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--surface); }
.seg { display: inline-flex; gap: 3px; background: var(--surface-2); padding: 3px; border-radius: 9px; border: 1px solid var(--border); }
.seg-b { border: none; background: transparent; padding: 6px 13px; border-radius: 7px; font-size: 12.5px; font-weight: 500; color: var(--muted); display: inline-flex; align-items: center; gap: 6px; }
.seg-b b { color: var(--ink-2); }
.seg-b:hover { color: var(--ink); }
.seg-b.on { background: var(--surface); color: var(--primary-700); box-shadow: var(--sh-sm); font-weight: 600; }
.seg-b.on b { color: var(--primary-700); }
/* readout */
.readout { display: flex; align-items: center; gap: 16px; margin-left: auto; font-family: var(--mono, ui-monospace, monospace); }
.ro { display: flex; align-items: baseline; gap: 6px; }
.ro-k { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted-2); }
.ro-v { font-size: 14px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
.ro-verdict { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
.ro-verdict.ok { background: var(--green-soft); color: var(--green); }
.ro-verdict.bad { background: var(--red-soft); color: var(--red); }

/* stage = content | panel */
.lab-stage { flex: 1; display: flex; min-height: 0; }
.frame { flex: 1; min-width: 0; overflow: auto; padding: 16px 20px 40px; }
.above { display: flex; flex-direction: column; }
.fhead { display: flex; align-items: center; gap: 12px; padding: 4px 2px 14px; }
.fhead h1 { flex: 1; margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -.015em; }
.fhead-actions { display: flex; align-items: center; gap: 10px; }
.soon { font-size: 11.5px; color: var(--muted-2); font-style: italic; }
.fh-ic { width: 32px; height: 32px; border: none; background: transparent; color: var(--muted); border-radius: 8px; display: grid; place-items: center; }
.fh-ic:hover { background: var(--surface-2); color: var(--ink); }

/* the 12-col grid, mirroring the real dashboard's tile sizing + reflow */
.grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 14px; align-items: start; }
.grid :deep(.span-2) { grid-column: span 2; }
.grid :deep(.span-3) { grid-column: span 3; }
.grid :deep(.span-4) { grid-column: span 4; }
.grid :deep(.span-6) { grid-column: span 6; }
.grid :deep(.span-12) { grid-column: span 12; }
@media (max-width: 1100px) {
  .grid :deep(.span-2) { grid-column: span 4; }
  .grid :deep(.span-3) { grid-column: span 6; }
  .grid :deep(.span-6) { grid-column: span 12; }
}

/* panel push: a flex sibling that animates its width */
.panel-slot { flex: none; width: 0; transition: width .2s ease; overflow: hidden; }
.panel-slot.open { width: 360px; }
@media (prefers-reduced-motion: reduce) { .panel-slot { transition: none; } }
@media (max-width: 720px) { .panel-slot.open { width: 100%; } .frame.pushed { display: none; } }
</style>
