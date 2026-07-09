// Seed data for the ServiceOps Dashboards revamp prototype.
// Mock only — no backend. Shapes are intentionally close to the real module
// (KPI / Widget / Shortcut tiles; Public/Private/Restricted access; folders/categories).

let _id = 100
export const uid = (p = 'id') => `${p}-${++_id}`

const days = (n) => { const d = new Date(2026, 5, 27); d.setDate(d.getDate() - n); return d.toISOString() }

// ---- sample series helpers ----
const bars = (labels, vals) => ({ kind: 'bar', labels, series: [{ name: 'Tickets', values: vals }] })
const grouped = (labels, a, b) => ({ kind: 'bar', labels, series: [{ name: 'Created', values: a }, { name: 'Resolved', values: b }] })
const line = (labels, vals) => ({ kind: 'line', labels, series: [{ name: 'Volume', values: vals }] })
const donut = (labels, vals) => ({ kind: 'donut', labels, series: [{ name: 'By priority', values: vals }] })

// A deliberately high-cardinality field: 63 technicians with a long tail.
// This is the shape that breaks legends (L105 / L166) — the legend demo needs it.
const FIRST = ['Aarav', 'Meera', 'Rohan', 'Priya', 'Vikram', 'Ananya', 'Karan', 'Divya', 'Arjun', 'Nisha',
  'Siddharth', 'Kavya', 'Rahul', 'Ishita', 'Manav', 'Sneha', 'Aditya', 'Pooja', 'Nikhil', 'Riya',
  'Varun', 'Tanvi', 'Harsh', 'Lakshmi']
const LAST = ['Sharma', 'Iyer', 'Patel', 'Nair', 'Reddy', 'Bose', 'Gupta', 'Menon', 'Rao', 'Shah', 'Verma']
function technicianLoad(n = 63) {
  const labels = [], values = []
  for (let i = 0; i < n; i++) {
    labels.push(`${FIRST[i % FIRST.length]} ${LAST[(i * 7 + 3) % LAST.length]}`)
    // Zipf-ish decay + a deterministic wobble, so a few carry most of the load.
    values.push(Math.max(1, Math.round(240 / (i + 1.6) + ((i * 37) % 11))))
  }
  // dedupe collisions from the name generator so keys stay unique
  const seen = new Map()
  const uniq = labels.map((l) => {
    const c = (seen.get(l) || 0) + 1; seen.set(l, c)
    return c > 1 ? `${l} (${c})` : l
  })
  return { kind: 'donut', labels: uniq, series: [{ name: 'Tickets', values }] }
}

// ---- tile factories ----
export const kpi = (title, value, unit, delta, status, info) =>
  ({ id: uid('t'), type: 'kpi', title, info, value, unit, delta, status, w: 3, h: 1 })
export const chart = (title, data, info) =>
  ({ id: uid('t'), type: 'chart', title, info, chart: data, w: 6, h: 2 })
export const shortcut = (title, columns, rows, info) =>
  ({ id: uid('t'), type: 'shortcut', title, info, columns, rows, w: 6, h: 2 })

const WK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

