/**
 * aiTeaser — the one-line, grounded "AI insights" teaser shared by every placement of the
 * entry point: the banner (AiSummaryCard), the header chip's popover (AiInsightChip) and the
 * KPI-row card (AiInsightCard). One source so all three read the SAME count and sentence, and
 * so nothing here invents a number — it is all `facts()` from the deterministic engine.
 */
import { computed } from 'vue'
import { facts as computeFacts } from './aiEngine.js'

// pass a getter (or a ref/plain object) for the board so the teaser stays reactive
export function useAiTeaser(getBoard) {
  const board = computed(() => (typeof getBoard === 'function' ? getBoard() : (getBoard?.value ?? getBoard)))
  const attention = computed(() =>
    computeFacts(board.value).filter((f) => f.severity === 'bad' || f.severity === 'warn'))
  const count = computed(() => attention.value.length)
  const summary = computed(() => {
    const b = board.value
    const tiles = b?.tiles || []
    if (!tiles.length) return `“${b?.name}” has no widgets yet — add one and I’ll start summarising it.`
    const n = attention.value.length
    if (!n) return `“${b?.name}” looks healthy — all ${tiles.length} widgets are within range right now.`
    const top = attention.value[0]
    const more = n > 1 ? ` ${n - 1} other${n - 1 > 1 ? 's are' : ' is'} worth watching.` : ''
    return `${n} thing${n > 1 ? 's' : ''} need attention on “${b?.name}”. Top of the list: ${top.text}.${more}`
  })
  return { board, attention, count, summary }
}

// the three deep-dive CTAs, in the order every placement shows them. Each opens the real
// assistant with its own intent (analyzing = full-dashboard insights).
export const AI_TEASER_CTAS = [
  { label: 'Insights with AI', intent: 'analyzing', icon: 'sparkles', primary: true },
  { label: 'Every widget explained', intent: 'widgets', icon: 'auto-graph' },
  { label: 'Add a new widget', intent: 'suggestwidget', icon: 'plus' },
]
