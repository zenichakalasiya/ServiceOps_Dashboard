<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import { store, createDashboard } from '../../store/index.js'
import { CATEGORIES, ACCESS } from '../../data/mock.js'
const router = useRouter()

const name = ref('')
const access = ref('public')
const category = ref('')
const description = ref('')
const techAccess = ref(store.currentUser)
const groupAccess = ref('')
const err = ref('')

function close() { store.ui.createOpen = false }
function submit() {
  if (!name.value.trim()) { err.value = 'Give your dashboard a name.'; return }
  const d = createDashboard({
    name: name.value, access: access.value, category: category.value, description: description.value,
    techAccess: access.value === 'restricted' ? [techAccess.value].filter(Boolean) : undefined,
    groupAccess: access.value === 'restricted' && groupAccess.value ? [groupAccess.value] : undefined,
  })
  close()
  router.push(`/dashboard/${d.id}`)
}
</script>

<template>
  <div class="drawer-overlay" @click.self="close">
    <div class="drawer">
      <div class="head">
        <div>
          <h3>Create dashboard</h3>
          <p class="muted">Classify it now so it's easy to find later.</p>
        </div>
        <button class="btn btn-icon" @click="close"><Icon name="x" :size="18" /></button>
      </div>
      <div class="body">
        <div class="grp">
          <label class="field">Name <span class="req">*</span></label>
          <input class="input" v-model="name" placeholder="e.g. Network SLA Overview" autofocus @input="err = ''" />
          <div v-if="err" class="err">{{ err }}</div>
        </div>

        <div class="grp">
          <label class="field">Description</label>
          <textarea class="input" rows="3" v-model="description" placeholder="What is this dashboard for, and who is it for?" />
        </div>

        <div class="grp">
          <label class="field">Access level</label>
          <div class="seg">
            <button v-for="(a, k) in ACCESS" :key="k" class="seg-btn" :class="{ on: access === k }" @click="access = k">
              <Icon :name="a.icon" :size="15" /> {{ a.label }}
            </button>
          </div>
        </div>

        <!-- Technician / group access — only for Restricted dashboards -->
        <div v-if="access === 'restricted'" class="two">
          <div class="grp">
            <label class="field">Technician Access Level <span class="req">*</span></label>
            <input class="input" v-model="techAccess" placeholder="Select technicians" />
          </div>
          <div class="grp">
            <label class="field">Technician Group Access Level <span class="req">*</span></label>
            <div class="select">
              <select v-model="groupAccess" class="input">
                <option value="">Select</option>
                <option>Service Desk</option>
                <option>Network Team</option>
                <option>NOC Viewers</option>
              </select>
              <Icon name="chevron-down" :size="15" class="chev" />
            </div>
          </div>
        </div>

        <div class="grp">
          <label class="field">Category</label>
          <div class="select">
            <select v-model="category" class="input">
              <option value="">— None —</option>
              <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
            </select>
            <Icon name="chevron-down" :size="15" class="chev" />
          </div>
        </div>
      </div>
      <div class="foot">
        <button class="btn" @click="close">Cancel</button>
        <button class="btn btn-primary" @click="submit"><Icon name="plus" :size="16" /> Create &amp; add widgets</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawer-overlay { position: fixed; inset: 0; background: rgba(20,21,38,.42); backdrop-filter: blur(2px); z-index: 100; display: flex; justify-content: flex-end; }
.drawer { width: 460px; max-width: 92vw; height: 100%; background: var(--surface); box-shadow: var(--sh-lg); display: flex; flex-direction: column; overflow: hidden; animation: slideIn .22s cubic-bezier(.2,.8,.2,1); }
@keyframes slideIn { from { transform: translateX(30px); opacity: .4; } to { transform: translateX(0); opacity: 1; } }
.drawer .body { flex: 1; }
.head { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 22px 12px; }
.head h3 { margin: 0; font-size: 17px; }
.head p { margin: 3px 0 0; font-size: 12.5px; }
.body { padding: 6px 22px 14px; display: flex; flex-direction: column; gap: 16px; overflow: auto; }
.grp { display: flex; flex-direction: column; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.req { color: var(--red); }
.err { color: var(--red); font-size: 12px; margin-top: 5px; }
.seg { display: inline-flex; gap: 6px; }
.seg-btn { display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink-2); font-weight: 500; font-size: 13px; flex: 1; justify-content: center; }
.seg-btn.on { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-700); }
.select { position: relative; }
.select select { appearance: none; padding-right: 30px; }
.chev { position: absolute; right: 11px; top: 11px; color: var(--muted); pointer-events: none; }
.foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid var(--border); background: var(--surface-2); }
</style>
