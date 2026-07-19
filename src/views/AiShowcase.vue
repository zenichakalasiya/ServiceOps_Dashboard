<script setup>
/**
 * AiShowcase (/ai) — demonstrates the ONE unified AI Assistant on a live board.
 * A single docked panel (board stays in view) that summarizes, explains,
 * investigates and builds — the four research problems solved by one feature.
 * The capability cards are not separate tools; they are the four things the one
 * assistant does, and clicking one runs that mode inside the same panel.
 */
import { ref, computed, nextTick } from 'vue'
import Icon from '../components/ui/Icon.vue'
import AiShowcaseTile from '../components/ai/AiShowcaseTile.vue'
import AiAssistant from '../components/ai/AiAssistant.vue'
import { demoBoard } from '../data/aiDemo.js'
import { facts as computeFacts } from '../data/aiEngine.js'

const board = demoBoard()
const role = ref(board.role || 'technician')
const citedTileId = ref(null)
const open = ref(true)
const asst = ref(null)

const highCount = computed(() => computeFacts(board, role.value).filter((f) => f.severity === 'bad').length)

// The four things the one assistant does (each maps to a problem + an intent).
const JOBS = [
  { key: 'summary', icon: 'sparkles', label: 'Summarize', problem: 'Problem 1', blurb: 'Ranks what needs attention, for your role', run: 'What needs my attention?' },
  { key: 'explain', icon: 'crisis_alert', label: 'Explain', problem: 'Problem 3', blurb: 'Why a widget’s value broke its pattern', run: 'Why did Overdue spike?' },
  { key: 'drill', icon: 'insights', label: 'Investigate', problem: 'Problem 2', blurb: 'Drill to the records, then act', run: 'Show the P1s breaching today' },
  { key: 'create', icon: 'wand', label: 'Build', problem: 'Problem 4', blurb: 'Describe a widget; it builds it', run: 'Create: SLA breaches this week by team' },
]
function runJob(j) {
  open.value = true
  nextTick(() => asst.value?.trigger(j.key, j.run))
}
</script>

