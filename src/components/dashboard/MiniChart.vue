<script setup>
import { computed, ref } from 'vue'
const props = defineProps({ chart: Object, height: { type: Number, default: 180 }, legend: { type: Boolean, default: true } })
const PAL = ['#3d8bd0', '#3279be', '#1f9d63', '#d98a0b', '#e0483d', '#16b1c4']
const W = 320, H = 160, PAD = 22

const kind = computed(() => props.chart?.kind || 'bar')
const labels = computed(() => props.chart?.labels || [])
const series = computed(() => props.chart?.series || [])
const maxV = computed(() => Math.max(1, ...series.value.flatMap((s) => s.values)))
const grandTotal = computed(() => series.value.flatMap((s) => s.values).reduce((a, b) => a + b, 0) || 1)
const pctOf = (v) => ((v / grandTotal.value) * 100).toFixed(2)

// --- hover tooltip: shows label · share% · record count in brackets ---
const tip = ref(null)
function showTip(e, it) { tip.value = { label: it.label, value: it.value, pct: it.pct, c: it.c, x: e.clientX, y: e.clientY } }
function hideTip() { tip.value = null }

// bars (single or grouped)
const bars = computed(() => {
  const n = labels.value.length, m = series.value.length
  const gw = (W - PAD * 2) / n, bw = Math.min(26, (gw - 8) / m)
  const out = []
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const v = series.value[j].values[i]
    const h = (v / maxV.value) * (H - PAD * 2)
    const x = PAD + i * gw + (gw - bw * m) / 2 + j * bw
    const label = m > 1 ? `${labels.value[i] ?? ''} · ${series.value[j].name}` : (labels.value[i] ?? '')
    out.push({ x, y: H - PAD - h, w: bw - 3, h, c: PAL[j % PAL.length], label, value: v, pct: pctOf(v) })
  }
  return out
})
// horizontal bars (single or grouped) — the "Bar" chart type
const hbars = computed(() => {
  const n = labels.value.length, m = series.value.length
  const gh = (H - PAD * 2) / n, bh = Math.min(16, (gh - 6) / m)
  const out = []
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const v = series.value[j].values[i]
    const w = (v / maxV.value) * (W - PAD * 2)
    const y = PAD + i * gh + (gh - bh * m) / 2 + j * bh
    const label = m > 1 ? `${labels.value[i] ?? ''} · ${series.value[j].name}` : (labels.value[i] ?? '')
    out.push({ x: PAD, y, w, h: bh - 2, c: PAL[j % PAL.length], label, value: v, pct: pctOf(v) })
  }
  return out
})
// line
const linePts = computed(() => {
  const s = series.value[0]; if (!s) return ''
  const n = labels.value.length, gw = (W - PAD * 2) / Math.max(1, n - 1)
  return s.values.map((v, i) => `${PAD + i * gw},${H - PAD - (v / maxV.value) * (H - PAD * 2)}`).join(' ')
})
const lineArea = computed(() => linePts.value ? `${PAD},${H - PAD} ${linePts.value} ${W - PAD},${H - PAD}` : '')
const lineDots = computed(() => {
  const s = series.value[0]; if (!s) return []
  const n = labels.value.length, gw = (W - PAD * 2) / Math.max(1, n - 1)
  return s.values.map((v, i) => ({ x: PAD + i * gw, y: H - PAD - (v / maxV.value) * (H - PAD * 2), c: PAL[0], label: labels.value[i] ?? '', value: v, pct: pctOf(v) }))
})
// donut
const arcs = computed(() => {
  const vals = series.value[0]?.values || []
  const total = vals.reduce((a, b) => a + b, 0) || 1
  const cx = W / 2, cy = H / 2, r = 52, rin = 32
  let a0 = -Math.PI / 2
  return vals.map((v, i) => {
    const a1 = a0 + (v / total) * Math.PI * 2
    const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
    const [x0, y0] = p(r, a0), [x1, y1] = p(r, a1), [xi1, yi1] = p(rin, a1), [xi0, yi0] = p(rin, a0)
    const large = a1 - a0 > Math.PI ? 1 : 0
    const d = `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${rin},${rin} 0 ${large} 0 ${xi0},${yi0} Z`
    a0 = a1
    return { d, c: PAL[i % PAL.length], label: labels.value[i] ?? '', value: v, pct: ((v / total) * 100).toFixed(2) }
  })
})
</script>

<template>
  <div class="chart" :style="{ height: height + 'px' }">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      <template v-if="kind === 'bar'">
        <rect v-for="(b, i) in bars" :key="i" class="seg" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :fill="b.c" rx="3"
          @mousemove="showTip($event, b)" @mouseleave="hideTip" />
      </template>
      <template v-else-if="kind === 'hbar'">
        <rect v-for="(b, i) in hbars" :key="i" class="seg" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :fill="b.c" rx="3"
          @mousemove="showTip($event, b)" @mouseleave="hideTip" />
      </template>
      <template v-else-if="kind === 'line'">
        <polygon :points="lineArea" :fill="PAL[0]" opacity="0.12" />
        <polyline :points="linePts" fill="none" :stroke="PAL[0]" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <g v-for="(p, i) in lineDots" :key="i">
          <circle class="dot" :cx="p.x" :cy="p.y" r="3.5" :fill="p.c" />
          <circle class="hit" :cx="p.x" :cy="p.y" r="11" fill="transparent" @mousemove="showTip($event, p)" @mouseleave="hideTip" />
        </g>
      </template>
      <template v-else>
        <path v-for="(a, i) in arcs" :key="i" class="seg" :d="a.d" :fill="a.c"
          @mousemove="showTip($event, a)" @mouseleave="hideTip" />
      </template>
    </svg>

    <!-- data tooltip: LABEL: share% (record count) — hints how many records a click drills to -->
    <teleport to="body">
      <div v-if="tip" class="ctip" :style="{ left: tip.x + 14 + 'px', top: tip.y - 12 + 'px' }">
        <span class="ct-dot" :style="{ background: tip.c }" />
        <span class="ct-txt">{{ tip.label }}: {{ tip.pct }}% <b>({{ tip.value }})</b></span>
      </div>
    </teleport>
    <!-- legend -->
    <div v-if="legend" class="legend">
      <template v-if="kind === 'donut'">
        <span v-for="(l, i) in labels" :key="i" class="lg"><i :style="{ background: PAL[i % PAL.length] }" />{{ l }} <b>{{ arcs[i]?.pct }}%</b></span>
      </template>
      <template v-else>
        <span v-for="(s, i) in series" :key="i" class="lg"><i :style="{ background: PAL[i % PAL.length] }" />{{ s.name }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.chart { display: flex; flex-direction: column; }
.chart svg { flex: 1; min-height: 0; }
.legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 12px; padding: 6px 4px 0; }
.lg { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted); }
.lg i { width: 9px; height: 9px; border-radius: 3px; }
.lg b { color: var(--ink-2); }
/* hover affordance — signals the segment is clickable (drills to its records) */
.seg { cursor: pointer; transition: opacity .12s; }
.seg:hover { opacity: .82; }
.hit { cursor: pointer; }
.dot { pointer-events: none; }
/* floating data tooltip (teleported to body) */
.ctip { position: fixed; z-index: 200; display: inline-flex; align-items: center; gap: 7px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--sh-pop); border-radius: 8px; padding: 6px 10px; font-size: 12px; color: var(--ink-2); white-space: nowrap; pointer-events: none; }
.ct-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.ct-txt b { color: var(--ink); font-weight: 600; }
</style>