function helpdeskTiles() {
  return [
    kpi('Open Tickets', 248, '', { dir: 'up', pct: 4.2 }, 'warn', 'Count of requests in an open state, windowed by Created date.'),
    kpi('Overdue', 31, '', { dir: 'up', pct: 12 }, 'bad', 'Open requests past their SLA due date.'),
    kpi('Resolved Today', 86, '', { dir: 'up', pct: 8 }, 'good', 'Requests moved to Resolved today.'),
    kpi('SLA Compliance', 94.2, '%', { dir: 'down', pct: 1.1 }, 'warn', 'Percent of requests resolved within SLA this window.'),
    chart('Created vs Resolved', grouped(WK, [42, 51, 38, 60, 55, 22, 18], [39, 48, 41, 57, 50, 25, 20]), 'Daily created vs resolved request volume.'),
    chart('Tickets by Priority', donut(['P1', 'P2', 'P3', 'P4'], [18, 64, 120, 46]), 'Open requests split by priority.'),
    chart('Backlog Trend', line(MON, [180, 210, 198, 240, 232, 248]), 'Open backlog at month end.'),
    { ...chart('Tickets by Technician', technicianLoad(63), 'Open requests grouped by assigned technician — 63 distinct values.'), w: 12, h: 3, highCard: true },
    shortcut('My Open P1 Requests',
      ['ID', 'Subject', 'Priority', 'Status', 'Due'],
      [['INC-2041', 'VPN down for finance team', 'P1', 'In Progress', 'Today 4:00 PM'],
       ['INC-2038', 'Email delivery delayed', 'P1', 'Open', 'Today 6:00 PM'],
       ['INC-2031', 'Payroll app 500 error', 'P1', 'In Progress', 'Tomorrow'],
       ['INC-2029', 'SSO login failing for HR', 'P1', 'Open', 'Today 5:30 PM'],
       ['INC-2024', 'Database replication lag', 'P1', 'In Progress', 'Tomorrow'],
       ['INC-2019', 'Printer fleet offline – 3rd floor', 'P1', 'Open', 'Today 7:00 PM'],
       ['INC-2015', 'CRM API timeouts', 'P1', 'In Progress', 'Tomorrow'],
       ['INC-2011', 'Wi-Fi outage – Pune office', 'P1', 'Open', 'Today 8:00 PM'],
       ['INC-2007', 'Backup job failed overnight', 'P1', 'In Progress', 'Tomorrow'],
       ['INC-2003', 'Firewall rule blocking payments', 'P1', 'Open', 'Today 9:00 PM']],
      'Requests assigned to me where priority = P1 and status is open.'),
  ]
}
function assetTiles() {
  return [
    kpi('Total Assets', 4820, '', { dir: 'up', pct: 2 }, 'good', 'All managed hardware + software assets.'),
    kpi('Out of Warranty', 312, '', { dir: 'up', pct: 6 }, 'warn', 'Hardware assets past warranty end date.'),
    kpi('Unassigned', 47, '', { dir: 'down', pct: 9 }, 'good', 'Assets with no assigned user.'),
    chart('Assets by Type', bars(['Laptop', 'Desktop', 'Server', 'Mobile', 'Network'], [2100, 1200, 320, 900, 300]), 'Hardware asset count by type.'),
    chart('Patch Compliance', donut(['Compliant', 'Pending', 'Failed'], [3800, 700, 320]), 'Endpoint patch status.'),
    shortcut('Expiring Contracts',
      ['Contract', 'Vendor', 'Value', 'Expires'],
      [['CNT-118', 'Dell', '₹ 12.4L', '14 days'], ['CNT-094', 'Microsoft', '₹ 38.0L', '22 days']],
      'Contracts expiring within 30 days.'),
  ]
}
function execTiles() {
  return [
    kpi('MTTR', 6.4, 'h', { dir: 'down', pct: 7 }, 'good', 'Mean time to resolve this window.'),
    kpi('CSAT', 4.3, '/5', { dir: 'up', pct: 3 }, 'good', 'Average customer satisfaction.'),
    kpi('Backlog', 248, '', { dir: 'up', pct: 4 }, 'warn', 'Open request backlog.'),
    chart('Volume by Month', line(MON, [820, 910, 880, 1020, 990, 1040]), 'Total requests per month.'),
    chart('Requests by Team', bars(['Helpdesk', 'Network', 'Apps', 'Infra'], [420, 210, 300, 110]), 'Open requests by team.'),
  ]
}

// demo tiles that showcase the empty-widget states (unconfigured / error / no-data)
function demoStateTiles() {
  return [
    { id: uid('t'), type: 'kpi', title: 'Draft KPI', info: 'Not wired to a data source yet.', state: 'unconfigured', value: null, w: 3, h: 1 },
    { id: uid('t'), type: 'chart', title: 'Revenue (load failed)', info: 'Simulated fetch error — hit Retry.', state: 'error', chart: bars(['A', 'B', 'C'], [12, 20, 8]), w: 6, h: 2 },
    shortcut('Escalations (empty)', ['ID', 'Subject', 'Status'], [], 'No records match this query in the current range.'),
  ]
}

