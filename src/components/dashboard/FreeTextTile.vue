<script setup>
/**
 * FreeTextTile — renders a Free Text tile's content (§4 Free Text). Not a chart: it
 * parses the markdown-lite content into heading / bullet / paragraph blocks and styles
 * them with tokens.css so it tracks light/dark. Consecutive bullets group under one <ul>.
 */
import { computed } from 'vue'
import { parseFreeText } from '../../data/freeText.js'

const props = defineProps({ content: { type: String, default: '' } })

// group the flat block list so consecutive bullets share one <ul>
const groups = computed(() => {
  const out = []
  for (const b of parseFreeText(props.content)) {
    if (b.type === 'li') {
      const last = out[out.length - 1]
      if (last && last.type === 'ul') last.items.push(b)
      else out.push({ type: 'ul', items: [b] })
    } else {
      out.push(b)
    }
  }
  return out
})
</script>

<template>
  <div class="ftx">
    <p v-if="!groups.length" class="ftx-empty">Nothing written yet.</p>
    <template v-for="(g, i) in groups" :key="i">
      <h4 v-if="g.type === 'h'" class="ftx-h">
        <template v-for="(s, j) in g.segments" :key="j"><a v-if="s.href" :href="s.href" target="_blank" rel="noopener noreferrer">{{ s.text }}</a><template v-else>{{ s.text }}</template></template>
      </h4>
      <ul v-else-if="g.type === 'ul'" class="ftx-ul">
        <li v-for="(li, k) in g.items" :key="k">
          <template v-for="(s, j) in li.segments" :key="j"><a v-if="s.href" :href="s.href" target="_blank" rel="noopener noreferrer">{{ s.text }}</a><template v-else>{{ s.text }}</template></template>
        </li>
      </ul>
      <p v-else class="ftx-p">
        <template v-for="(s, j) in g.segments" :key="j"><a v-if="s.href" :href="s.href" target="_blank" rel="noopener noreferrer">{{ s.text }}</a><template v-else>{{ s.text }}</template></template>
      </p>
    </template>
  </div>
</template>

<style scoped>
.ftx { height: 100%; overflow: auto; padding: 2px 2px 4px; color: var(--ink-2); font-size: 13.5px; line-height: 1.55; }
.ftx-empty { color: var(--muted); font-style: italic; margin: 0; }
.ftx-h { font-size: 15px; font-weight: 600; color: var(--ink); margin: 10px 0 6px; }
.ftx-h:first-child { margin-top: 0; }
.ftx-p { margin: 0 0 8px; }
.ftx-ul { margin: 0 0 8px; padding-left: 18px; }
.ftx-ul li { margin: 2px 0; }
.ftx a { color: var(--primary-700); text-decoration: none; border-bottom: 1px solid var(--primary-soft); }
.ftx a:hover { border-bottom-color: var(--primary); }
</style>
