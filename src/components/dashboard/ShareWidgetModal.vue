<script setup>
/**
 * ShareWidgetModal — share a single widget, with screenshot-style markup.
 *
 * The preview is a *live* render of the tile, not a bitmap: no html2canvas
 * dependency, dark mode keeps working, and text stays crisp. Annotations are
 * kept as shape data (never rasterised here), so Undo is a pop and the payload
 * can be replayed by the server when it renders the real PNG for the email.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Icon from '../ui/Icon.vue'
import ChartTile from './ChartTile.vue'
import DataTable from './DataTable.vue'
import { toast } from '../../store/index.js'
import { TECHNICIANS, TECH_GROUPS } from '../../data/mock.js'

const props = defineProps({ tile: Object })
const emit = defineEmits(['close'])

/* ---------------- annotation ---------------- */
const COLORS = ['#e0483d', '#d98a0b', '#1f9d63', '#3d8bd0', '#8b5cf6', '#364658']
const SHAPES = [
  { id: 'rect', icon: 'shape-rect', label: 'Rectangle' },
  { id: 'ellipse', icon: 'shape-ellipse', label: 'Ellipse' },
  { id: 'arrow', icon: 'shape-arrow', label: 'Arrow' },
]

const tool = ref(null)          // null = pointer (no drawing) | 'pen' | 'shape'
const shapeKind = ref('rect')
const color = ref(COLORS[0])
const shapeMenu = ref(false)
const colorMenu = ref(false)

const shapes = ref([])          // committed
const draft = ref(null)         // in-flight
const drawing = computed(() => tool.value !== null)
const all = computed(() => (draft.value ? [...shapes.value, draft.value] : shapes.value))

function at(e, el) { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
function down(e) {
  if (!drawing.value) return
  const p = at(e, e.currentTarget)
  draft.value = tool.value === 'pen'
    ? { type: 'pen', color: color.value, pts: [p] }
    : { type: shapeKind.value, color: color.value, x0: p.x, y0: p.y, x1: p.x, y1: p.y }
  e.currentTarget.setPointerCapture(e.pointerId)
}
function move(e) {
  if (!draft.value) return
  const p = at(e, e.currentTarget)
  if (draft.value.type === 'pen') draft.value.pts.push(p)
  else { draft.value.x1 = p.x; draft.value.y1 = p.y }
}
function up() {
  if (!draft.value) return
  const s = draft.value
  const tiny = s.type === 'pen' ? s.pts.length < 2 : Math.hypot(s.x1 - s.x0, s.y1 - s.y0) < 4
  if (!tiny) shapes.value.push(s)   // ignore stray clicks
  draft.value = null
}
function undo() { shapes.value.pop() }
function clearAll() { shapes.value = []; draft.value = null }

function togglePen() { tool.value = tool.value === 'pen' ? null : 'pen'; shapeMenu.value = false; colorMenu.value = false }
function toggleShape() {
  if (tool.value === 'shape') shapeMenu.value = !shapeMenu.value
  else { tool.value = 'shape'; shapeMenu.value = true }
  colorMenu.value = false
}
function pickShape(id) { shapeKind.value = id; tool.value = 'shape'; shapeMenu.value = false }

// Esc steps back: first it drops the active tool, then it closes the dialog.
function onKey(e) {
  if (e.key !== 'Escape') return
  if (shapeMenu.value || colorMenu.value) { shapeMenu.value = colorMenu.value = false }
  else if (tool.value) tool.value = null
  else emit('close')
}
function onDocClick() { shapeMenu.value = false; colorMenu.value = false }
onMounted(() => { window.addEventListener('keydown', onKey); document.addEventListener('click', onDocClick) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); document.removeEventListener('click', onDocClick) })

