// Shared by the Manage-all list and the Shortcut tables, so both filter the same way.
//
// A field is worth filtering ON only if its values REPEAT. A column of unique
// values (a ticket ID, a subject line) has as many options as rows, which is a
// list, not a filter — those stay reachable through search instead.
const MAX_OPTIONS = 25

export function fieldsFrom(columns, rows, { max = MAX_OPTIONS } = {}) {
  const n = rows.length
  return columns
    .map((label, i) => {
      const options = [...new Set(rows.map((r) => String(r[i] ?? '').trim()))].filter(Boolean).sort()
      return { key: String(i), label, options }
    })
    .filter((f) => {
      const k = f.options.length
      if (k < 2) return false           // one option matches every row — that filters nothing
      if (k > max) return false         // a haystack, not a filter
      // Every value distinct (an ID, a subject line) → the list IS the data. Picking
      // from it is just choosing rows by hand; that is what search is for.
      if (n > 2 && k === n) return false
      return true
    })
}

// values within a field are OR; fields are AND
export function matchesFilters(getValue, model) {
  return Object.entries(model).every(([key, picked]) =>
    !picked?.length || picked.includes(String(getValue(key) ?? '').trim()))
}
