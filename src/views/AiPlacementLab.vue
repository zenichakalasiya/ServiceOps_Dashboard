<script setup>
/**
 * AiPlacementLab — a lab page to compare three placements of the AI-insights entry point
 * over the REAL Helpdesk Overview board, with a segmented switcher and a live readout.
 *
 * All three variants open the SAME shared panel (AiInsightsPanel):
 *   A  header chip → popover (lead insight + "N more" + two actions) → panel
 *   B  the AI card takes slot 1 of the KPI row → panel
 *   C  the current banner (baseline), minus "Add a new widget" → panel
 *
 * Docking: the panel is a flex SIBLING of the content column, so opening it PUSHES the
 * board narrower rather than overlaying it. Real WidgetCard components render every tile —
 * the dashboard itself is not rebuilt.
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import Icon from '../components/ui/Icon.vue'
import WidgetCard from '../components/dashboard/WidgetCard.vue'
import AiSummaryCard from '../components/ai/AiSummaryCard.vue'
import AiInsightsPanel from '../components/ai/AiInsightsPanel.vue'
import { store } from '../store/index.js'
import { AI_INSIGHTS, leadInsight, insightCount } from '../data/aiInsights.mock.js'

const VARIANTS = [
  { id: 'A', label: 'Header chip + popover' },
  { id: 'B', label: 'First KPI tile' },
  { id: 'C', label: 'Current banner (baseline)' },
]
const variant = ref('A')

// the real board — reuse its tiles, don't rebuild them
const board = computed(() => store.dashboards.find((d) => d.name === 'Helpdesk Overview') || store.dashboards[0])
const tiles = computed(() => board.value?.tiles || [])

const count = insightCount        // 5 — the live insight count on the chip/tile
const lead = leadInsight          // the headline insight

// a descriptive, grounded summary of the whole board (woven from the insights)
const dashSummary = computed(() => {
  const b = board.value?.name || 'This board'
  return `${b} has ${count} insights worth your attention. ${lead.title} and ${AI_INSIGHTS[1].title.toLowerCase()} are the most pressing, and ${AI_INSIGHTS[2].title.toLowerCase()}.`
})

// the three CTAs shown in Variant A's popover and Variant B's card
const CTAS = [
  { label: 'Insights with AI', icon: 'sparkles', primary: true },
  { label: 'Every widget explained', icon: 'auto-graph' },
  { label: 'Add a new widget', icon: 'plus' },
]

// ---- the shared panel (open/pinned persist per user via store.ui) ----
const panelOpen = computed(() => store.ui.aiInsightsOpen)
let trigger = null
function openPanel() { trigger = document.activeElement; popoverOpen.value = false; store.ui.aiInsightsOpen = true }
function closePanel() { store.ui.aiInsightsOpen = false }

// ---- Variant A: the header chip's popover (never open at the same time as the panel) ----
const popoverOpen = ref(false)
function togglePopover() {
  if (store.ui.aiInsightsOpen) return   // panel and popover are never both open
  popoverOpen.value = !popoverOpen.value
}
// Esc closes the popover
function onKey(e) { if (e.key === 'Escape' && popoverOpen.value) popoverOpen.value = false }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

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
          <!-- dashboard header row; Variant A's chip sits here, immediately left of the ⋮ -->
          <header class="fhead">
            <h1>{{ board?.name }}</h1>
            <div class="fhead-actions">
              <!-- Variant A: AI insight chip → popover -->
              <div v-if="variant === 'A'" class="chip-wrap">
                <button class="ai-chip" :class="{ on: popoverOpen }" :aria-expanded="popoverOpen"
                  title="AI insights" @click.stop="togglePopover">
                  <Icon name="sparkles" :size="15" /><span v-if="count" class="ai-chip-n">{{ count }}</span>
                </button>
                <div v-if="popoverOpen" class="pop-backdrop" @click="popoverOpen = false" />
                <transition name="pop">
                  <div v-if="popoverOpen" class="ai-pop" @click.stop>
                    <div class="ai-pop-h"><span class="ai-pop-spark"><Icon name="sparkles" :size="14" /></span> AI insights</div>
                    <p class="ai-pop-sum">{{ dashSummary }}</p>
                    <div class="ai-pop-acts">
                      <button v-for="c in CTAS" :key="c.label" class="ai-pop-cta" :class="{ primary: c.primary }" @click="openPanel">
                        <Icon :name="c.icon" :size="14" /> <span>{{ c.label }}</span>
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
              <button class="fh-ic" title="More"><Icon name="dots-v" :size="17" /></button>
            </div>
          </header>

          <!-- Variant C: the current banner, minus "Add a new widget"; its CTAs open the panel -->
          <AiSummaryCard v-if="variant === 'C'" :board="board" hide-add-widget @ask="openPanel" />
        </div>

        <!-- real tiles in a 12-col grid; WidgetCard carries its own span-{w} class.
             Variant B narrows KPIs to 4-per-row and gives slot 1 to a wide summary card. -->
        <div ref="gridEl" class="grid" :class="{ vb: variant === 'B' }">
          <!-- Variant B: a summary card two KPIs wide, with the summary + CTAs; two KPIs sit
               beside it and the rest flow onto the row below. -->
          <div v-if="variant === 'B'" class="ai-card-b card">
            <div class="acb-head"><span class="acb-spark"><Icon name="sparkles" :size="15" /></span> AI insights <span class="acb-badge">{{ count }}</span></div>
            <p class="acb-sum">{{ dashSummary }}</p>
            <div class="acb-acts">
              <button v-for="c in CTAS" :key="c.label" class="acb-cta" :class="{ primary: c.primary }" @click="openPanel">
                <Icon :name="c.icon" :size="13" /> <span>{{ c.label }}</span>
              </button>
            </div>
          </div>
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
.fh-ic { width: 32px; height: 32px; border: none; background: transparent; color: var(--muted); border-radius: 8px; display: grid; place-items: center; }
.fh-ic:hover { background: var(--surface-2); color: var(--ink); }

/* ── Variant A: header chip + popover ─────────────────────────────── */
.chip-wrap { position: relative; }
/* AI-accented pill: gradient-border over white, gradient glyph, count badge */
.ai-chip {
  display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px;
  border: 1.5px solid transparent; border-radius: 999px;
  background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--ai-grad-line) border-box;
}
.ai-chip :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.ai-chip-n { font-size: 12.5px; font-weight: 700; color: var(--ai-ink); font-variant-numeric: tabular-nums; }
.ai-chip:hover, .ai-chip.on { background: linear-gradient(var(--ai-soft), var(--ai-soft)) padding-box, var(--ai-grad-line) border-box; }
.pop-backdrop { position: fixed; inset: 0; z-index: 40; }
.ai-pop {
  position: absolute; top: 38px; right: 0; z-index: 50; width: 340px;
  background: var(--surface); border: 1px solid var(--ai-border); border-radius: 12px;
  box-shadow: var(--sh-pop); padding: 14px;
}
.ai-pop-h { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.ai-pop-spark { width: 26px; height: 26px; border-radius: 8px; flex: none; display: grid; place-items: center; background: var(--ai-softer); }
.ai-pop-spark :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.ai-pop-sum { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--ink-2); }
.ai-pop-acts { display: flex; flex-direction: column; gap: 8px; margin-top: 13px; }
.ai-pop-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px;
  border: 1px solid var(--ai-border); border-radius: var(--r-pill);
  background: var(--ai-grad-soft); color: var(--ai-ink); font-weight: 600; font-size: 12.5px;
}
.ai-pop-cta :deep(.ico) { color: var(--ai); }
.ai-pop-cta:hover { border-color: var(--ai); background: var(--ai-soft); }
/* primary: gradient border over white + gradient label (label lives in its own span) */
.ai-pop-cta.primary { border: 1.5px solid transparent; background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--ai-grad-line) border-box; }
.ai-pop-cta.primary span, .ai-pop-cta.primary :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.ai-pop-cta.primary:hover { background: linear-gradient(var(--ai-soft), var(--ai-soft)) padding-box, var(--ai-grad-line) border-box; }
.pop-enter-active, .pop-leave-active { transition: opacity .14s ease, transform .14s ease; transform-origin: top right; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: scale(.96); }