const path = (s) => s.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
const box = (s) => ({ x: Math.min(s.x0, s.x1), y: Math.min(s.y0, s.y1), width: Math.abs(s.x1 - s.x0), height: Math.abs(s.y1 - s.y0) })
const ell = (s) => { const b = box(s); return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, rx: b.width / 2, ry: b.height / 2 } }
function head(s) {
  const a = Math.atan2(s.y1 - s.y0, s.x1 - s.x0), L = 13, W = 7
  const p = [
    [s.x1, s.y1],
    [s.x1 - L * Math.cos(a) + W * Math.sin(a), s.y1 - L * Math.sin(a) - W * Math.cos(a)],
    [s.x1 - L * Math.cos(a) - W * Math.sin(a), s.y1 - L * Math.sin(a) + W * Math.cos(a)],
  ]
  return p.map((q) => q.join(',')).join(' ')
}

/* ---------------- recipients ---------------- */
const query = ref('')
const picked = ref([])
const note = ref('')
const focused = ref(false)

const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase()
  const taken = new Set(picked.value.map((p) => p.name))
  const pool = [
    ...TECH_GROUPS.map((name) => ({ name, group: true })),
    ...TECHNICIANS.map((name) => ({ name, group: false })),
  ].filter((p) => !taken.has(p.name))
  return (q ? pool.filter((p) => p.name.toLowerCase().includes(q)) : pool).slice(0, 6)
})
function add(p) { picked.value.push(p); query.value = ''; }
function addTyped() {
  const q = query.value.trim()
  if (!q) return
  add(suggestions.value[0] ?? { name: q, group: false })   // an email typed in full is valid too
}
function remove(i) { picked.value.splice(i, 1) }

