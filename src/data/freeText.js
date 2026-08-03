/**
 * freeText.js — the block parser for the Free Text tile (§4 Free Text). No data query,
 * no ECharts: a Free Text tile stores { type:'text', content } and renders from this.
 *
 * Grammar (line-based; blank lines dropped):
 *   '# ' prefix → heading  (type 'h')
 *   '- ' prefix → bullet   (type 'li')
 *   any other non-empty line → paragraph (type 'p')
 * Inline (the only inline markup): [label](url) → a link segment { text, href };
 * everything else on the line is a plain { text } segment.
 */
function parseInline(text) {
  const segments = []
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index) })
    segments.push({ text: m[1], href: m[2] })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  if (!segments.length) segments.push({ text: '' })   // never an empty segment list
  return segments
}

export function parseFreeText(content) {
  const src = content == null ? '' : String(content)
  const blocks = []
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\s+$/, '')   // drop trailing whitespace
    if (!line.trim()) continue             // skip blank lines
    let type, text
    if (line.startsWith('# ')) { type = 'h'; text = line.slice(2) }
    else if (line.startsWith('- ')) { type = 'li'; text = line.slice(2) }
    else { type = 'p'; text = line }
    blocks.push({ type, segments: parseInline(text) })
  }
  return blocks
}
