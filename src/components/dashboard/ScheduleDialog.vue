<script setup>
import { ref, reactive, computed } from 'vue'
import Icon from '../ui/Icon.vue'
import Dropdown from '../ui/Dropdown.vue'
import { store, toast } from '../../store/index.js'
import { uid } from '../../data/mock.js'
const props = defineProps({ d: Object })
const emit = defineEmits(['close'])

if (!props.d.schedules) props.d.schedules = []
const view = ref('list')          // list | form
const search = ref('')
const list = computed(() => props.d.schedules.filter((s) => s.name.toLowerCase().includes(search.value.trim().toLowerCase())))

// ---- option lists ----
const TIME_FILTERS = ['Today', 'Last 7 days', 'Last 15 days', 'Last 30 days', 'This Week', 'This Month']
const SCHEDULE_TYPES = ['Once', 'Daily', 'Weekly', 'Monthly']
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const OCCUR = ['First', 'Second', 'Third', 'Fourth', 'Last']
const GROUPS = ['Service Desk', 'Network Team', 'NOC Viewers']
const HH = [...Array(24)].map((_, i) => String(i).padStart(2, '0'))
const MM = [...Array(12)].map((_, i) => String(i * 5).padStart(2, '0'))
const DATES = [...Array(31)].map((_, i) => String(i + 1))

// ---- create form ----
const blank = () => ({
  name: '', emails: [], newEmail: '', format: 'PDF', pwd: false, password: '', showPwd: false,
  timeFilter: '', technician: '', group: '', exportOption: 'attachment',
  type: 'Once', monthlyMode: 'date', startAt: '', hh: '00', mm: '00',
  weekDay: '', dateNum: '', month: '', occurrence: '',
})
const f = reactive(blank())
let editId = null
function openCreate() { Object.assign(f, blank()); editId = null; view.value = 'form' }
function openEdit(s) { Object.assign(f, blank(), { name: s.name, type: s.type, timeFilter: s.timeFilter }); editId = s.id; view.value = 'form' }
function addEmail() { const e = f.newEmail.trim(); if (e) { f.emails.push(e); f.newEmail = '' } }
function removeEmail(i) { f.emails.splice(i, 1) }

function createSchedule() {
  if (!f.name.trim()) { toast('Give the schedule a name.', 'warn'); return }
  if (editId) {
    const s = props.d.schedules.find((x) => x.id === editId)
    if (s) Object.assign(s, { name: f.name, type: f.type, timeFilter: f.timeFilter || '—' })
  } else {
    props.d.schedules.push({ id: uid('sch'), name: f.name, type: f.type, timeFilter: f.timeFilter || '—', enabled: true })
  }
  toast(`Schedule “${f.name}” saved`, 'success')
  view.value = 'list'
}
function delSchedule(s) { props.d.schedules = props.d.schedules.filter((x) => x.id !== s.id) }
</script>