const canShare = computed(() => picked.value.length > 0)
function share() {
  if (!canShare.value) return
  const who = picked.value.length === 1 ? picked.value[0].name : `${picked.value.length} recipients`
  const marks = shapes.value.length ? ` with ${shapes.value.length} annotation${shapes.value.length > 1 ? 's' : ''}` : ''
  toast(`Shared “${props.tile.title}”${marks} to ${who}`, 'success')
  emit('close')
}
function copyLink() {
  navigator.clipboard?.writeText(`${location.origin}${location.pathname}${location.hash}#tile=${props.tile.id}`).catch(() => {})
  toast('Widget link copied')
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sw">
      <!-- header: title left, markup tools hard right, then close -->
      <header class="sw-h">
        <b class="sw-t">Share widget</b>
        <div class="grow" />
        <div class="tools" @click.stop>
          <button class="tl" :class="{ on: tool === 'pen' }" title="Draw freehand" @click="togglePen">
            <Icon name="pen" :size="17" />
          </button>

          <div class="tl-wrap">
            <button class="tl" :class="{ on: tool === 'shape' }" :title="`Shape — ${SHAPES.find(s => s.id === shapeKind).label}`" @click="toggleShape">
              <Icon :name="SHAPES.find(s => s.id === shapeKind).icon" :size="17" />
              <Icon name="chevron-down" :size="12" class="caret" />
            </button>
            <div v-if="shapeMenu" class="pop">
              <button v-for="s in SHAPES" :key="s.id" class="pop-i" :class="{ on: shapeKind === s.id }" @click="pickShape(s.id)">
                <Icon :name="s.icon" :size="16" /> {{ s.label }}
              </button>
            </div>
          </div>

          <div class="tl-wrap">
            <button class="tl" title="Colour" @click="colorMenu = !colorMenu">
              <span class="chip" :style="{ background: color }" />
            </button>
            <div v-if="colorMenu" class="pop swatches">
              <button v-for="c in COLORS" :key="c" class="sw-dot" :class="{ on: color === c }" :style="{ background: c }" @click="color = c; colorMenu = false" />
              <label class="sw-dot custom" title="Custom colour">
                <Icon name="palette" :size="14" />
                <input type="color" :value="color" @input="color = $event.target.value" />
              </label>
            </div>
          </div>

          <span class="tl-sep" />
          <button class="tl" title="Undo last mark" :disabled="!shapes.length" @click="undo"><Icon name="undo" :size="17" /></button>
          <button class="tl" title="Clear all marks" :disabled="!shapes.length" @click="clearAll"><Icon name="erase" :size="17" /></button>
        </div>
        <span class="tl-sep" />
        <button class="tl close" title="Close" @click="emit('close')"><Icon name="x" :size="18" /></button>
      </header>

      <div class="sw-b">
        <!-- the widget, with a markup layer over it -->
        <div class="snap" :class="{ drawing }">
          <div class="snap-h">
            <b>{{ tile.title }}</b>
            <button class="lnk" @click="copyLink"><Icon name="link" :size="13" /> Copy link</button>
          </div>
          <div class="snap-c">
            <div v-if="tile.type === 'kpi'" class="pv-kpi">{{ tile.value }}<span v-if="tile.unit" class="u">{{ tile.unit }}</span></div>
            <ChartTile v-else-if="tile.type === 'chart' && tile.chart" :chart="tile.chart" :height="260" />
            <DataTable v-else-if="tile.type === 'shortcut'" :columns="tile.columns || []" :rows="tile.rows || []" :sortable="false" />
          </div>

          <svg class="anno" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
            <template v-for="(s, i) in all" :key="i">
              <path v-if="s.type === 'pen'" :d="path(s)" :stroke="s.color" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              <rect v-else-if="s.type === 'rect'" v-bind="box(s)" :stroke="s.color" fill="none" stroke-width="3" rx="4" />
              <ellipse v-else-if="s.type === 'ellipse'" v-bind="ell(s)" :stroke="s.color" fill="none" stroke-width="3" />
              <g v-else>
                <line :x1="s.x0" :y1="s.y0" :x2="s.x1" :y2="s.y1" :stroke="s.color" stroke-width="3" stroke-linecap="round" />
                <polygon :points="head(s)" :fill="s.color" />
              </g>
            </template>
          </svg>

          <span v-if="drawing" class="hint">{{ tool === 'pen' ? 'Draw to highlight' : `Drag to place a ${shapeKind}` }} · Esc to stop</span>
        </div>

        <!-- recipients -->
        <label class="fl">Share with</label>
        <div class="rcpt" :class="{ focus: focused }">
          <span v-for="(p, i) in picked" :key="p.name" class="rchip">
            <Icon :name="p.group ? 'users' : 'user'" :size="12" />{{ p.name }}
            <button @click="remove(i)"><Icon name="x" :size="12" /></button>
          </span>
          <input
            v-model="query" :placeholder="picked.length ? '' : 'Add technician or technician group…'"
            @focus="focused = true" @blur="focused = false"
            @keydown.enter.prevent="addTyped" @keydown.backspace="!query && picked.length && remove(picked.length - 1)"
          />
          <div v-if="focused && suggestions.length" class="sugg" @mousedown.prevent>
            <button v-for="s in suggestions" :key="s.name" class="sg" @click="add(s)">
              <Icon :name="s.group ? 'users' : 'user'" :size="15" class="mu" />
              <span>{{ s.name }}</span>
              <em v-if="s.group">Group</em>
            </button>
          </div>
        </div>

        <label class="fl">Note</label>
        <textarea v-model="note" rows="2" placeholder="Add a note for the recipients…" />
      </div>

      <footer class="sw-f">
        <button class="btn" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="!canShare" :title="canShare ? '' : 'Add at least one recipient'" @click="share">
          <Icon name="share" :size="15" /> Share
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 90; background: rgba(20, 22, 32, .5); display: grid; place-items: center; padding: 16px; }
.sw { width: min(720px, 100%); max-height: 92vh; display: flex; flex-direction: column; background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--sh-lg); overflow: hidden; }

.sw-h { display: flex; align-items: center; gap: 4px; padding: 10px 12px 10px 16px; border-bottom: 1px solid var(--border); }
.sw-t { font-size: 15px; color: var(--ink); }
.grow { flex: 1; }
.tools { display: flex; align-items: center; gap: 2px; }
.tl-wrap { position: relative; display: flex; }
.tl { position: relative; display: inline-flex; align-items: center; gap: 1px; height: 32px; min-width: 32px; justify-content: center; padding: 0 5px; border: none; background: transparent; color: var(--muted); border-radius: 7px; }
.tl:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
.tl.on { background: var(--primary-soft); color: var(--primary-700); }
.tl:disabled { opacity: .35; }
.tl .caret { opacity: .6; }
.tl.close:hover { background: var(--red-soft); color: var(--red); }
.tl-sep { width: 1px; height: 20px; background: var(--border); margin: 0 5px; }
.chip { width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid rgba(0,0,0,.12); }

