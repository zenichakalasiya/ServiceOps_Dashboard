<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import Dropdown from '../ui/Dropdown.vue'
import { store, createDashboard, addCategory } from '../../store/index.js'
import { ACCESS, uid } from '../../data/mock.js'
const router = useRouter()

// Clone / Edit when a source dashboard is set; otherwise Create.
const src = store.ui.cloneTarget || store.ui.editTarget
const isClone = computed(() => !!store.ui.cloneTarget)
const isEdit = computed(() => !!store.ui.editTarget)
/* Editing a PREDEFINED dashboard: its identity (name, description, visibility)
 * ships with the product and can't be changed. Cloning one is unrestricted —
 * the copy is yours — so this is scoped to edit, not clone. */
const lockedDash = computed(() => isEdit.value && !!store.ui.editTarget?.predefined)

// Clone naming: "{base} - copy N" — strip any existing "- copy N" suffix to find the
// base, then pick the lowest N not already used (so a 2nd copy becomes "- copy 2").
function cloneName(srcName) {
  const base = srcName.replace(/\s*-\s*copy\s*\d+$/i, '').trim()
  const taken = new Set(store.dashboards.map((d) => d.name.toLowerCase()))
  let n = 1
  while (taken.has(`${base} - copy ${n}`.toLowerCase())) n++
  return `${base} - copy ${n}`
}
const name = ref(store.ui.cloneTarget ? cloneName(src.name) : src ? src.name : '')
const access = ref(src?.access || 'public')
const category = ref(src?.category || '')
const description = ref(src?.description || '')
const techAccess = ref(src?.techAccess?.length ? [...src.techAccess] : [store.currentUser])
const groupAccess = ref((src?.groupAccess && src.groupAccess[0]) || '')
const defaultLanding = ref(src?.default || false)
const layoutLock = ref(src?.layoutLock === true)
const err = ref('')

/* "Default landing" is two different acts wearing one switch. Setting a board as YOUR
 * landing page is a personal preference; setting it as someone else's is an admin action
 * that changes what a colleague sees when they sign in. The switch alone could not tell
 * them apart, so turning it on now asks which one you mean — and defaults to the harmless
 * one. Nobody re-points a teammate's home screen by accident. */