/* ── Variant B: KPIs narrow to 4-per-row; a wide summary card takes slot 1 ── */
.grid.vb :deep(.span-2) { grid-column: span 3; }   /* KPI tiles → 4 per row */
.ai-card-b {
  grid-column: span 6;                              /* = two KPI widths */
  align-self: stretch; display: flex; flex-direction: column; text-align: left;
  padding: 12px 15px; border: 1px solid var(--ai-border); border-radius: var(--r-lg);
  background: var(--ai-grad-card);
}
.acb-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--ink); }
.acb-spark { width: 26px; height: 26px; border-radius: 8px; flex: none; display: grid; place-items: center; background: var(--ai-softer); }
.acb-spark :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.acb-badge { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--ai-grad); color: #fff; font-size: 11px; font-weight: 700; }
.acb-sum { flex: 1; margin: 8px 0 10px; font-size: 12.5px; line-height: 1.5; color: var(--ink-2); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.acb-acts { display: flex; gap: 7px; flex-wrap: wrap; }
.acb-cta {
  display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 11px;
  border: 1px solid var(--ai-border); border-radius: var(--r-pill);
  background: var(--ai-grad-soft); color: var(--ai-ink); font-weight: 600; font-size: 11.5px;
}
.acb-cta :deep(.ico) { color: var(--ai); }
.acb-cta:hover { border-color: var(--ai); background: var(--ai-soft); }
.acb-cta.primary { border: 1.5px solid transparent; background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--ai-grad-line) border-box; }
.acb-cta.primary span, .acb-cta.primary :deep(.ico) { background: var(--ai-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.acb-cta.primary:hover { background: linear-gradient(var(--ai-soft), var(--ai-soft)) padding-box, var(--ai-grad-line) border-box; }

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