// change/version history (per dashboard)
function demoHistory() {
  return [
    { event: 'Update Access Level', date: '2026-04-29', when: '29 Apr 2026 07:38 PM', module: 'Dashboard', user: 'Sakshi', summary: 'Access level updated from Public to Restricted.' },
    { event: 'Update Restricted Group', date: '2026-04-29', when: '29 Apr 2026 07:38 PM', module: 'Dashboard', user: 'Sakshi', summary: "For access level 'Restricted' updated groups to Service Desk." },
    { event: 'Add Widget', date: '2025-05-23', when: '23 May 2025 10:14 AM', module: 'Widget', user: 'Jeremy Draper', summary: 'Added widget “Created vs Resolved”.' },
    { event: 'Rename Dashboard', date: '2024-11-13', when: '13 Nov 2024 11:31 AM', module: 'Dashboard', user: 'Rakesh Rathod', summary: 'Renamed dashboard.' },
    { event: 'Update Access Level', date: '2024-11-13', when: '13 Nov 2024 11:29 AM', module: 'Dashboard', user: 'Rakesh Rathod', summary: 'Access level updated from Public to Restricted.' },
    { event: 'Create Dashboard', date: '2022-12-02', when: '02 Dec 2022 03:21 PM', module: 'Dashboard', user: 'Aarav Mehta', summary: 'Dashboard created.' },
  ]
}
// scheduled deliveries (per dashboard)
function demoSchedules() {
  return [
    { id: uid('sch'), name: 'Weekly SLA report', type: 'Weekly', timeFilter: 'This Week', enabled: true },
    { id: uid('sch'), name: 'Daily digest', type: 'Daily', timeFilter: 'Today', enabled: false },
  ]
}

const owners = ['Aarav Mehta', 'Priya Nair', 'Rohan Iyer', 'Sneha Patil', 'Vikram Deshpande']

