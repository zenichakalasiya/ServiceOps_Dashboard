// Curated demo board for the AI Capabilities showcase (/ai).
// Separate from the seeded dashboards so the AI demo is stable and the anomaly
// story is baked in. KPI tiles carry `history` (prior periods, oldest→newest,
// excluding the current value) so the deterministic engine can compute a z-score
// — the product's KPIs don't normally store this; it's what makes P3-B real.
import { kpi, chart, shortcut } from './mock.js'

const WK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

// The P1 worklist — used both as a tile and as the record source the Deep-dive
// panel drills into (tier-1 honest drill). "Due" drives breach-imminence facts.
const P1_ROWS = [
  ['INC-2041', 'VPN down for finance team', 'P1', 'In Progress', 'Today 4:00 PM'],
  ['INC-2038', 'Email delivery delayed', 'P1', 'Open', 'Today 6:00 PM'],
  ['INC-2031', 'Payroll app 500 error', 'P1', 'In Progress', 'Today 5:15 PM'],
  ['INC-2029', 'SSO login failing for HR', 'P1', 'Open', 'Today 5:30 PM'],
  ['INC-2019', 'Printer fleet offline – 3rd floor', 'P2', 'Open', 'Tomorrow'],
  ['INC-2015', 'CRM API timeouts', 'P1', 'In Progress', 'Today 7:00 PM'],
  ['INC-2011', 'Wi-Fi outage – Pune office', 'P1', 'Open', 'Today 8:00 PM'],
  ['INC-2003', 'Firewall rule blocking payments', 'P1', 'Open', 'Today 9:00 PM'],
]

export function demoBoard() {
  return {
    id: 'ai-demo',
    name: 'Helpdesk Overview',
    role: 'technician',
    tiles: [
      // --- KPI row (history drives anomaly detection) ---
      // Open Tickets: gently up, in-pattern → NOT an anomaly.
      { ...kpi('Open Tickets', 248, '', { dir: 'up', pct: 4.2 }, 'warn', 'Count of requests in an open state, windowed by Created date.'),
        history: [236, 241, 238, 245, 240, 244, 239], metric: 'open', w: 3, h: 1 },
      // Overdue: 31 against a ~14 baseline → a clear statistical outlier (the anomaly the demo turns on).
      { ...kpi('Overdue', 31, '', { dir: 'up', pct: 121 }, 'bad', 'Open requests past their SLA due date.'),
        history: [12, 14, 13, 15, 12, 16, 14], metric: 'overdue', w: 3, h: 1 },
      // Resolved Today: healthy, in-pattern.
      { ...kpi('Resolved Today', 86, '', { dir: 'up', pct: 8 }, 'good', 'Requests moved to Resolved today.'),
        history: [78, 82, 80, 84, 79, 83, 81], metric: 'resolved', w: 3, h: 1 },
      // SLA Compliance: a mild dip — deliberately does NOT trip the badge (the restraint proof).
      { ...kpi('SLA Compliance', 94.2, '%', { dir: 'down', pct: 1.1 }, 'warn', 'Percent of requests resolved within SLA this window.'),
        history: [96, 95.5, 95, 95.3, 94.8, 95.1, 94.9], metric: 'sla', w: 3, h: 1 },
      // --- charts ---
      { ...chart('Created vs Resolved', { kind: 'bar', labels: WK, series: [{ name: 'Created', values: [42, 51, 38, 60, 55] }, { name: 'Resolved', values: [39, 48, 41, 57, 50] }] }, 'Daily created vs resolved request volume.'), w: 6, h: 2 },
      { ...chart('Tickets by Priority', { kind: 'donut', labels: ['P1', 'P2', 'P3', 'P4'], series: [{ name: 'Priority', values: [18, 64, 120, 46] }] }, 'Open requests split by priority.'), w: 3, h: 2 },
      { ...chart('Backlog Trend', { kind: 'area', labels: MON, series: [{ name: 'Backlog', values: [180, 210, 198, 240, 232, 248] }] }, 'Open backlog at month end.'), w: 3, h: 2 },
      // --- worklist (drill source) ---
      { ...shortcut('My Open P1 Requests', ['ID', 'Subject', 'Priority', 'Status', 'Due'], P1_ROWS, 'Requests assigned to me where priority = P1 and status is open.'), w: 6, h: 2 },
    ],
  }
}
