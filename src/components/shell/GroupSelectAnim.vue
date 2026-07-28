<script setup>
/**
 * GroupSelectAnim — a small looping "video" that demonstrates the grouping gesture:
 * a marquee box is dragged across two widget tiles, they highlight as selected, and
 * a "New group" container forms around them. Pure CSS keyframes, no assets. Used in
 * the tour to teach a gesture that is otherwise discoverable-only.
 *
 * Reduced-motion viewers see the grouped end-state, held still.
 */
</script>

<template>
  <div class="gsa" aria-hidden="true">
    <div class="tile t1" /><div class="tile t2" /><div class="tile t3" />
    <div class="marquee" />
    <div class="group"><span class="glabel">New group</span></div>
    <div class="cursor" />
  </div>
</template>

<style scoped>
.gsa {
  position: relative; width: 300px; max-width: 100%; height: 138px;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
}
/* three widget tiles in a row */
.tile { position: absolute; top: 38px; width: 82px; height: 64px; border-radius: 8px; background: var(--surface); border: 1.5px solid var(--border); }
.t1 { left: 16px; } .t2 { left: 110px; } .t3 { left: 204px; }
.t1, .t2 { animation: sel 5s ease-in-out infinite; }

/* the drag-selection rectangle */
.marquee {
  position: absolute; left: 18px; top: 40px; width: 4px; height: 4px; opacity: 0;
  border: 1.5px dashed var(--ai, #6d28d9); border-radius: 5px;
  background: color-mix(in srgb, var(--ai, #6d28d9) 10%, transparent);
  animation: marquee 5s ease-in-out infinite;
}
/* the resulting group container */
.group {
  position: absolute; left: 8px; top: 28px; width: 192px; height: 84px; opacity: 0;
  border: 1.5px solid var(--ai, #6d28d9); border-radius: 11px;
  background: color-mix(in srgb, var(--ai, #6d28d9) 6%, transparent);
  animation: grp 5s ease-in-out infinite;
}
.glabel {
  position: absolute; top: -9px; left: 10px; font-size: 9px; font-weight: 700; letter-spacing: .02em;
  color: #fff; background: var(--ai, #6d28d9); border-radius: 5px; padding: 1px 6px; white-space: nowrap;
}
/* a little pointer following the drag */
.cursor {
  position: absolute; left: 16px; top: 38px; width: 10px; height: 10px; border-radius: 50%;
  background: var(--ai, #6d28d9); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ai, #6d28d9) 25%, transparent);
  animation: cursor 5s ease-in-out infinite;
}

@keyframes marquee {
  0%, 8% { opacity: 0; width: 4px; height: 4px; }
  10% { opacity: 1; }
  34% { opacity: 1; width: 182px; height: 68px; }
  46% { opacity: 1; width: 182px; height: 68px; }
  52%, 100% { opacity: 0; width: 182px; height: 68px; }
}
@keyframes cursor {
  0%, 8% { left: 16px; top: 38px; opacity: 1; }
  34% { left: 196px; top: 104px; opacity: 1; }
  46% { left: 196px; top: 104px; opacity: 1; }
  54% { opacity: 0; }
  88% { left: 196px; top: 104px; opacity: 0; }
  100% { left: 16px; top: 38px; opacity: 0; }
}
@keyframes sel {
  0%, 32% { border-color: var(--border); background: var(--surface); }
  40%, 88% { border-color: var(--ai, #6d28d9); background: color-mix(in srgb, var(--ai, #6d28d9) 10%, var(--surface)); }
  100% { border-color: var(--border); background: var(--surface); }
}
@keyframes grp {
  0%, 46% { opacity: 0; transform: scale(.96); }
  54%, 88% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(.96); }
}

/* reduced motion: hold the grouped result still, no drag */
@media (prefers-reduced-motion: reduce) {
  .tile, .marquee, .group, .cursor { animation: none; }
  .marquee, .cursor { display: none; }
  .t1, .t2 { border-color: var(--ai, #6d28d9); background: color-mix(in srgb, var(--ai, #6d28d9) 10%, var(--surface)); }
  .group { opacity: 1; transform: none; }
}
</style>
