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
  { title: 'From the + menu', caption: 'The + (Create) menu has an “Empty group” option too.' },
]
const idx = ref(0)
const DWELL = 5200
let timer = null
function arm() { clearInterval(timer); timer = setInterval(() => { idx.value = (idx.value + 1) % WAYS.length }, DWELL) }
function go(n) { idx.value = (n + WAYS.length) % WAYS.length; arm() }
onMounted(arm)
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="gwc">
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

          <!-- 4 · from the + menu -->
          <div v-else class="wa menu">
            <div class="tile m1" /><div class="tile m2" />
            <div class="grp mbox"><span class="glabel">New group</span></div>
            <div class="menu-pop">
              <span class="mrow"><i class="mi ai" />Generate with AI</span>
              <span class="mrow"><i class="mi" />Create widget</span>
              <span class="mrow hot"><i class="mi grp-ic" />Empty group</span>
            </div>
            <div class="fab">+</div>
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

/* ── 4 · from the + menu ── */
.menu .m1 { left: 16px; top: 14px; width: 82px; height: 50px; }
.menu .m2 { left: 110px; top: 14px; width: 82px; height: 50px; }
.menu .mbox { left: 12px; top: 10px; width: 184px; height: 58px; animation: mn-grp 5s ease-in-out infinite; }
.menu .fab { position: absolute; right: 12px; bottom: 12px; width: 30px; height: 30px; border-radius: 50%; background: var(--primary, #2563eb); color: #fff; display: grid; place-items: center; font-size: 20px; font-weight: 300; line-height: 1; }
.menu .menu-pop { position: absolute; right: 12px; bottom: 48px; width: 150px; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; box-shadow: var(--sh-pop, 0 8px 24px rgba(0,0,0,.14)); padding: 4px; transform-origin: bottom right; animation: mn-pop 5s ease-in-out infinite; }
.menu .mrow { display: flex; align-items: center; gap: 7px; font-size: 10.5px; color: var(--ink-2); padding: 5px 6px; border-radius: 6px; }
.menu .mrow.hot { animation: mn-hot 5s ease-in-out infinite; }
.menu .mi { width: 12px; height: 12px; border-radius: 3px; background: var(--muted-2, #9aa6b5); flex: none; }
.menu .mi.ai { background: var(--ai, #6d28d9); } .menu .mi.grp-ic { background: var(--ai, #6d28d9); opacity: .6; }
.menu .cur { right: 40px; bottom: 40px; left: auto; top: auto; animation: mn-cur 5s ease-in-out infinite; }
@keyframes mn-pop { 0%, 16% { opacity: 0; transform: scale(.9); } 22%, 66% { opacity: 1; transform: scale(1); } 74%, 100% { opacity: 0; transform: scale(.9); } }
@keyframes mn-hot { 0%, 40% { background: transparent; } 46%, 66% { background: var(--ai-soft, #f2ecfe); } 100% { background: transparent; } }
@keyframes mn-grp { 0%, 68% { opacity: 0; transform: scale(.97); } 76%, 94% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(.97); } }
@keyframes mn-cur {
  0%, 6% { right: 28px; bottom: 28px; transform: scale(1); }
  16% { right: 26px; bottom: 30px; transform: scale(.7); } 20% { transform: scale(1); }
  48% { right: 120px; bottom: 66px; transform: scale(1); }
  54% { transform: scale(.7); } 60% { transform: scale(1); }
  90% { right: 120px; bottom: 66px; opacity: 1; } 100% { right: 28px; bottom: 28px; opacity: 0; }
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
  .shift .t1, .shift .t2, .endg .gbox, .menu .mbox { }
  .shift .grp, .endg .gbox, .menu .mbox { opacity: 1; }
  .endg .bar, .menu .menu-pop, .cur { display: none; }
  .shift .t1, .shift .t2 { border-color: var(--ai, #6d28d9); background: color-mix(in srgb, var(--ai, #6d28d9) 10%, var(--surface)); }
}
</style>