const defaultScope = ref(src?.defaultScope || 'me')          // 'me' | 'users'
const defaultUsers = ref(src?.defaultUsers ? [...src.defaultUsers] : [])
const userQuery = ref('')
const PROFILES = ['PMG', 'PMG UX', 'Service Desk L1', 'NOC Viewers']
// people are @-mentioned, profiles are #-tagged — the same grammar the search box teaches
const userPool = computed(() => [...store.owners.map((o) => ({ id: o, label: o, kind: 'user' })), ...PROFILES.map((p) => ({ id: p, label: p, kind: 'profile' }))])
const userMatches = computed(() => {
  const q = userQuery.value.replace(/^[@#]/, '').trim().toLowerCase()
  const picked = new Set(defaultUsers.value)
  const pool = userPool.value.filter((u) => !picked.has(u.id))
  if (userQuery.value.startsWith('#')) return pool.filter((u) => u.kind === 'profile' && u.label.toLowerCase().includes(q))
  if (userQuery.value.startsWith('@')) return pool.filter((u) => u.kind === 'user' && u.label.toLowerCase().includes(q))
  return q ? pool.filter((u) => u.label.toLowerCase().includes(q)) : pool
})
function addUser(u) { if (!defaultUsers.value.includes(u.id)) defaultUsers.value.push(u.id); userQuery.value = '' }
function dropUser(id) { defaultUsers.value = defaultUsers.value.filter((x) => x !== id) }

/* Dashboard names must be unique. The board being edited is excluded by id, so it
 * can't collide with itself; archived boards still count, because restoring one
 * would then produce two dashboards with the same name. */
const nameTaken = computed(() => {
  const n = name.value.trim().toLowerCase()
  if (!n || lockedDash.value) return false
  const selfId = store.ui.editTarget?.id
  return store.dashboards.some((d) => d.id !== selfId && d.name.trim().toLowerCase() === n)
})
const canSave = computed(() => lockedDash.value || (!!name.value.trim() && !nameTaken.value))

// per-dashboard layout
const FONTS = ['S', 'M', 'L']
const FONT_PX = { S: 12, M: 13.5, L: 15 }
const layout = reactive({
  headerFont: src?.headerFont || 'M',
  hGap: src?.hGap ?? 14, vGap: src?.vGap ?? 14, rowHeight: src?.rowHeight ?? 140,
})
const fontIdx = computed({ get: () => FONTS.indexOf(layout.headerFont), set: (v) => (layout.headerFont = FONTS[+v]) })

const ACC_DESC = {
  public: 'Everyone with portal access can open this dashboard.',
  private: 'Only you can open and manage this dashboard.',
  restricted: 'Only the technicians / groups you pick below can open it.',
}
// the empty option reads as the prompt ("Select Category"), not as a category called None
const catOptions = computed(() => [{ value: '', label: 'Select Category' }, ...store.categories.map((c) => ({ value: c, label: c }))])
const groupOptions = ['Service Desk', 'Network Team', 'NOC Viewers']

// Category → Add New popover
const catAdd = ref(false)
const newCat = ref('')
function saveCat() {
  const n = addCategory(newCat.value)
  if (n) category.value = n
  newCat.value = ''; catAdd.value = false
}

const PREVIEW = ['Top Server Monitors', 'Monitor Availability', 'CPU Utilisation', 'Logs by Severity']

function close() { store.ui.createOpen = false; store.ui.cloneTarget = null; store.ui.editTarget = null }
function submit(openAdd = false) {
  if (!lockedDash.value && !name.value.trim()) { err.value = 'Give your dashboard a name.'; return }
  if (nameTaken.value) return   // the field already says why; never save a duplicate
  const ta = access.value === 'restricted' ? techAccess.value : undefined
  const ga = access.value === 'restricted' && groupAccess.value ? [groupAccess.value] : undefined
  // ---- edit in place ----
  if (isEdit.value) {
    Object.assign(src, {
      // a predefined board keeps its identity — writing these back would blank the
      // very fields we just removed from the form
      ...(lockedDash.value ? {} : {
        name: name.value.trim(), access: access.value, description: description.value,
        ...(ta ? { techAccess: ta } : {}), ...(ga ? { groupAccess: ga } : {}),
      }),
      category: category.value,
      headerFont: layout.headerFont, hGap: layout.hGap, vGap: layout.vGap, rowHeight: layout.rowHeight,
      layoutLock: layoutLock.value,
      updated: new Date().toISOString(),
    })
    /* Only "Only for me" moves the single global default. "For specific users" targets
     * other people's home screens, which this mock has no per-user state for — so it is
     * recorded on the board and left out of the global flag rather than silently
     * repointing YOUR landing page to a board you set for someone else. */
    if (defaultLanding.value) {
      src.defaultScope = defaultScope.value
      src.defaultUsers = defaultScope.value === 'users' ? [...defaultUsers.value] : undefined
      if (defaultScope.value === 'me') { store.dashboards.forEach((x) => (x.default = false)); src.default = true }
    } else { src.default = false; src.defaultScope = undefined; src.defaultUsers = undefined }
    close()
    return
  }
  // ---- create / clone ----
  const opts = {
    name: name.value, access: access.value, category: category.value, description: description.value,
    techAccess: ta, groupAccess: ga,
    makeDefault: defaultLanding.value && defaultScope.value === 'me',
    defaultScope: defaultLanding.value ? defaultScope.value : undefined,
    defaultUsers: defaultLanding.value && defaultScope.value === 'users' ? [...defaultUsers.value] : undefined,
    layout: { ...layout }, layoutLock: layoutLock.value,
  }
  if (isClone.value) opts.tiles = src.tiles.map((t) => ({ ...JSON.parse(JSON.stringify(t)), id: uid('t') }))
  const d = createDashboard(opts)
  // a brand-new (non-clone) board lands empty → auto-open the Add-Widget drawer
  if (!isClone.value) store.ui.pendingAddWidget = true
  close()
  router.push(`/dashboard/${d.id}`)
}
</script>

<template>
  <div class="drawer-overlay" @click.self="close">
    <div class="drawer">
      <div class="head">
        <div>
          <h3>{{ isEdit ? 'Edit Dashboard' : isClone ? 'Clone Dashboard' : 'Create Dashboard' }}</h3>
          <p v-if="isEdit || isClone" class="muted">{{ isEdit ? 'Update this dashboard’s details and layout.' : 'Duplicate this board with its widgets, then tweak it.' }}</p>
        </div>
        <button class="x-btn" @click="close"><Icon name="x" :size="16" /></button>
      </div>

      <div class="body">
        <!-- predefined board: identity ships with the product, so Name / Description /
             Visibility are removed outright and this line says why -->
        <p v-if="lockedDash" class="pd-note">
          <Icon name="verified" :size="14" />
          <span>This is a <b>predefined dashboard</b> — you can’t edit its <b>Name</b>, <b>Description</b> or <b>Visibility &amp; Sharing</b>. You can still change its Category, layout, and the widgets on it.</span>
        </p>

        <div class="sec-h">Basics</div>

        <template v-if="!lockedDash">
          <div class="grp">
            <label class="field">Name <span class="req">*</span></label>
            <input class="input" :class="{ bad: nameTaken }" v-model="name" placeholder="Name" autofocus @input="err = ''" />
            <p v-if="nameTaken" class="dup-err">
              <Icon name="alert" :size="13" />
              <span>A dashboard named “{{ name.trim() }}” already exists. <b>Dashboard names must be unique</b> — pick another.</span>
            </p>
            <div v-else-if="err" class="err">{{ err }}</div>
          </div>

          <div class="grp">
            <label class="field">Description <span class="req">*</span></label>
            <textarea class="input" rows="3" v-model="description" placeholder="Description" />
          </div>
        </template>

        <!-- Category + Add New -->
        <div class="grp">
          <label class="field">Category</label>
          <div class="cat-row">
            <Dropdown v-model="category" :options="catOptions" placeholder="Select Category" />
            <button class="btn cat-new" @click="catAdd = !catAdd">New Category <Icon name="plus" :size="15" /></button>
            <transition name="pop">
              <div v-if="catAdd" class="cat-pop card" @click.stop>
                <label class="field">Category Name <span class="req">*</span></label>
                <input class="input" v-model="newCat" placeholder="e.g. Security" @keyup.enter="saveCat" autofocus />
                <div class="cat-pop-btns">
                  <button class="btn btn-sm" @click="catAdd = false; newCat = ''">Cancel</button>
                  <button class="btn btn-sm btn-primary" :disabled="!newCat.trim()" @click="saveCat">Save</button>
                </div>
              </div>
            </transition>
          </div>
        </div>

        <!-- Access + one-liner -->
        <div v-if="!lockedDash" class="sec-h">Visibility &amp; sharing</div>
        <div v-if="!lockedDash" class="grp">
          <label class="field">Dashboard Access Level <span class="req">*</span></label>
          <div class="seg">
            <button v-for="(a, k) in ACCESS" :key="k" class="seg-btn" :class="{ on: access === k }" @click="access = k">{{ a.label }}</button>
          </div>
          <p class="oneliner"><Icon name="info" :size="14" /> {{ ACC_DESC[access] }}</p>
        </div>

        <!-- Restricted targeting — belongs to Visibility, so it goes when Visibility does -->
        <div v-if="!lockedDash && access === 'restricted'" class="two">
          <div class="grp">
            <label class="field">Technician Access Level <span class="req">*</span></label>
            <Dropdown v-model="techAccess" :options="store.owners" :multiple="true" placeholder="Select technicians" />
          </div>
          <div class="grp">
            <label class="field">Technician Group Access Level <span class="req">*</span></label>
            <Dropdown v-model="groupAccess" :options="groupOptions" placeholder="Select" />
          </div>
        </div>

        <!-- Default landing -->
        <div class="grp toggle-grp">
          <div class="tg-text">
            <label class="field" style="margin:0">Default landing dashboard</label>
            <span class="oneliner plain">When set as default, this dashboard opens first on sign-in.</span>
          </div>
          <button class="sw" :class="{ on: defaultLanding }" @click="defaultLanding = !defaultLanding"><i /><b>{{ defaultLanding ? 'ON' : 'OFF' }}</b></button>
        </div>

        <!-- Whose default? Setting your own landing page and re-pointing a colleague's
             are different acts; the switch could not tell them apart, so it asks — and
             lands on the harmless one. -->
        <div v-if="defaultLanding" class="dl-scope">
          <label class="rad" :class="{ on: defaultScope === 'me' }">
            <input type="radio" value="me" v-model="defaultScope" />
            <span class="rad-txt"><b>Only for me</b><em>Opens first when you sign in. Teammates’ defaults are unchanged.</em></span>
          </label>
          <label class="rad" :class="{ on: defaultScope === 'users' }">
            <input type="radio" value="users" v-model="defaultScope" />
            <span class="rad-txt"><b>For specific users</b><em>Pick exactly who gets this as their default. Everyone else keeps theirs.</em></span>
          </label>

          <div v-if="defaultScope === 'users'" class="grp dl-users">
            <label class="field">Choose users</label>
            <div class="us-box" :class="{ open: !!userQuery }">
              <div class="us-in"><Icon name="search" :size="14" class="muted" /><input v-model="userQuery" placeholder="@User or #User Profile" /></div>
              <!-- @ narrows to people, # to profiles — the placeholder teaches the grammar
                   and the list obeys it, so the hint is not decoration -->
              <div v-if="userQuery" class="us-list">
                <button v-for="u in userMatches" :key="u.id" class="us-opt" @click="addUser(u)">
                  <span class="us-sig">{{ u.kind === 'profile' ? '#' : '@' }}</span>{{ u.label }}
                </button>
                <div v-if="!userMatches.length" class="us-none">No match</div>
              </div>
            </div>
            <div v-if="defaultUsers.length" class="us-chips">
              <span v-for="u in defaultUsers" :key="u" class="us-chip">{{ u }}<button @click="dropUser(u)"><Icon name="x" :size="12" /></button></span>
            </div>
          </div>
        </div>

        <!-- Layout Lock — freezes position AND size for everyone viewing the board -->
        <div class="grp toggle-grp">
          <div class="tg-text">
            <label class="field" style="margin:0">Layout Lock</label>
            <span class="oneliner plain">A per-dashboard lock that freezes every widget’s position and size, so viewing, presenting, or screen-sharing a board can never accidentally rearrange it.</span>
          </div>
          <button class="sw" :class="{ on: layoutLock }" @click="layoutLock = !layoutLock"><i /><b>{{ layoutLock ? 'ON' : 'OFF' }}</b></button>
        </div>

        <!-- Layout + live preview. Slider order follows the design: the two gaps sit
             together, with the row height last. -->
        <div class="grp">
          <label class="field sec-title">Layout</label>
          <div class="lay-grid">
            <div class="lay-fld">
              <span class="lay-lbl">Header font size</span>
              <input type="range" min="0" max="2" step="1" v-model="fontIdx" class="rng" />
              <div class="rng-ticks"><span>S</span><span>M</span><span>L</span></div>
            </div>
            <div class="lay-fld">
              <span class="lay-lbl">Horizontal gap</span>
              <div class="rng-row"><input type="range" min="4" max="32" step="2" v-model.number="layout.hGap" class="rng" /><span class="rng-num">{{ layout.hGap }}</span></div>
            </div>
            <div class="lay-fld">
              <span class="lay-lbl">Vertical gap</span>
              <div class="rng-row"><input type="range" min="4" max="32" step="2" v-model.number="layout.vGap" class="rng" /><span class="rng-num">{{ layout.vGap }}</span></div>
            </div>
            <div class="lay-fld">
              <span class="lay-lbl">Row height</span>
              <div class="rng-row"><input type="range" min="110" max="260" step="10" v-model.number="layout.rowHeight" class="rng" /><span class="rng-num">{{ layout.rowHeight }}</span></div>
            </div>
          </div>

          <span class="lay-lbl" style="margin-top:14px; display:block">Live Preview</span>
          <div class="lp" :style="{ columnGap: layout.hGap + 'px', rowGap: layout.vGap + 'px' }">
            <div v-for="t in PREVIEW" :key="t" class="lp-tile" :style="{ minHeight: Math.round(layout.rowHeight * 0.5) + 'px' }">
              <span class="lp-title" :style="{ fontSize: FONT_PX[layout.headerFont] + 'px' }">{{ t }}</span>
              <div class="lp-body" />
            </div>
          </div>
        </div>
      </div>

      <div class="foot">
        <button class="btn btn-primary" :disabled="!canSave" :title="nameTaken ? 'That name is already taken — dashboard names must be unique' : ''" @click="submit(false)">
          <Icon :name="isEdit ? 'check' : isClone ? 'copy' : 'plus'" :size="16" /> {{ isEdit ? 'Save changes' : isClone ? 'Clone Dashboard' : 'Create' }}
        </button>
        <button class="btn" @click="close">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A right-edge drawer, matching Add New Widget and every other side panel in the module.
   This was briefly a centered modal and it made Create Dashboard the only overlay in the
   product that arrived from somewhere else — a panel whose position tells you which panel
   it is, is a panel you have to re-learn. The redesigned contents are unchanged; only the
   placement went back. */
.drawer-overlay { position: fixed; inset: 0; background: rgba(20,21,38,.42); backdrop-filter: blur(2px); z-index: 100; display: flex; justify-content: flex-end; }
.drawer { width: 620px; max-width: 96vw; height: 100%; background: var(--surface); box-shadow: var(--sh-lg); display: flex; flex-direction: column; overflow: hidden; animation: slideIn .22s cubic-bezier(.2,.8,.2,1); }
@keyframes slideIn { from { transform: translateX(30px); opacity: .4; } to { transform: none; opacity: 1; } }
.head { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 22px 12px; }
.head h3 { margin: 0; font-size: 18px; }
.head p { margin: 3px 0 0; font-size: 12.5px; }
/* close sits in its own soft square, as the design has it */
.x-btn { width: 30px; height: 30px; flex: none; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink-2); border-radius: 8px; display: grid; place-items: center; }
.x-btn:hover { background: var(--border); color: var(--ink); }
.body { flex: 1; padding: 6px 22px 20px; display: flex; flex-direction: column; gap: 16px; overflow: auto; }
/* section headings — Basics / Visibility & sharing / Layout, as the design groups them.
   The first one loses its top margin so it doesn't push away from the drawer header. */
.sec-h { font-size: 14.5px; font-weight: 700; color: var(--ink); margin: 22px 0 -2px; }
.sec-h:first-of-type { margin-top: 2px; }
.grp { display: flex; flex-direction: column; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.req { color: var(--red); }
.err { color: var(--red); font-size: 12px; margin-top: 5px; }
/* Duplicate name reads as a WARNING, not an error — amber, not red. */
.dup-err { display: flex; align-items: flex-start; gap: 7px; margin: 6px 0 0; padding: 8px 10px; font-size: 12px; line-height: 1.45; color: var(--amber); background: var(--amber-soft); border-radius: 7px; }
.dup-err :deep(.ico) { flex: none; margin-top: 1px; }
.dup-err b { font-weight: 600; color: var(--amber); }
.input.bad { border-color: var(--amber); }
.sec-title { font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 10px; }
/* one segmented control on a soft track, active segment filled solid — the same control
   the Manage tabs use, so "which of these three is in force" reads identically everywhere */
.seg { display: inline-flex; gap: 2px; padding: 4px; background: var(--surface-2); border-radius: 10px; align-self: flex-start; }
.seg-btn { display: flex; align-items: center; justify-content: center; height: 32px; padding: 0 22px; border-radius: 7px; border: none; background: transparent; color: var(--ink-2); font-weight: 500; font-size: 13px; }
.seg-btn:hover { color: var(--ink); }
.seg-btn.on { background: var(--ink); color: #fff; font-weight: 600; box-shadow: var(--sh-sm); }
/* the access one-liner sits in its own soft box, not as loose grey text under the control */
.oneliner { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; padding: 9px 11px; background: var(--surface-2); border-radius: 8px; font-size: 12.5px; color: var(--ink-2); }
.oneliner :deep(.ico) { color: var(--muted); flex: none; }
/* predefined-dashboard note — same treatment as the predefined-widget line in the builder */
.pd-note { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--primary-700); background: var(--primary-softer); border: 1px solid var(--primary-soft); border-radius: 9px; padding: 10px 12px; }
.pd-note :deep(.ico) { flex: none; margin-top: 1px; }
/* `.plain` is the toggle's own description — loose grey text, no box, since it explains a
   switch rather than reporting the consequence of a choice */
.oneliner.plain { display: block; margin: 3px 0 0; padding: 0; background: none; border-radius: 0; font-size: 12px; line-height: 1.5; color: var(--muted); }
/* category + add new */
.cat-row { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: start; }
.cat-new { height: 38px; white-space: nowrap; color: var(--primary-700); border-color: var(--border-strong); }
.cat-new:hover { background: var(--primary-softer); border-color: transparent; }
.cat-pop { position: absolute; top: 46px; right: 0; z-index: 30; width: 280px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.cat-pop-btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
/* default landing toggle */
.toggle-grp { flex-direction: row; align-items: center; justify-content: space-between; gap: 14px; }
/* the toggle rows are section-level settings, so their titles read at section weight
   rather than field-label size */
.toggle-grp .field { font-size: 14px; font-weight: 600; color: var(--ink); }
.tg-text { display: flex; flex-direction: column; }
/* an ON/OFF pill, not a bare switch: at a glance a plain track tells you there are two
   states but not which one you are looking at, and these two toggles both change what
   other people see. The word removes the guess. */
.sw { width: 58px; height: 24px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface-2); position: relative; transition: background .15s, border-color .15s; flex: none; }
.sw i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--muted-2); transition: left .15s, background .15s; box-shadow: var(--sh-sm); }
.sw b { position: absolute; top: 0; right: 8px; line-height: 22px; font-size: 9.5px; font-weight: 700; letter-spacing: .4px; color: var(--muted); transition: color .15s; }
.sw.on { background: var(--green-soft); border-color: color-mix(in srgb, var(--green) 40%, transparent); }
.sw.on i { left: 38px; background: var(--green); }
.sw.on b { right: auto; left: 9px; color: var(--green); }
/* layout controls */
.lay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
.lay-fld { display: flex; flex-direction: column; gap: 6px; }
.lay-lbl { font-size: 12px; font-weight: 500; color: var(--ink-2); }
.rng { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; border-radius: 999px; background: var(--surface-2); outline: none; }
.rng::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--primary); cursor: pointer; box-shadow: var(--sh-sm); }
.rng-row { display: flex; align-items: center; gap: 10px; }
.rng-num { min-width: 30px; text-align: center; font-size: 12px; font-weight: 600; color: var(--ink-2); background: var(--surface-2); border-radius: 6px; padding: 2px 6px; }
.rng-ticks { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); padding: 0 2px; }
/* live preview */
.lp { display: grid; grid-template-columns: 1fr 1fr; margin-top: 8px; padding: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-lg); }
.lp-tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.lp-title { font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-body { flex: 1; border-radius: 6px; background: repeating-linear-gradient(135deg, var(--surface-2) 0 8px, transparent 8px 16px); }
/* ---- Default landing scope: who does this become the home screen for? ---- */
.dl-scope { display: flex; flex-direction: column; gap: 8px; margin-top: -6px; }
.rad { display: flex; align-items: flex-start; gap: 10px; padding: 11px 13px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); cursor: pointer; }
.rad:hover { border-color: var(--border-strong); }
.rad.on { border-color: var(--primary); background: var(--primary-softer); }
.rad input { margin: 2px 0 0; accent-color: var(--primary); flex: none; }
.rad-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rad-txt b { font-size: 13px; font-weight: 600; color: var(--ink); }
.rad-txt em { font-style: normal; font-size: 12px; line-height: 1.5; color: var(--muted); }
.dl-users { margin-top: 4px; }
.us-box { position: relative; }
.us-in { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 11px; border: 1px solid var(--border-strong); border-radius: 9px; background: var(--surface); }
.us-in:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.us-in input { border: none; outline: none; background: transparent; width: 100%; font-size: 13px; }
.us-list { position: absolute; top: 42px; left: 0; right: 0; z-index: 20; max-height: 190px; overflow: auto; padding: 5px; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; box-shadow: var(--sh-pop); }
.us-opt { display: flex; align-items: center; gap: 7px; width: 100%; padding: 7px 9px; border: none; background: transparent; border-radius: 7px; font-size: 13px; color: var(--ink-2); text-align: left; }
.us-opt:hover { background: var(--surface-2); color: var(--ink); }
.us-sig { color: var(--muted-2); font-weight: 700; }
.us-none { padding: 10px; font-size: 12px; color: var(--muted-2); }
.us-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.us-chip { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 4px 0 10px; border-radius: 7px; background: var(--surface-2); border: 1px solid var(--border); font-size: 12.5px; color: var(--ink); }
.us-chip button { width: 18px; height: 18px; border: none; background: transparent; color: var(--muted); border-radius: 5px; display: grid; place-items: center; }
.us-chip button:hover { background: var(--border); color: var(--ink); }

.foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid var(--border); background: var(--surface); }
/* the primary is the design's near-black, not the product blue — inside a modal whose
   only other blue is the access segment, a blue CTA competed with it */
.foot .btn-primary { background: var(--ink); border-color: var(--ink); }
.foot .btn-primary:hover:not(:disabled) { background: #26313f; border-color: #26313f; }
</style>