.pop { position: absolute; top: 36px; right: 0; z-index: 5; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm); box-shadow: var(--sh-pop); padding: 4px; min-width: 150px; }
.pop-i { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: none; background: transparent; color: var(--ink-2); border-radius: 5px; font-size: 12.5px; }
.pop-i:hover { background: var(--surface-2); }
.pop-i.on { color: var(--primary-700); background: var(--primary-soft); }
.pop.swatches { display: flex; gap: 5px; min-width: 0; padding: 7px; }
.sw-dot { width: 20px; height: 20px; border-radius: 50%; border: 2px solid transparent; padding: 0; }
.sw-dot.on { border-color: var(--ink); }
.sw-dot.custom { position: relative; overflow: hidden; display: grid; place-items: center; background: var(--surface-2); color: var(--muted); }
.sw-dot.custom input { position: absolute; inset: -8px; opacity: 0; cursor: pointer; }

.sw-b { flex: 1; overflow: auto; padding: 14px 16px; min-height: 0; }

/* the widget preview + markup layer */
.snap { position: relative; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); padding: 12px 14px; margin-bottom: 16px; }
.snap-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.snap-h b { font-size: 13.5px; color: var(--ink); }
.lnk { display: inline-flex; align-items: center; gap: 4px; border: none; background: transparent; color: var(--primary-700); font-size: 11.5px; font-weight: 600; }
.lnk:hover { text-decoration: underline; }
.snap-c { min-height: 120px; }
.pv-kpi { font-size: 68px; font-weight: 600; color: var(--ink); text-align: center; padding: 22px 0; letter-spacing: -1px; }
.pv-kpi .u { font-size: 26px; color: var(--muted); margin-left: 4px; }

/* <svg> is a replaced element: inset:0 alone leaves it at its intrinsic 300x150
   and clips every mark drawn outside that box. It needs explicit 100%/100%. */
.anno { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; touch-action: none; }
.snap.drawing .anno { pointer-events: auto; cursor: crosshair; }
.snap.drawing { border-color: var(--primary); }
.hint { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); background: rgba(27,28,46,.82); color: #fff; font-size: 11px; padding: 3px 9px; border-radius: 999px; pointer-events: none; }

.fl { display: block; font-size: 11.5px; font-weight: 600; color: var(--muted); margin-bottom: 5px; }
.rcpt { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; min-height: 38px; padding: 5px 8px; border: 1px solid var(--border); border-radius: var(--r-sm); margin-bottom: 14px; }
.rcpt.focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.rcpt input { flex: 1; min-width: 150px; border: none; outline: none; background: transparent; font: inherit; font-size: 13px; color: var(--ink); height: 26px; }
.rchip { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 4px 0 8px; background: var(--surface-2); border-radius: var(--r-sm); font-size: 12px; color: var(--ink-2); }
.rchip button { display: grid; place-items: center; border: none; background: transparent; color: var(--muted); padding: 2px; border-radius: 4px; }
.rchip button:hover { background: var(--red-soft); color: var(--red); }

.sugg { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 6; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm); box-shadow: var(--sh-pop); padding: 4px; max-height: 210px; overflow: auto; }
.sg { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 8px; border: none; background: transparent; border-radius: 5px; font-size: 13px; color: var(--ink-2); }
.sg:hover { background: var(--surface-2); }
.sg .mu { color: var(--muted); }
.sg em { margin-left: auto; font-style: normal; font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }

textarea { width: 100%; border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px 10px; font: inherit; font-size: 13px; color: var(--ink); background: var(--surface); resize: vertical; outline: none; }
textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }

.sw-f { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border); }
</style>
