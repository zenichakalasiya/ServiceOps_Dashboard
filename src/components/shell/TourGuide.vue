<script setup>
/**
 * TourGuide — a guided, spotlight walkthrough of the revamped dashboard.
 *
 * A single fixed overlay dims the app and cuts a "spotlight" around each target
 * element (via a huge box-shadow), with a coach-mark card explaining it. Steps
 * target real elements by selector; a step may run a `before()` to put the app in
 * the right state first (open the listing, show the AI card…). Centered steps
 * (no selector) are the intro / outro.
 *
 * Driven by store.ui.tourOpen. Opened from the top bar's "Take a tour" button.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Icon from '../ui/Icon.vue'
import GroupWaysCarousel from './GroupWaysCarousel.vue'
import { store } from '../../store/index.js'

const router = useRouter()
const route = useRoute()

// each step: { sel?, place?, title, body, before?() }  — no sel = centered card
const STEPS = [
  {
    center: true, title: 'Welcome to the revamped Dashboards',
    body: 'A quick tour of what’s new — the dashboards listing, the grounded AI layer, and the redesigned create & grouping flows.',
  },
  {
    sel: '.flyout', place: 'right', title: 'Your dashboards, on the left',
    body: 'The listing sidebar: a search, tabs for All / Created by me / Shared with me, and smart groups — Favourites, Recently used and by category.',
    before: () => { store.ui.activeModule = 'dashboard'; store.ui.listingOpen = true; store.ui.railExpanded = false },
  },
  {
    sel: '.manage-link', place: 'right', title: 'The full listing',
    body: 'Beyond the sidebar, the complete “Manage all dashboards” grid — sortable and filterable, with bulk actions, a columns picker, and an Archive / restore tab.',
  },
  {
    sel: '.ai-chip', place: 'bottom', title: 'Grounded AI insights',
    body: 'The ✨ chip in the board header opens a plain-language read of this board plus three actions — insights, every widget explained, and add a widget. Every number is computed from the real data, so it works even with no AI model attached.',
    before: () => { store.ui.aiPlacement = 'A' },
  },
  {
    sel: '.fab', place: 'left', title: 'Create, the new way',
    body: 'The + is your one place to build:',
    points: ['Create a dashboard from scratch', 'Add a widget to this board', 'Or just describe either — and let AI generate it for you'],
  },
  {
    center: true, anim: 'groupways', title: 'Four ways to group widgets',
    body: 'Tidy a busy board into named sections — here are all four ways to do it.',
  },
]

const active = computed(() => store.ui.tourOpen)
const i = ref(0)
const rect = ref(null)              // target rect (viewport coords) or null = centered
const tip = ref({ top: 0, left: 0 })
const tipEl = ref(null)
const step = computed(() => STEPS[i.value] || null)
const isLast = computed(() => i.value === STEPS.length - 1)
const PAD = 8

let snapshot = null                 // app state restored when the tour ends

async function ensureBoard() {
  if (!route.path.startsWith('/dashboard/')) {
    router.push('/')
    await new Promise((r) => setTimeout(r, 550))
  }
}

async function place() {
  const s = step.value
  if (!s) return
  if (s.before) { s.before(); await nextTick() }
  if (s.center || !s.sel) { rect.value = null; await nextTick(); computeTip(); return }
  // retry: some targets mount late (skeleton → board)
  let el = null
  for (let t = 0; t < 14 && !el; t++) { el = document.querySelector(s.sel); if (!el) await new Promise((r) => setTimeout(r, 90)) }
  if (!el) { rect.value = null; await nextTick(); computeTip(); return }
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  await new Promise((r) => setTimeout(r, 70))
  const r = el.getBoundingClientRect()
  rect.value = { top: r.top, left: r.left, width: r.width, height: r.height }
  await nextTick(); computeTip()
}

function computeTip() {
  const s = step.value; if (!s) return
  const vw = window.innerWidth, vh = window.innerHeight, gap = 14, m = 12
  const te = tipEl.value
  const tw = te ? te.offsetWidth : 320
  const th = te ? te.offsetHeight : 168
  if (!rect.value) { tip.value = { top: Math.round(vh / 2 - th / 2), left: Math.round(vw / 2 - tw / 2) }; return }
  const r = rect.value
  const fits = {
    bottom: r.top + r.height + gap + th <= vh - m,
    top: r.top - gap - th >= m,
    right: r.left + r.width + gap + tw <= vw - m,
    left: r.left - gap - tw >= m,
  }
  const want = s.place || 'bottom'
  const orders = {
    bottom: ['bottom', 'top', 'right', 'left'], top: ['top', 'bottom', 'right', 'left'],
    right: ['right', 'left', 'bottom', 'top'], left: ['left', 'right', 'top', 'bottom'],
  }
  const p = (orders[want] || orders.bottom).find((x) => fits[x]) || want
  let top, left
  if (p === 'bottom') { top = r.top + r.height + gap; left = r.left + r.width / 2 - tw / 2 }
  else if (p === 'top') { top = r.top - gap - th; left = r.left + r.width / 2 - tw / 2 }
  else if (p === 'right') { left = r.left + r.width + gap; top = r.top + r.height / 2 - th / 2 }
  else { left = r.left - gap - tw; top = r.top + r.height / 2 - th / 2 }
  tip.value = { top: Math.round(Math.max(m, Math.min(top, vh - th - m))), left: Math.round(Math.max(m, Math.min(left, vw - tw - m))) }
}

const spotStyle = computed(() => {
  if (!rect.value) return { display: 'none' }
  const r = rect.value
  return { top: (r.top - PAD) + 'px', left: (r.left - PAD) + 'px', width: (r.width + PAD * 2) + 'px', height: (r.height + PAD * 2) + 'px' }
})

function next() { if (isLast.value) return finish(); i.value += 1; place() }
function back() { if (i.value === 0) return; i.value -= 1; place() }
function finish() {
  store.ui.tourOpen = false
  if (snapshot) { Object.assign(store.ui, snapshot); snapshot = null }
}

function reposition() { if (active.value && step.value && !step.value.center) place() }
function onKey(e) {
  if (!active.value) return
  if (e.key === 'Escape') finish()
  else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
  else if (e.key === 'ArrowLeft') back()
}

watch(active, async (v) => {
  if (!v) return
  snapshot = { listingOpen: store.ui.listingOpen, railExpanded: store.ui.railExpanded, aiPlacement: store.ui.aiPlacement, activeModule: store.ui.activeModule }
  await ensureBoard(); await nextTick()
  i.value = 0; place()
})

onMounted(() => { window.addEventListener('resize', reposition); window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { window.removeEventListener('resize', reposition); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <teleport to="body">
    <transition name="tour-fade">
      <div v-if="active" class="tour-root" role="dialog" aria-modal="true" aria-label="Product tour">
        <div v-if="rect" class="tour-spot" :style="spotStyle" />
        <div v-else class="tour-dim" />

        <div ref="tipEl" class="tour-tip" :class="{ centered: !rect }" :style="{ top: tip.top + 'px', left: tip.left + 'px' }">
          <div class="tt-head">
            <h3 class="tt-title">{{ step.title }}</h3>
            <button class="tt-x" title="Skip tour" @click="finish"><Icon name="x" :size="16" /></button>
          </div>
          <GroupWaysCarousel v-if="step.anim === 'groupways'" class="tt-anim" />
          <p class="tt-body">{{ step.body }}</p>
          <ul v-if="step.points" class="tt-points">
            <li v-for="(p, k) in step.points" :key="k"><Icon name="check" :size="13" /> <span>{{ p }}</span></li>
          </ul>
          <div class="tt-foot">
            <span class="tt-num">{{ i + 1 }} / {{ STEPS.length }}</span>
            <div class="tt-btns">
              <button v-if="i > 0" class="tb ghost" @click="back">Back</button>
              <button class="tb primary" @click="next">{{ isLast ? 'Done' : 'Next' }}</button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
/* above the AI dock (200) and every popover — the tour owns the screen while open */
.tour-root { position: fixed; inset: 0; z-index: 3000; pointer-events: auto; }
.tour-dim { position: fixed; inset: 0; background: rgba(14, 17, 28, .58); pointer-events: none; }
/* the spotlight: a rounded rect whose enormous shadow dims everything around it */
.tour-spot {
  position: fixed; border-radius: 12px; pointer-events: none;
  box-shadow: 0 0 0 9999px rgba(14, 17, 28, .58), 0 0 0 2px var(--ai, #6d28d9), 0 0 0 6px color-mix(in srgb, var(--ai, #6d28d9) 30%, transparent);
  transition: top .28s cubic-bezier(.4, 0, .2, 1), left .28s cubic-bezier(.4, 0, .2, 1), width .28s cubic-bezier(.4, 0, .2, 1), height .28s cubic-bezier(.4, 0, .2, 1);
}

.tour-tip {
  position: fixed; width: 322px; max-width: 92vw; z-index: 3001; pointer-events: auto;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--sh-lg);
  padding: 14px 16px 13px; transition: top .28s cubic-bezier(.4, 0, .2, 1), left .28s cubic-bezier(.4, 0, .2, 1);
}
.tour-tip.centered { width: 380px; }

