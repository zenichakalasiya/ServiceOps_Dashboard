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
const area = (labels, vals) => ({ kind: 'area', labels, series: [{ name: 'Volume', values: vals }] })
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

// Share-widget recipients (technicians + technician groups)
export const TECHNICIANS = [
  'Aarav Mehta', 'Meera Iyer', 'Rohan Patel', 'Priya Nair', 'Vikram Reddy',
  'Ananya Bose', 'Karan Gupta', 'Divya Menon', 'Arjun Rao', 'Nisha Shah',
]
export const TECH_GROUPS = [
  'Service Desk L1', 'Service Desk L2', 'Network Team', 'Asset & Procurement',
  'Change Advisory Board', 'All technicians',
]

const WK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

// Mirrors the real ServiceOps "Helpdesk Dashboard" (predefined) from the .185 instance:
// 6 KPI counters, 3 grouped charts (Status · Priority · Technician), 3 record lists.
// The live instance is near-empty (one test request), so values here are representative
// ITSM figures while every widget's title, type and group-by matches the real board.
function helpdeskTiles() {
  const TECHS = ['yash', 'RW', 'Juli Gopani', 'Sakshi', 'ahmedraza', 'Rosy', 'Keya', 'Jerry', 'Stuti', 'Nikhil', 'Unassigned']
  return [
    { ...kpi('Overdue Requests', 18, '', { dir: 'up', pct: 14 }, 'bad', 'Open requests past their SLA due date.'), w: 2 },
    // `dateFilter` = this widget overrides the dashboard time filter with its own range.
    // A few tiles carry one so the date-filter indicator demo has widgets to differentiate.
    { ...kpi('Requests Due In the 24 Hours', 24, '', { dir: 'up', pct: 9 }, 'warn', 'Open requests whose SLA due date falls within the next 24 hours.'), w: 2, dateFilter: 'Today' },
    { ...kpi('Open Requests', 248, '', { dir: 'up', pct: 4 }, 'warn', 'Count of requests in an open state.'), w: 2 },
    { ...kpi('Unassigned Requests', 12, '', { dir: 'down', pct: 6 }, 'warn', 'Open requests with no technician assigned.'), w: 2 },
    { ...kpi('My Open Requests', 9, '', { dir: 'up', pct: 3 }, 'good', 'Open requests assigned to me.'), w: 2 },
    { ...kpi('Urgent Open Requests', 6, '', { dir: 'up', pct: 20 }, 'bad', 'Open requests with priority Urgent.'), w: 2 },
    { ...chart('Open Requests By Status', { kind: 'donut', labels: ['Open', 'In Progress', 'Pending', 'Resolved', 'Closed'], series: [{ name: 'Requests', values: [96, 54, 30, 42, 26] }] }, 'Open requests grouped by status.'), w: 4 },
    { ...chart('Open Requests By Priority', { kind: 'donut', labels: ['Low', 'Medium', 'High', 'Urgent'], series: [{ name: 'Requests', values: [120, 78, 34, 16] }] }, 'Open requests grouped by priority.'), w: 4, dateFilter: 'Last 7 days' },
    { ...chart('Open Requests By Technician', { kind: 'hbar', labels: TECHS, series: [{ name: 'Total', values: [34, 28, 22, 19, 17, 14, 12, 9, 7, 5, 12] }] }, 'Open requests grouped by assigned technician.'), w: 4 },
    /* The legend problem in the flesh: 63 technicians on a pie. Above HIGH_CARD the
     * tile switches to the rank pill (Top N · Bottom N · range · coverage · All) and
     * pages the side legend to whatever the widget's height can hold. See
     * docs/legend-and-topn-design.md. */
    { ...chart('Requests by Technician — full estate', technicianLoad(), 'Every request grouped by assigned technician — 63 of them. Use the rank pill to bound the list, and page through the rest.'), w: 4 },
    { ...shortcut('My Open Requests', ['Subject', 'Requester', 'Status', 'Priority'],
      [['VPN down for finance team', 'Arnav Desai', 'In Progress', 'Urgent'],
       ['Email delivery delayed', 'Sarah Chen', 'Open', 'High'],
       ['Payroll app 500 error', 'Neha Gupta', 'In Progress', 'High'],
       ['SSO login failing for HR', 'Rahul Shukla', 'Open', 'Medium'],
       ['Wi-Fi outage – Pune office', 'Karan Mehta', 'Open', 'High']],
      'Open requests assigned to me.'), w: 4 },
    { ...shortcut('My Open Tasks', ['Subject', 'Reference', 'Status', 'Priority'],
      [['Provision laptop for new joiner', 'TASK-3021', 'Open', 'Medium'],
       ['Review firewall change', 'TASK-3018', 'In Progress', 'High'],
       ['Patch database servers', 'TASK-3009', 'Open', 'Urgent']],
      'Tasks assigned to me that are open.'), w: 4, dateFilter: 'This month' },
    { ...shortcut('My Pending Approvals', ['Requester Name', 'Created Date', 'Subject', 'Type'],
      [['Priya Nair', '18 Jul 2026', 'New software purchase — Figma', 'Service Request'],
       ['Vikram Deshpande', '17 Jul 2026', 'Access to production DB', 'Change']],
      'Approval requests waiting on me.'), w: 4 },
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

// Mirrors the real custom "test 1" dashboard from the .185 instance (a user-built board):
// 10 mixed request/patch counters + one custom line chart ("t1"). Representative values.
function test1Tiles() {
  return [
    { ...kpi('Manual OS Deployments', 3, '', { dir: 'up', pct: 0 }, 'good', 'OS images deployed manually.'), w: 2 },
    { ...kpi('Closed Requests', 142, '', { dir: 'up', pct: 8 }, 'good', 'Requests closed in this window.'), w: 2 },
    { ...kpi('Resolution Violated Requests', 5, '', { dir: 'up', pct: 12 }, 'bad', 'Requests that breached their resolution SLA.'), w: 2 },
    { ...kpi('Completed Patch Deployment (Last 7 Days)', 12, '', { dir: 'up', pct: 15 }, 'good', 'Patch deployments completed in the last 7 days.'), w: 2 },
    { ...kpi('My Open Requests', 9, '', { dir: 'up', pct: 3 }, 'good', 'Open requests assigned to me.'), w: 2 },
    { ...kpi('Installed Patches', 98, '', { dir: 'up', pct: 6 }, 'good', 'Patches installed across the estate.'), w: 2 },
    { ...kpi('Patch Records Expiring This Week', 2, '', { dir: 'up', pct: 0 }, 'warn', 'Patch deployment records expiring within 7 days.'), w: 2 },
    { ...kpi('First Response Violated Requests', 4, '', { dir: 'up', pct: 9 }, 'bad', 'Requests that breached their first-response SLA.'), w: 2 },
    { ...kpi('Passcode-Based OS Deployments', 1, '', { dir: 'up', pct: 0 }, 'good', 'OS deployments using a passcode.'), w: 2 },
    { ...kpi('Open Requests', 248, '', { dir: 'up', pct: 4 }, 'warn', 'Requests in an open state.'), w: 2 },
    { ...chart('t1', line(MON, [12, 18, 15, 22, 19, 24]), 'Custom line chart.'), w: 8 },
  ]
}

// Mirrors the real custom "Vulnerability and Remediation Dashboard" from .185 — captured
// widget-by-widget via Customize: 6 patch/asset counters and 6 patch charts, each with its
// exact group-by dimensions (statuses, categories, severities). The live instance is a
// sparse test setup, so values are representative while every category/series matches.
function vulnRemediationTiles() {
  const DAYS = ['14 Jul', '15 Jul', '16 Jul', '17 Jul', '18 Jul', '19 Jul', '20 Jul']
  return [
    { ...kpi('Pending Patch Installations (Last 24 Hours)', 8, '', { dir: 'up', pct: 12 }, 'warn', 'Patch installations pending in the last 24 hours.'), w: 2 },
    { ...kpi('Failed Patch Installations (Last 24 Hours)', 3, '', { dir: 'up', pct: 0 }, 'bad', 'Patch installations that failed in the last 24 hours.'), w: 2 },
    { ...kpi('Successful Patch Installations (Last 24 Hours)', 42, '', { dir: 'up', pct: 9 }, 'good', 'Patch installations that succeeded in the last 24 hours.'), w: 2 },
    { ...kpi('Completed Patch Deployment (Last 7 Days)', 12, '', { dir: 'up', pct: 15 }, 'good', 'Patch deployments completed in the last 7 days.'), w: 2 },
    { ...kpi('Total Hardware Assets', 2, '', { dir: 'up', pct: 0 }, 'good', 'Managed hardware assets.'), w: 2 },
    { ...kpi('Vulnerable Assets', 5, '', { dir: 'up', pct: 20 }, 'bad', 'Assets with open vulnerabilities awaiting remediation.'), w: 2 },
    { ...chart('Patch Deployment Status Summary (Last 30 Days)', { kind: 'donut', labels: ['Draft', 'Ready to Deploy', 'In Progress', 'Completed', 'Expired', 'Canceled', 'Partial Completed'], series: [{ name: 'Deployments', values: [4, 2, 3, 8, 1, 1, 2] }] }, 'Patch deployments grouped by status over the last 30 days.'), w: 6 },
    { ...chart('Patch Category Distribution per Deployment (Last 7 Days)', { kind: 'bar', labels: ['Tools', 'Feature Packs', 'Service Packs', 'Update Rollups', 'Definition Updates', 'Critical Updates', 'Updates', 'Security Updates', 'Hotfix', 'Upgrades'], series: [{ name: 'Patches', values: [2, 1, 3, 4, 5, 7, 1, 6, 2, 1] }] }, 'Patches grouped by category across deployments in the last 7 days.'), w: 6 },
    { ...chart('Download Status for Last 24 Hours', { kind: 'bar', labels: ['Pending', 'In Progress (File Server)', 'In Progress (Distribution Server)', 'Success', 'Failed', 'Canceled', 'Failed (Check Sum)', 'Pending on DMZ'], series: [{ name: 'Downloads', values: [6, 3, 2, 28, 3, 1, 1, 2] }] }, 'Patch downloads grouped by status in the last 24 hours.'), w: 6 },
    { ...chart('Installation Status for Last 24 Hours', { kind: 'bar', labels: ['Yet To Receive', 'In Progress', 'Success', 'Failed', 'Canceled', 'Not Applicable', 'Not Ready', 'Partially Installed', 'Received', 'Resolving Dependency', 'Downloading', 'Download Success'], series: [{ name: 'Installations', values: [4, 5, 34, 3, 1, 6, 2, 2, 8, 1, 3, 12] }] }, 'Patch installations grouped by status in the last 24 hours.'), w: 6 },
    { ...chart('Daily Report for Severity Deployed Patch Count', { kind: 'bar', labels: DAYS, series: [
      { name: 'Critical', values: [0, 3, 0, 1, 0, 0, 2] },
      { name: 'Important', values: [0, 5, 0, 0, 0, 1, 0] },
      { name: 'Moderate', values: [0, 1, 0, 0, 0, 0, 0] },
      { name: 'Low', values: [0, 0, 0, 1, 0, 0, 0] },
      { name: 'Unspecified', values: [0, 8, 0, 0, 0, 0, 0] },
    ] }, 'Deployed patch count grouped by severity, per day.'), w: 8 },
    { ...chart('Daily Report for Patch Installation Task', { kind: 'line', labels: DAYS, series: [{ name: 'Tasks', values: [0, 5, 0, 0, 0, 0, 0] }] }, 'Patch installation tasks per day.'), w: 4 },
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
    { name: 'Helpdesk Overview', folder: 'f-svc', category: 'Service Desk', owner: 'Aarav Mehta', access: 'public', predefined: true, favorite: true, certified: true, description: 'Predefined service-desk board (mirrors ServiceOps “Helpdesk Dashboard”): request counters, status/priority/technician breakdowns, and my worklists.', tiles: helpdeskTiles(), updated: days(0) },
    { name: 'Executive Summary', folder: 'f-lead', category: 'Leadership', owner: 'Vikram Deshpande', access: 'restricted', predefined: true, favorite: true, description: 'Leadership KPIs — MTTR, CSAT, backlog and volume trends.', tiles: execTiles(), updated: days(1), sharedWithMe: true },
    { name: 'Asset & Patch Health', folder: 'f-noc', category: 'Assets', owner: 'Priya Nair', access: 'public', predefined: true, favorite: false, description: 'Hardware estate, warranty, patch compliance and expiring contracts.', tiles: assetTiles(), updated: days(2) },
    { name: 'Network NOC Wall', folder: 'f-noc', category: 'NOC', owner: 'Rohan Iyer', access: 'restricted', predefined: false, favorite: false, description: 'Operations wallboard for the network team.', tiles: helpdeskTiles().slice(0, 6), updated: days(3), sharedWithMe: true },
    { name: 'Helpdesk Dashboard - 02-12-2022', folder: null, category: '', owner: 'Sneha Patil', access: 'private', predefined: false, favorite: false, description: '', tiles: helpdeskTiles().slice(0, 4), updated: days(540), clone: true },
    { name: 'Asset', folder: null, category: '', owner: 'Sneha Patil', access: 'private', predefined: false, favorite: false, description: '', tiles: assetTiles().slice(0, 3), updated: days(120), clone: true },
    { name: 'test 1', folder: 'f-mine', category: '', owner: 'Aarav Mehta', access: 'private', predefined: false, favorite: false, description: 'Custom board (mirrors the “test 1” dashboard on the ServiceOps instance): mixed request/patch counters and a custom line chart.', tiles: test1Tiles(), updated: days(3), mine: true },
    { name: 'Vulnerability and Remediation Dashboard', folder: 'f-noc', category: 'Patch Management', owner: 'Aarav Mehta', access: 'public', predefined: false, favorite: false, description: 'Custom board (mirrors the “Vulnerability and Remediation Dashboard” on the ServiceOps instance): patch installation/deployment counters plus status, category and severity breakdowns.', tiles: vulnRemediationTiles(), updated: days(1), mine: true },
    { name: 'My SLA drafts', folder: 'f-mine', category: '', owner: 'Aarav Mehta', access: 'private', predefined: false, favorite: false, description: 'Work in progress — includes empty-widget state demos.', tiles: [...execTiles().slice(0, 3), ...demoStateTiles()], updated: days(5), mine: true },
  ].map((d, i) => ({
    id: uid('d'), enabled: true, archived: false, default: i === 0, groups: [],
    history: demoHistory(), schedules: demoSchedules(),
    mine: d.owner === 'Aarav Mehta', viewedAt: i < 3 ? days(i) : null, ...d,
    // Tag each tile's provenance so the dashboard can show a predefined / user / shared icon.
    //
    // `seeded` = this tile SHIPPED WITH a predefined dashboard, so it can't be
    // removed. It is deliberately NOT the same thing as `prov: 'predefined'`:
    //   · seeded predefined tile      → can't delete, restricted edit
    //   · predefined tile the USER added → CAN delete (they placed it), restricted edit
    //   · user tile the USER added       → can delete, full edit
    // Deletability follows who put the tile there; editability follows who owns
    // its definition. Conflating the two is what made the earlier board-level lock
    // wrong — it froze even the widgets the user had added themselves.
    tiles: d.tiles.map((t) => ({
      ...t,
      prov: t.prov || (d.predefined ? 'predefined' : d.sharedWithMe ? 'shared' : 'user'),
      ...(d.predefined && t.prov !== 'user' ? { seeded: true } : {}),
    })),
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