<template>
  <div class="sc-overlay" @click.self="emit('close')">
    <div class="sc-panel">
    <!-- ===== LIST ===== -->
    <template v-if="view === 'list'">
      <div class="head"><h3>Schedule: {{ d.name }}</h3><button class="ic" @click="emit('close')"><Icon name="x" :size="18" /></button></div>
      <div class="lst-top">
        <div class="qbox"><Icon name="search" :size="15" class="muted" /><input v-model="search" placeholder="Search…" /></div>
        <button class="btn btn-primary" @click="openCreate"><Icon name="plus" :size="15" /> Create Schedule</button>
      </div>
      <div class="lst-body">
        <table class="stbl">
          <thead><tr><th>Name</th><th>Schedule Type</th><th>Time Filter</th><th>Enabled</th><th class="ta-r">Actions</th></tr></thead>
          <tbody>
            <tr v-for="s in list" :key="s.id">
              <td><b>{{ s.name }}</b></td><td>{{ s.type }}</td><td>{{ s.timeFilter }}</td>
              <td><button class="sw" :class="{ on: s.enabled }" @click="s.enabled = !s.enabled"><i /></button></td>
              <td class="ta-r"><button class="act" title="Edit" @click="openEdit(s)"><Icon name="edit" :size="15" /></button><button class="act del" title="Delete" @click="delSchedule(s)"><Icon name="trash" :size="15" /></button></td>
            </tr>
            <tr v-if="!list.length"><td colspan="5" class="none">No schedules yet — create one.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="foot"><span class="muted grow">Showing {{ list.length }} of {{ d.schedules.length }} items</span><button class="btn" @click="emit('close')">Close</button></div>
    </template>

    <!-- ===== CREATE / EDIT FORM ===== -->
    <template v-else>
      <div class="head"><div class="row gap-10"><button class="ic" title="Back to schedules" @click="view = 'list'"><Icon name="arrow-left" :size="18" /></button><h3>{{ editId ? 'Edit Schedule' : 'Create Schedule' }}</h3></div><button class="ic" @click="emit('close')"><Icon name="x" :size="18" /></button></div>
      <div class="body">
        <div class="grid2">
          <div class="fld"><label>Name <i>*</i></label><input class="input" v-model="f.name" placeholder="Name" /></div>
          <div class="fld"><label>Emails</label>
            <div class="emails">
              <span v-for="(e, i) in f.emails" :key="i" class="echip">{{ e }} <button @click="removeEmail(i)"><Icon name="x" :size="12" /></button></span>
              <input class="einput" v-model="f.newEmail" placeholder="add email…" @keyup.enter="addEmail" />
              <button class="eadd" @click="addEmail"><Icon name="plus" :size="15" /></button>
            </div>
          </div>

          <div class="fld"><label>Format <i>*</i></label>
            <div class="seg">
              <button v-for="x in ['PDF', 'CSV', 'Image']" :key="x" class="seg-b" :class="{ on: f.format === x }" @click="f.format = x">{{ x }}</button>
            </div>
          </div>
          <div class="fld"><label>Password Protected</label><button class="sw" :class="{ on: f.pwd }" @click="f.pwd = !f.pwd"><i /></button></div>
          <div v-if="f.pwd" class="fld span2"><label>Attachment Password <i>*</i></label>
            <div class="pwd-input"><Icon name="lock" :size="14" class="muted" /><input :type="f.showPwd ? 'text' : 'password'" v-model="f.password" placeholder="Attachment Password" /><button class="eye" @click="f.showPwd = !f.showPwd"><Icon name="eye" :size="15" /></button></div>
          </div>

          <div class="fld"><label>Time Filter <i>*</i></label><Dropdown v-model="f.timeFilter" :options="TIME_FILTERS" placeholder="Select" /></div>
          <div class="fld"><label>Technician</label><Dropdown v-model="f.technician" :options="store.owners" placeholder="Select" /></div>

          <div class="fld"><label>Technician Group</label><Dropdown v-model="f.group" :options="GROUPS" placeholder="Select" /></div>
          <div class="fld"><label>Export Option</label>
            <div class="radios">
              <label class="radio"><input type="radio" value="attachment" v-model="f.exportOption" /> Attachment</label>
              <label class="radio"><input type="radio" value="link" v-model="f.exportOption" /> Attachment Link</label>
            </div>
          </div>

          <div class="fld"><label>Schedule Type <i>*</i></label><Dropdown v-model="f.type" :options="SCHEDULE_TYPES" /></div>
          <div />
        </div>

        <!-- Monthly: specific date vs specific day -->
        <div v-if="f.type === 'Monthly'" class="fld">
          <label>When should this scheduler run? <i>*</i></label>
          <div class="seg">
            <button class="seg-b" :class="{ on: f.monthlyMode === 'date' }" @click="f.monthlyMode = 'date'">On Specific Date</button>
            <button class="seg-b" :class="{ on: f.monthlyMode === 'day' }" @click="f.monthlyMode = 'day'">On Specific Day</button>
          </div>
        </div>

        <!-- Start At + conditional time/day fields -->
        <div class="grid2">
          <div class="fld"><label>Start At <i>*</i></label><input class="input" type="datetime-local" v-model="f.startAt" /></div>

          <!-- Daily/Weekly/Monthly show a Time picker -->
          <div v-if="f.type !== 'Once'" class="fld"><label>Time</label>
            <div class="time-row"><Dropdown v-model="f.hh" :options="HH" /><span class="colon">:</span><Dropdown v-model="f.mm" :options="MM" /></div>
          </div>
          <div v-else />

          <!-- Weekly → Day -->
          <div v-if="f.type === 'Weekly'" class="fld"><label>Day <i>*</i></label><Dropdown v-model="f.weekDay" :options="WEEKDAYS" placeholder="Select" /></div>

          <!-- Monthly · On Specific Date → Date + Month -->
          <template v-if="f.type === 'Monthly' && f.monthlyMode === 'date'">
            <div class="fld"><label>Date <i>*</i></label><Dropdown v-model="f.dateNum" :options="DATES" placeholder="Select" /></div>
            <div class="fld"><label>Month <i>*</i></label><Dropdown v-model="f.month" :options="MONTHS" placeholder="Select" /></div>
          </template>

          <!-- Monthly · On Specific Day → Occurrence + Weekday + Month -->
          <template v-if="f.type === 'Monthly' && f.monthlyMode === 'day'">
            <div class="fld"><label>Occurrence <i>*</i></label><Dropdown v-model="f.occurrence" :options="OCCUR" placeholder="Select" /></div>
            <div class="fld"><label>Weekday <i>*</i></label><Dropdown v-model="f.weekDay" :options="WEEKDAYS" placeholder="Select" /></div>
            <div class="fld"><label>Month <i>*</i></label><Dropdown v-model="f.month" :options="MONTHS" placeholder="Select" /></div>
          </template>
        </div>
      </div>
      <div class="foot"><button class="btn btn-primary" @click="createSchedule"><Icon name="check" :size="16" /> {{ editId ? 'Save' : 'Create' }}</button><button class="btn" @click="view = 'list'">Cancel</button></div>
    </template>
    </div>
  </div>