/* title row with a close (skip) icon beside the title */
.tt-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
.tt-title { flex: 1; margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -.01em; color: var(--ink); }
.tt-x { flex: none; width: 26px; height: 26px; margin: -2px -4px 0 0; border: none; background: transparent; color: var(--muted); border-radius: 7px; display: grid; place-items: center; }
.tt-x:hover { background: var(--surface-2); color: var(--ink); }
.tt-anim { margin: 6px 0 10px; }
.tt-body { margin: 0; font-size: 12.75px; line-height: 1.5; color: var(--ink-2); }
/* the extra guidance points (Create step) */
.tt-points { list-style: none; margin: 9px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.tt-points li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; line-height: 1.45; color: var(--ink-2); }
.tt-points li :deep(.ico) { color: var(--ai, #6d28d9); flex: none; margin-top: 1px; }

.tt-foot { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
/* progress as a number, not dots */
.tt-num { flex: 1; font-size: 12px; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; letter-spacing: .03em; }
.tt-btns { display: flex; align-items: center; gap: 7px; flex: none; }
.tb { height: 32px; padding: 0 15px; border-radius: 8px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--border); background: var(--surface); color: var(--ink-2); }
.tb.ghost:hover { background: var(--surface-2); color: var(--ink); }
.tb.primary {
  border: 1.5px solid transparent; color: #fff; background: var(--ai-grad, linear-gradient(90deg, #2563eb, #7c3aed 45%, #db2777));
}
.tb.primary:hover { filter: brightness(1.05); }

.tour-fade-enter-active, .tour-fade-leave-active { transition: opacity .2s ease; }
.tour-fade-enter-from, .tour-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .tour-spot, .tour-tip, .tour-fade-enter-active, .tour-fade-leave-active { transition: none; }
}
</style>