<template>
  <div class="showcase">
    <!-- header -->
    <div class="head">
      <div class="head-l">
        <span class="spark"><Icon name="sparkles" :size="20" /></span>
        <div>
          <h1>ServiceOps AI Assistant</h1>
          <p>One assistant for your dashboards — summarize, explain, investigate and build. Grounded in your data, built for on-prem.</p>
        </div>
      </div>
      <span class="on-prem chip"><Icon name="lock" :size="13" /> Runs on-prem · your data stays inside</span>
    </div>

    <!-- the four jobs of the one assistant -->
    <div class="jobs">
      <button v-for="j in JOBS" :key="j.key" class="job" @click="runJob(j)">
        <span class="job-ic"><Icon :name="j.icon" :size="17" /></span>
        <div class="job-b">
          <div class="job-top"><b>{{ j.label }}</b><span class="job-p">{{ j.problem }}</span></div>
          <div class="job-blurb">{{ j.blurb }}</div>
        </div>
        <span class="job-try">Try <Icon name="chevron-right" :size="13" /></span>
      </button>
    </div>

    <!-- stage: board (stays in view) + docked assistant -->
    <div class="stage">
      <div class="board-col">
        <div class="board card">
          <div class="board-top">
            <div class="bt-l">
              <span class="badge-pre">Predefined</span>
              <b>{{ board.name }}</b>
              <span class="muted bt-meta">{{ board.tiles.length }} widgets · Last 30 days</span>
            </div>
            <div class="bt-r">
              <span class="mock-ctl"><Icon name="clock" :size="14" /> Last 30 days</span>
              <span class="mock-ctl"><Icon name="refresh" :size="14" /> Off</span>
              <button class="askai" :class="{ on: open }" @click="open = !open">
                <Icon name="sparkles" :size="16" /> Ask AI
                <span v-if="highCount && !open" class="cnt">{{ highCount }}</span>
              </button>
            </div>
          </div>
          <div class="grid">
            <AiShowcaseTile v-for="t in board.tiles" :key="t.id" :tile="t"
              :highlight="citedTileId === t.id" :dim="!!citedTileId && citedTileId !== t.id" />
          </div>
        </div>
      </div>

      <div v-if="open" class="asst-col">
        <AiAssistant ref="asst" :board="board" :role="role" v-model:open="open"
          @role="role = $event" @cite="citedTileId = $event" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.showcase { padding: 22px 26px 40px; max-width: 1400px; margin: 0 auto; width: 100%; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.head-l { display: flex; gap: 13px; }
.spark { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex: none; background: var(--primary-soft); color: var(--primary-700); }
.head h1 { font-size: 22px; font-weight: 600; margin: 0; letter-spacing: -.3px; }
.head p { margin: 3px 0 0; color: var(--muted); font-size: 13.5px; max-width: 640px; }
.on-prem { flex: none; }
/* jobs */
.jobs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
.job { display: flex; align-items: center; gap: 11px; text-align: left; border: 1px solid var(--border); background: var(--surface); border-radius: var(--r-lg); padding: 13px 14px; box-shadow: var(--sh-sm); transition: all .16s ease; }
.job:hover { border-color: var(--primary); transform: translateY(-1px); box-shadow: var(--sh); }
.job-ic { width: 36px; height: 36px; border-radius: 10px; flex: none; display: grid; place-items: center; background: var(--primary-soft); color: var(--primary-700); }
.job-b { flex: 1; min-width: 0; }
.job-top { display: flex; align-items: center; gap: 8px; }
.job-top b { font-size: 14.5px; font-weight: 600; }
.job-p { font-size: 10px; font-weight: 500; color: var(--muted-2); }
.job-blurb { font-size: 11.5px; color: var(--muted); margin-top: 1px; line-height: 1.3; }
.job-try { display: inline-flex; align-items: center; gap: 1px; font-size: 11px; font-weight: 600; color: var(--primary-700); flex: none; opacity: 0; transition: opacity .16s; }
.job:hover .job-try { opacity: 1; }
/* stage */
.stage { display: flex; gap: 16px; align-items: flex-start; }
.board-col { flex: 1; min-width: 0; }
.asst-col { width: 404px; flex: none; position: sticky; top: 16px; align-self: flex-start; height: calc(100vh - 104px); }
.asst-col > * { height: 100%; }
/* board */
.board { padding: 0; overflow: hidden; }
.board-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
.bt-l { display: flex; align-items: center; gap: 9px; min-width: 0; }
.bt-l b { font-size: 15px; font-weight: 600; }
.bt-meta { font-size: 12px; }
.bt-r { display: flex; align-items: center; gap: 8px; }
.mock-ctl { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 12.5px; color: var(--ink-2); background: var(--surface); }
.askai { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 13px; border: 1px solid var(--primary); border-radius: 8px; font-weight: 600; font-size: 13px; color: var(--primary-700); background: var(--primary-softer); position: relative; }
.askai:hover { background: var(--primary-soft); }
.askai.on { background: var(--primary); border-color: var(--primary); color: #fff; box-shadow: 0 0 0 4px var(--primary-soft); }
.cnt { display: inline-grid; place-items: center; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px; background: var(--red); color: #fff; font-size: 10.5px; font-weight: 700; }
/* grid */
.grid { display: grid; grid-template-columns: repeat(12, 1fr); grid-auto-rows: 148px; gap: 14px; padding: 16px; }
.grid :deep(.span-3) { grid-column: span 3; }
.grid :deep(.span-4) { grid-column: span 4; }
.grid :deep(.span-6) { grid-column: span 6; }
.grid :deep(.span-12) { grid-column: span 12; }
.grid :deep(.rows-1) { grid-row: span 1; }
.grid :deep(.rows-2) { grid-row: span 2; }
@media (max-width: 1180px) {
  .stage { flex-direction: column; }
  .asst-col { width: 100%; position: static; height: 620px; }
}
@media (max-width: 900px) {
  .jobs { grid-template-columns: repeat(2, 1fr); }
  .grid :deep(.span-3), .grid :deep(.span-4) { grid-column: span 6; }
}
</style>
