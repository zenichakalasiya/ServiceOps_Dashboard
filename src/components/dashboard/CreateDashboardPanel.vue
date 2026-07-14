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
const err = ref('')

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
const catOptions = computed(() => [{ value: '', label: '— None —' }, ...store.categories.map((c) => ({ value: c, label: c }))])
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
      updated: new Date().toISOString(),
    })
    if (defaultLanding.value) { store.dashboards.forEach((x) => (x.default = false)); src.default = true }
    close()
    return
  }
  // ---- create / clone ----
  const opts = {
    name: name.value, access: access.value, category: category.value, description: description.value,
    techAccess: ta, groupAccess: ga, makeDefault: defaultLanding.value, layout: { ...layout },
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
          <h3>{{ isEdit ? 'Edit dashboard' : isClone ? 'Clone Dashboard' : 'Create dashboard' }}</h3>
          <p class="muted">{{ isEdit ? 'Update this dashboard’s details and layout.' : isClone ? 'Duplicate this board with its widgets, then tweak it.' : "Classify it now so it's easy to find later." }}</p>
        </div>
        <button class="btn btn-icon" @click="close"><Icon name="x" :size="18" /></button>
      </div>

      <div class="body">
        <!-- predefined board: identity ships with the product, so Name / Description /
             Visibility are removed outright and this line says why -->
        <p v-if="lockedDash" class="pd-note">
          <Icon name="verified" :size="14" />
          <span>This is a <b>predefined dashboard</b> — you can’t edit its <b>Name</b>, <b>Description</b> or <b>Visibility &amp; Sharing</b>. You can still change its Category, layout, and the widgets on it.</span>
        </p>

        <template v-if="!lockedDash">
          <div class="grp">
            <label class="field">Dashboard Name <span class="req">*</span></label>
            <input class="input" :class="{ bad: nameTaken }" v-model="name" placeholder="e.g. Network SLA Overview" autofocus @input="err = ''" />
            <p v-if="nameTaken" class="dup-err">
              <Icon name="alert" :size="13" />
              <span>A dashboard named “{{ name.trim() }}” already exists. <b>Dashboard names must be unique</b> — pick another.</span>
            </p>
            <div v-else-if="err" class="err">{{ err }}</div>
          </div>

          <div class="grp">
            <label class="field">Description</label>
            <textarea class="input" rows="2" v-model="description" placeholder="What is this dashboard for, and who is it for?" />
          </div>
        </template>

        <!-- Category + Add New -->
        <div class="grp">
          <label class="field">Category</label>
          <div class="cat-row">
            <Dropdown v-model="category" :options="catOptions" placeholder="— None —" />
            <button class="btn cat-new" @click="catAdd = !catAdd"><Icon name="plus" :size="15" /> Add new category</button>
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
        <div v-if="!lockedDash" class="grp">
          <label class="field">Visibility &amp; Sharing</label>
          <div class="seg">
            <button v-for="(a, k) in ACCESS" :key="k" class="seg-btn" :class="{ on: access === k }" @click="access = k">
              <Icon :name="a.icon" :size="15" /> {{ a.label }}
            </button>
          </div>
          <p class="oneliner"><Icon name="info" :size="13" /> {{ ACC_DESC[access] }}</p>
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
          <button class="sw" :class="{ on: defaultLanding }" @click="defaultLanding = !defaultLanding"><i /></button>
        </div>

        <!-- Layout + live preview -->
        <div class="grp">
          <label class="field sec-title">Layout</label>
          <div class="lay-grid">
            <div class="lay-fld">
              <span class="lay-lbl">Header font size</span>
              <input type="range" min="0" max="2" step="1" v-model="fontIdx" class="rng" />
              <div class="rng-ticks"><span>S</span><span>M</span><span>L</span></div>
            </div>
            <div class="lay-fld">
              <span class="lay-lbl">Row height</span>
              <div class="rng-row"><input type="range" min="110" max="260" step="10" v-model.number="layout.rowHeight" class="rng" /><span class="rng-num">{{ layout.rowHeight }}</span></div>
            </div>
            <div class="lay-fld">
              <span class="lay-lbl">Horizontal gap</span>
              <div class="rng-row"><input type="range" min="4" max="32" step="2" v-model.number="layout.hGap" class="rng" /><span class="rng-num">{{ layout.hGap }}</span></div>
            </div>
            <div class="lay-fld">
              <span class="lay-lbl">Vertical gap</span>
              <div class="rng-row"><input type="range" min="4" max="32" step="2" v-model.number="layout.vGap" class="rng" /><span class="rng-num">{{ layout.vGap }}</span></div>
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
        <button class="btn" @click="close">Cancel</button>
        <button class="btn btn-primary" :disabled="!canSave" :title="nameTaken ? 'That name is already taken — dashboard names must be unique' : ''" @click="submit(false)">
          <Icon :name="isEdit ? 'check' : isClone ? 'copy' : 'plus'" :size="16" /> {{ isEdit ? 'Save changes' : isClone ? 'Clone Dashboard' : 'Create' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawer-overlay { position: fixed; inset: 0; background: rgba(20,21,38,.42); backdrop-filter: blur(2px); z-index: 100; display: flex; justify-content: flex-end; }
.drawer { width: 480px; max-width: 94vw; height: 100%; background: var(--surface); box-shadow: var(--sh-lg); display: flex; flex-direction: column; overflow: hidden; animation: slideIn .22s cubic-bezier(.2,.8,.2,1); }
@keyframes slideIn { from { transform: translateX(30px); opacity: .4; } to { transform: translateX(0); opacity: 1; } }
.head { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 22px 12px; }
.head h3 { margin: 0; font-size: 17px; }
.head p { margin: 3px 0 0; font-size: 12.5px; }
.body { flex: 1; padding: 6px 22px 20px; display: flex; flex-direction: column; gap: 16px; overflow: auto; }
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
.seg { display: inline-flex; gap: 6px; }
.seg-btn { display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); font-weight: 500; font-size: 13px; flex: 1; justify-content: center; }
.seg-btn.on { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-700); }
/* predefined-dashboard note — same treatment as the predefined-widget line in the builder */
.pd-note { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--primary-700); background: var(--primary-softer); border: 1px solid var(--primary-soft); border-radius: 9px; padding: 10px 12px; }
.pd-note :deep(.ico) { flex: none; margin-top: 1px; }
.oneliner { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; font-size: 12px; color: var(--muted); }
.oneliner.plain { margin: 2px 0 0; }
/* category + add new */
.cat-row { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: start; }
.cat-new { height: 38px; white-space: nowrap; color: var(--primary-700); border-color: var(--border-strong); }
.cat-new:hover { background: var(--primary-softer); border-color: transparent; }
.cat-pop { position: absolute; top: 46px; right: 0; z-index: 30; width: 280px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.cat-pop-btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
/* default landing toggle */
.toggle-grp { flex-direction: row; align-items: center; justify-content: space-between; gap: 14px; }
.tg-text { display: flex; flex-direction: column; }
.sw { width: 40px; height: 22px; border-radius: 999px; border: none; background: var(--border-strong); position: relative; transition: background .15s; flex: none; }
.sw i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: var(--sh-sm); }
.sw.on { background: var(--primary); } .sw.on i { left: 20px; }
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
.foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid var(--border); background: var(--surface-2); }
</style>
