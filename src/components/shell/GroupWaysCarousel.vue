<script setup>
/**
 * GroupWaysCarousel — shows all FOUR ways to group widgets, one at a time, as small
 * looping CSS animations. Auto-advances; arrows + a "n / 4" indicator to step through.
 *   1. Drag a selection box (marquee)      — reuses GroupSelectAnim
 *   2. Shift + click each widget
 *   3. Add an empty group at the board's end
 *   4. From the + (Create) menu → Empty group
 * Each animation is keyed by index so it restarts cleanly when shown.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Icon from '../ui/Icon.vue'
import GroupSelectAnim from './GroupSelectAnim.vue'

const WAYS = [
  { title: 'Drag a selection box', caption: 'Drag a box across the widgets, then Create group.' },
  { title: 'Shift + click', caption: 'Hold Shift and click each widget, then Create group.' },
  { title: 'Add an empty group', caption: 'Drop an empty group at the end of the board and drag widgets in.' },
  { title: 'From the widget panel', caption: 'In Add New Widget → Create Widget, the Layout section has an “Empty group”.' },
]
const idx = ref(0)
const DWELL = 5200
let timer = null
function arm() { clearInterval(timer); timer = setInterval(() => { idx.value = (idx.value + 1) % WAYS.length }, DWELL) }
function pause() { clearInterval(timer) }
function go(n) { idx.value = (n + WAYS.length) % WAYS.length; arm() }
onMounted(arm)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="gwc" @mouseenter="pause" @mouseleave="arm">
    <div class="gwc-stage">
      <transition name="gwc-fade" mode="out-in">
        <div class="gwc-anim" :key="idx">
          <!-- 1 · marquee -->
          <GroupSelectAnim v-if="idx === 0" />

          <!-- 2 · shift + click -->
          <div v-else-if="idx === 1" class="wa shift">
            <div class="tile t1" /><div class="tile t2" /><div class="tile t3" />
            <div class="grp"><span class="glabel">New group</span></div>
            <span class="kbd">⇧ Shift</span>
            <div class="cur" />
          </div>

          <!-- 3 · empty group at the board's end -->
          <div v-else-if="idx === 2" class="wa endg">
            <div class="tile e1" /><div class="tile e2" />
            <div class="bar"><span>+ New group here</span></div>
            <div class="grp gbox"><span class="glabel">New group</span></div>
            <div class="cur" />
          </div>

          <!-- 4 · from the Add New Widget panel → Create Widget → Layout → Empty group -->
          <div v-else class="wa addw">
            <div class="np">
              <div class="np-tabs"><b>Create Widget</b><span>All</span><span>Predefined</span></div>
              <div class="np-lab">Widget</div>
              <div class="np-row">
                <span class="np-t"><Icon name="chart-line" :size="15" /></span>
                <span class="np-t"><Icon name="chart-hbar" :size="15" /></span>
                <span class="np-t"><Icon name="chart-bar" :size="15" /></span>
                <span class="np-t"><Icon name="chart-pie" :size="15" /></span>
              </div>
              <div class="np-lab">Layout</div>
              <div class="np-row">
                <span class="np-t wide hot"><Icon name="new-group" :size="15" /> Empty group</span>
              </div>
            </div>
            <div class="cur" />
          </div>
        </div>
      </transition>
    </div>

    <div class="gwc-cap">
      <b>{{ WAYS[idx].title }}</b>
      <span>{{ WAYS[idx].caption }}</span>
    </div>

    <div class="gwc-nav">
      <button class="gwc-arrow" title="Previous" @click="go(idx - 1)"><Icon name="chevron-left" :size="16" /></button>
      <span class="gwc-num">{{ idx + 1 }} / {{ WAYS.length }}</span>
      <button class="gwc-arrow" title="Next" @click="go(idx + 1)"><Icon name="chevron-right" :size="16" /></button>
    </div>
  </div>
</template>

<style scoped>
.gwc { width: 300px; max-width: 100%; }
.gwc-stage { height: 138px; }
.gwc-anim { height: 138px; }
.gwc-fade-enter-active, .gwc-fade-leave-active { transition: opacity .18s ease; }
.gwc-fade-enter-from, .gwc-fade-leave-to { opacity: 0; }

/* shared canvas + primitives */
.wa { position: relative; width: 300px; height: 138px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.tile { position: absolute; border-radius: 8px; background: var(--surface); border: 1.5px solid var(--border); }
.grp { position: absolute; opacity: 0; border: 1.5px solid var(--ai, #6d28d9); border-radius: 11px; background: color-mix(in srgb, var(--ai, #6d28d9) 6%, transparent); }
.glabel { position: absolute; top: -9px; left: 10px; font-size: 9px; font-weight: 700; color: #fff; background: var(--ai, #6d28d9); border-radius: 5px; padding: 1px 6px; white-space: nowrap; }
.cur { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: var(--ai, #6d28d9); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ai, #6d28d9) 25%, transparent); }
.selfill { border-color: var(--ai, #6d28d9); background: color-mix(in srgb, var(--ai, #6d28d9) 10%, var(--surface)); }

/* ── 2 · shift + click ── */
.shift .tile { top: 38px; width: 82px; height: 64px; }
.shift .t1 { left: 16px; animation: sh-s1 5s ease-in-out infinite; }
.shift .t2 { left: 110px; animation: sh-s2 5s ease-in-out infinite; }
.shift .t3 { left: 204px; }
.shift .grp { left: 8px; top: 30px; width: 192px; height: 84px; animation: sh-grp 5s ease-in-out infinite; }
.shift .kbd { position: absolute; left: 12px; bottom: 10px; font-size: 10px; font-weight: 700; color: var(--muted); background: var(--surface); border: 1px solid var(--border); border-radius: 5px; padding: 2px 7px; animation: sh-kbd 5s ease-in-out infinite; }
.shift .cur { left: 14px; top: 30px; animation: sh-cur 5s ease-in-out infinite; }
@keyframes sh-cur {
  0%, 6% { left: 14px; top: 30px; transform: scale(1); }
  18% { left: 52px; top: 66px; transform: scale(1); }
  22% { transform: scale(.7); } 26% { transform: scale(1); }
  44% { left: 146px; top: 66px; transform: scale(1); }
  48% { transform: scale(.7); } 52% { transform: scale(1); }
  90% { left: 146px; top: 66px; opacity: 1; } 100% { left: 14px; top: 30px; opacity: 0; }
}
@keyframes sh-s1 { 0%, 20% { } 24%, 90% { border-color: var(--ai, #6d28d9); background: color-mix(in srgb, var(--ai, #6d28d9) 10%, var(--surface)); } 100% { } }
@keyframes sh-s2 { 0%, 46% { } 50%, 90% { border-color: var(--ai, #6d28d9); background: color-mix(in srgb, var(--ai, #6d28d9) 10%, var(--surface)); } 100% { } }
@keyframes sh-grp { 0%, 60% { opacity: 0; } 68%, 90% { opacity: 1; } 100% { opacity: 0; } }
@keyframes sh-kbd { 0%, 12% { color: var(--muted); } 16%, 84% { color: var(--ai, #6d28d9); border-color: var(--ai-border, #d9c9f5); } 100% { color: var(--muted); } }

/* ── 3 · empty group at the end ── */
.endg .e1 { left: 16px; top: 14px; width: 82px; height: 46px; }
.endg .e2 { left: 110px; top: 14px; width: 82px; height: 46px; }
.endg .bar { position: absolute; left: 16px; top: 74px; width: 176px; height: 34px; border: 1.5px dashed var(--border-strong, #c9d2de); border-radius: 9px; display: grid; place-items: center; color: var(--muted); font-size: 11px; font-weight: 600; animation: en-bar 5s ease-in-out infinite; }
.endg .gbox { left: 12px; top: 70px; width: 184px; height: 44px; animation: en-grp 5s ease-in-out infinite; }
.endg .cur { left: 40px; top: 40px; animation: en-cur 5s ease-in-out infinite; }
@keyframes en-cur {
  0%, 8% { left: 40px; top: 40px; transform: scale(1); }
  30% { left: 104px; top: 90px; transform: scale(1); }
  34% { transform: scale(.7); } 40% { transform: scale(1); }
  90% { left: 104px; top: 90px; opacity: 1; } 100% { left: 40px; top: 40px; opacity: 0; }
}
@keyframes en-bar { 0%, 34% { opacity: 1; } 42%, 100% { opacity: 0; } }
@keyframes en-grp { 0%, 40% { opacity: 0; transform: scale(.97); } 48%, 92% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(.97); } }

/* ── 4 · from the Add New Widget panel → Layout → Empty group ── */
.addw .np { position: absolute; inset: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 11px; overflow: hidden; }
.addw .np-tabs { display: flex; gap: 11px; font-size: 10px; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 7px; }
.addw .np-tabs b { color: var(--primary, #2563eb); font-weight: 700; border-bottom: 2px solid var(--primary, #2563eb); padding-bottom: 6px; margin-bottom: -7px; }
.addw .np-tabs span { color: var(--muted-2); }
.addw .np-lab { font-size: 8px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--muted-2); margin: 6px 0 4px; }
.addw .np-row { display: flex; gap: 7px; }
.addw .np-t { width: 36px; height: 26px; border: 1px solid var(--border); border-radius: 6px; display: grid; place-items: center; color: var(--muted); }
.addw .np-t :deep(.ico) { color: inherit; }
.addw .np-t.wide { width: auto; padding: 0 11px; height: 28px; display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 600; color: var(--ink-2); }
.addw .np-t.hot { animation: aw-hot 5s ease-in-out infinite; }
.addw .cur { left: 30px; top: 26px; animation: aw-cur 5s ease-in-out infinite; }
@keyframes aw-hot {
  0%, 42% { border-color: var(--border); background: transparent; color: var(--ink-2); }
  50%, 90% { border-color: var(--ai, #6d28d9); background: var(--ai-soft, #f2ecfe); color: var(--ai-ink, #6d28d9); }
  100% { border-color: var(--border); background: transparent; color: var(--ink-2); }
}
@keyframes aw-cur {
  0%, 10% { left: 30px; top: 26px; transform: scale(1); }
  42% { left: 64px; top: 104px; transform: scale(1); }
  48% { transform: scale(.7); } 54% { transform: scale(1); }
  90% { left: 64px; top: 104px; opacity: 1; } 100% { left: 30px; top: 26px; opacity: 0; }
}

/* caption + nav */
.gwc-cap { margin-top: 10px; }
.gwc-cap b { display: block; font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 2px; }
.gwc-cap span { font-size: 12px; line-height: 1.45; color: var(--ink-2); }
.gwc-nav { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 10px; }
.gwc-arrow { width: 28px; height: 28px; border: 1px solid var(--border); background: var(--surface); color: var(--ink-2); border-radius: 8px; display: grid; place-items: center; }
.gwc-arrow:hover { background: var(--surface-2); color: var(--ink); border-color: var(--ai, #6d28d9); }
.gwc-num { font-size: 12px; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; min-width: 40px; text-align: center; }

@media (prefers-reduced-motion: reduce) {
  .wa * { animation: none !important; }
  .shift .grp, .endg .gbox { opacity: 1; }
  .endg .bar, .cur { display: none; }
  .shift .t1, .shift .t2 { border-color: var(--ai, #6d28d9); background: color-mix(in srgb, var(--ai, #6d28d9) 10%, var(--surface)); }
  .addw .np-t.hot { border-color: var(--ai, #6d28d9); background: var(--ai-soft, #f2ecfe); color: var(--ai-ink, #6d28d9); }
}
</style>