export function seed() {
  const folders = [
    { id: 'f-lead', name: 'Leadership', color: '#7b68ee' },
    { id: 'f-noc', name: 'NOC / Ops', color: '#2f80ed' },
    { id: 'f-svc', name: 'Service Desk', color: '#1f9d63' },
    { id: 'f-mine', name: 'My drafts', color: '#d98a0b' },
  ]

  const dashboards = [
    { name: 'Helpdesk Overview', folder: 'f-svc', category: 'Service Desk', owner: 'Aarav Mehta', access: 'public', predefined: true, favorite: true, certified: true, description: 'Live service-desk health: open volume, SLA, backlog and P1 worklist.', tiles: [...helpdeskTiles().map((t) => (['Open Tickets', 'Overdue', 'Created vs Resolved'].includes(t.title) ? { ...t, sel: true } : t)), { ...chart('My SLA Trend (custom)', line(MON, [88, 90, 91, 93, 92, 94]), 'A custom widget you built — editable and deletable.'), prov: 'user' }], updated: days(0) },
    { name: 'Executive Summary', folder: 'f-lead', category: 'Leadership', owner: 'Vikram Deshpande', access: 'restricted', predefined: true, favorite: true, description: 'Leadership KPIs — MTTR, CSAT, backlog and volume trends.', tiles: execTiles(), updated: days(1), sharedWithMe: true },
    { name: 'Asset & Patch Health', folder: 'f-noc', category: 'Assets', owner: 'Priya Nair', access: 'public', predefined: true, favorite: false, description: 'Hardware estate, warranty, patch compliance and expiring contracts.', tiles: assetTiles(), updated: days(2) },
    { name: 'Network NOC Wall', folder: 'f-noc', category: 'NOC', owner: 'Rohan Iyer', access: 'restricted', predefined: false, favorite: false, description: 'Operations wallboard for the network team.', tiles: helpdeskTiles().slice(0, 6), updated: days(3), sharedWithMe: true },
    { name: 'Helpdesk Dashboard - 02-12-2022', folder: null, category: '', owner: 'Sneha Patil', access: 'private', predefined: false, favorite: false, description: '', tiles: helpdeskTiles().slice(0, 4), updated: days(540), clone: true },
    { name: 'Asset', folder: null, category: '', owner: 'Sneha Patil', access: 'private', predefined: false, favorite: false, description: '', tiles: assetTiles().slice(0, 3), updated: days(120), clone: true },
    { name: 'My SLA drafts', folder: 'f-mine', category: '', owner: 'Aarav Mehta', access: 'private', predefined: false, favorite: false, description: 'Work in progress — includes empty-widget state demos.', tiles: [...execTiles().slice(0, 3), ...demoStateTiles()], updated: days(5), mine: true },
  ].map((d, i) => ({
    id: uid('d'), enabled: true, archived: false, default: i === 0, groups: [],
    history: demoHistory(), schedules: demoSchedules(),
    mine: d.owner === 'Aarav Mehta', viewedAt: i < 3 ? days(i) : null, ...d,
    // tag each tile's provenance so the dashboard can show a predefined / user / shared icon
    tiles: d.tiles.map((t) => ({ ...t, prov: t.prov || (d.predefined ? 'predefined' : d.sharedWithMe ? 'shared' : 'user') })),
    // Technician Access Level + Technician Group Access Level (from .185 Manage list)
    techAccess: d.access === 'public' ? ['All technicians']
      : d.access === 'private' ? [d.owner]
      : ['Aarav Mehta', 'Rohan Iyer', 'Sneha Patil'],
    groupAccess: d.access === 'public' ? ['All technician groups']
      : d.access === 'private' ? []
      : ['Service Desk', 'Network Team'],
  }))

  // Library of reusable tiles for the Add-Widget flow
  const modules = ['Request', 'Asset', 'Problem', 'Change', 'Contract', 'Service Catalog']
  const lib = []
  const push = (type, title, prov, module, fav = false, sharedAccess = 'view') => lib.push({ id: uid('lt'), type, title, prov, module, favorite: fav, sharedAccess })
  // predefined
  push('kpi', 'Open Requests', 'predefined', 'Request', true)
  push('kpi', 'SLA Compliance %', 'predefined', 'Request', true)
  push('kpi', 'MTTR', 'predefined', 'Request')
  push('kpi', 'Out-of-Warranty Assets', 'predefined', 'Asset')
  push('chart', 'Created vs Resolved', 'predefined', 'Request', true)
  push('chart', 'Tickets by Priority', 'predefined', 'Request')
  push('chart', 'Assets by Type', 'predefined', 'Asset')
  push('chart', 'Backlog Trend', 'predefined', 'Request')
  push('shortcut', 'My Open P1 Requests', 'predefined', 'Request', true)
  push('shortcut', 'Expiring Contracts', 'predefined', 'Contract')
  // user-defined (incl. some junk-named to show the predefined badge value)
  push('kpi', 'Network P1s', 'user', 'Request')
  push('kpi', 'sla violetd', 'user', 'Request')
  push('chart', 'Changes by Risk', 'user', 'Change')
  push('chart', 'tete', 'user', 'Problem')
  push('kpi', 'ssss', 'user', 'Request')
  push('shortcut', 'Failing CIs', 'user', 'Asset')
  // shared with me — 3 widgets + 1 KPI (owner grants View or Edit access)
  push('chart', 'Vendor Spend', 'shared', 'Contract', false, 'view')
  push('chart', 'Change Success Rate', 'shared', 'Change', false, 'edit')
  push('chart', 'Asset Aging', 'shared', 'Asset', false, 'view')
  push('kpi', 'Patch Compliance %', 'shared', 'Asset', false, 'both')

  return { folders, dashboards, library: lib, modules, owners }
}

export const ACCESS = {
  public: { label: 'Public', icon: 'globe', chip: 'chip-blue' },
  private: { label: 'Private', icon: 'lock', chip: 'chip' },
  restricted: { label: 'Restricted', icon: 'users', chip: 'chip-amber' },
}
export const CATEGORIES = ['Service Desk', 'Leadership', 'Assets', 'NOC', 'Security', 'Finance', 'Projects']
export const TILE_META = {
  kpi: { label: 'KPI', icon: 'kpi', desc: 'A headline number with target & delta' },
  chart: { label: 'Widget', icon: 'chart-bar', desc: 'A chart — line, bar, column or pie' },
  shortcut: { label: 'Shortcut', icon: 'table', desc: 'A record list / table' },
}
export const ASSET_TYPES = ['Hardware', 'Software', 'Non-IT', 'Consumable']