</template>

<style scoped>
.sc-overlay { position: fixed; inset: 0; background: rgba(20,21,38,.42); backdrop-filter: blur(2px); z-index: 100; display: flex; justify-content: flex-end; }
.sc-panel { width: 720px; max-width: 96vw; height: 100%; background: var(--surface); box-shadow: var(--sh-lg); display: flex; flex-direction: column; overflow: hidden; animation: slideIn .22s cubic-bezier(.2,.8,.2,1); }
@keyframes slideIn { from { transform: translateX(30px); opacity: .4; } to { transform: translateX(0); opacity: 1; } }
.head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 14px; border-bottom: 1px solid var(--border); } .head h3 { margin: 0; font-size: 17px; }
.ic { width: 34px; height: 34px; border: none; background: transparent; color: var(--muted); border-radius: 9px; display: grid; place-items: center; } .ic:hover { background: var(--surface-2); color: var(--ink); }
/* list */
.lst-top { display: flex; align-items: center; gap: 12px; padding: 16px 22px 8px; }
.qbox { display: flex; align-items: center; gap: 8px; flex: 1; height: 38px; border: 1px solid var(--border-strong); border-radius: var(--r); padding: 0 11px; background: var(--surface-2); }
.qbox input { border: none; outline: none; background: transparent; width: 100%; font-size: 13.5px; }
.lst-body { flex: 1; overflow: auto; padding: 8px 22px; min-height: 220px; }
.stbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.stbl th { text-align: left; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .4px; font-weight: 600; padding: 10px 10px; border-bottom: 1px solid var(--border); }
.stbl td { padding: 12px 10px; border-bottom: 1px solid var(--border); }
.ta-r { text-align: right; }
.act { width: 30px; height: 30px; border: none; background: transparent; color: var(--muted); border-radius: 7px; }
.act:hover { background: var(--surface-2); color: var(--primary-700); } .act.del:hover { color: var(--red); background: var(--red-soft); }
.none { text-align: center; color: var(--muted-2); padding: 40px; }
/* form */
.body { flex: 1; padding: 16px 22px; overflow: auto; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; margin-bottom: 4px; }
.fld { display: flex; flex-direction: column; }
.fld.span2 { grid-column: 1 / -1; }
.fld label { font-size: 12px; font-weight: 500; color: var(--ink-2); margin-bottom: 6px; } .fld label i { color: var(--red); font-style: normal; }
.pwd-input { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-strong); border-radius: var(--r); padding: 0 10px; height: 38px; }
.pwd-input input { border: none; outline: none; background: transparent; flex: 1; font-size: 13.5px; }
.eye { border: none; background: transparent; color: var(--muted); display: grid; place-items: center; }
.seg { display: inline-flex; gap: 4px; background: var(--surface-2); padding: 3px; border-radius: 9px; border: 1px solid var(--border); align-self: flex-start; }
.seg-b { border: none; background: transparent; padding: 6px 14px; border-radius: 7px; font-weight: 500; font-size: 12.5px; color: var(--muted); }
.seg-b.on { background: var(--primary); color: #fff; box-shadow: var(--sh-sm); }
.emails { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border: 1px solid var(--border-strong); border-radius: var(--r); padding: 6px 8px; min-height: 38px; }
.echip { display: inline-flex; align-items: center; gap: 5px; background: var(--primary-soft); color: var(--primary-700); border-radius: 6px; padding: 2px 8px; font-size: 12px; } .echip button { border: none; background: transparent; color: var(--primary-700); display: grid; place-items: center; }
.einput { border: none; outline: none; background: transparent; flex: 1; min-width: 90px; font-size: 13px; }
.eadd { width: 26px; height: 26px; border: none; background: var(--primary); color: #fff; border-radius: 6px; display: grid; place-items: center; }
.radios { display: flex; gap: 18px; height: 38px; align-items: center; } .radio { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; color: var(--ink-2); }
.sw { width: 40px; height: 22px; border-radius: 999px; border: none; background: var(--border-strong); position: relative; align-self: flex-start; }
.sw i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: var(--sh-sm); }
.sw.on { background: var(--primary); } .sw.on i { left: 20px; }
.time-row { display: flex; align-items: center; gap: 8px; } .time-row .colon { color: var(--muted); font-weight: 600; }
.foot { display: flex; align-items: center; gap: 10px; padding: 14px 22px; border-top: 1px solid var(--border); background: var(--surface-2); }
.foot .grow { flex: 1; font-size: 12.5px; }
.foot:not(:has(.grow)) { justify-content: flex-start; }
</style>
