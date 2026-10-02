<script setup>
// ⚙ Konfigurator → Gruppen (docs/pflegestruktur.md 40): Konfiguratorgruppen und die Zeilen, mit denen Teile zu ihnen gehören. Gruppen und Zeilen gelten für alle
// Konfiguratoren und stehen als Plugin-Daten im Journal (group:<key>, member:<knoten>); sie werden hier einzeln gespeichert. Die Grenzen am Ende gehören zu diesem
// Konfigurator und werden mit ihm gespeichert (die Definition ist die des Besitzers).
import { ref, computed, onMounted } from 'vue'
import { api, store, dialog, tree, TreePicker, t } from 'journali'
import { KEY_PATTERN, cleanRows, cleanLimit, newRow, valuesText } from './model.js'
import { describeRow } from './describe.js'
import MemberEditor from './MemberEditor.vue'

const props = defineProps({ def: { type: Object, required: true }, attributes: { type: Array, default: () => [] } })

const groups = ref([])             // [{ key, label, equal, defined, members }]
const parts = ref([])              // [{ node, rows }] — die Teile mit Zeilen
const errors = ref([])             // was der Server an Gruppen und Zeilen bemängelt
const busy = ref('')
const sel = ref('')                // die gewählte Gruppe: filtert die Teile und ist die Gruppe, die hier bearbeitet wird
const groupEdit = ref(null)        // { label, equal }
const groupBase = ref('')
const edit = ref(null)             // das offene Teil: { node, rows }
const editBase = ref('')
const picking = ref(false)
const picked = ref('')
const newKey = ref('')

const keyOk = computed(() => KEY_PATTERN.test(newKey.value) && !groups.value.some(g => g.key === newKey.value))
const cleanGroup = g => { const o = {}; if (String(g?.label ?? '').trim()) o.label = String(g.label).trim(); if (g?.equal) o.equal = true; return o }
const groupDirty = computed(() => !!groupEdit.value && JSON.stringify(cleanGroup(groupEdit.value)) !== groupBase.value)
const editDirty = computed(() => !!edit.value && JSON.stringify(cleanRows(edit.value.rows)) !== editBase.value)
const shown = computed(() => parts.value.filter(p => !sel.value || p.rows.some(r => r.group === sel.value)))
const limits = computed(() => props.def.limits ?? [])

const ctx = computed(() => ({
  t, nodeName: id => tree.byId?.get(id)?.label ?? id,
  attributeName: k => props.attributes.find(a => a.key === k)?.label ?? k,
  groupName: k => groups.value.find(g => g.key === k)?.label || k,
}))
const nameOf = id => tree.byId?.get(id)?.label ?? id
const summary = p => p.rows.map(r => describeRow(r, ctx.value)).join(' · ')
const limitSentence = l => { const o = cleanLimit(l); return o.group && Object.keys(o).length > 1 ? describeRow(o, ctx.value) : '' }
const data = name => `/api/plugins/configurator/data/${encodeURIComponent(name)}`

async function load() {
  try {
    const r = await api.get('/api/configurator-groups')
    groups.value = r?.groups ?? []; parts.value = r?.parts ?? []; errors.value = r?.errors ?? []; busy.value = ''
  } catch (e) { busy.value = '✗ ' + e.message }
}
onMounted(load)

function pick(key) {
  sel.value = key
  const g = groups.value.find(x => x.key === key)
  groupEdit.value = { label: g?.label ?? '', equal: !!g?.equal }
  groupBase.value = JSON.stringify(cleanGroup(groupEdit.value))
}

async function createGroup() {
  if (!keyOk.value) return
  const key = newKey.value
  try { await api.post(data('group:' + key), {}, 'PUT'); newKey.value = ''; await load(); pick(key) }
  catch (e) { store.toast(e.message) }
}
async function saveGroup() {
  try { await api.post(data('group:' + sel.value), cleanGroup(groupEdit.value), 'PUT'); const key = sel.value; await load(); pick(key); store.toast(t('Gespeichert'), 'ok') }
  catch (e) { store.toast(e.message) }
}
async function removeGroup() {
  const g = groups.value.find(x => x.key === sel.value)
  const ok = await dialog.confirm({ title: t('Gruppe entfernen'), text: t('{0} — die Zeilen der Teile in dieser Gruppe bleiben.', [g?.label || sel.value]), ok: t('Entfernen'), danger: true })
  if (!ok) return
  try { await api.del(data('group:' + sel.value)); sel.value = ''; groupEdit.value = null; await load() }
  catch (e) { store.toast(e.message) }
}

function openPart(node) {
  const have = parts.value.find(p => p.node === node)
  edit.value = { node, rows: have ? JSON.parse(JSON.stringify(have.rows)) : [newRow('member', sel.value)] }
  editBase.value = have ? JSON.stringify(cleanRows(edit.value.rows)) : '[]'
}
const onPick = r => { picking.value = false; if (r?.id) openPart(r.id) }
async function savePart() {
  const rows = cleanRows(edit.value.rows), node = edit.value.node
  try {
    if (rows.length) await api.post(data('member:' + node), { rows }, 'PUT'); else await api.del(data('member:' + node))
    await load(); rows.length ? openPart(node) : (edit.value = null)
    store.toast(t('Gespeichert'), 'ok')
  } catch (e) { store.toast(e.message) }
}
async function removePart() {
  const node = edit.value.node
  const ok = await dialog.confirm({ title: t('Zeilen entfernen'), text: t('{0} — alle Zeilen dieses Teils.', [nameOf(node)]), ok: t('Entfernen'), danger: true })
  if (!ok) return
  try { await api.del(data('member:' + node)); edit.value = null; await load() }
  catch (e) { store.toast(e.message) }
}

const addLimit = () => { if (!props.def.limits) props.def.limits = []; props.def.limits.push({ group: sel.value }) }
const removeLimit = i => props.def.limits.splice(i, 1)
</script>

<template>
  <div class="gruppen">
    <div v-if="busy" class="neg fehler">{{ busy }}</div>
    <ul v-if="errors.length" class="fehler neg">
      <li v-for="(e, i) in errors" :key="i">✗ {{ e }}</li>
    </ul>

    <div class="spalten">
      <div class="liste">
        <div class="step-band">{{ $t('Gruppen') }} · {{ groups.length }}</div>
        <table class="grid"><tbody>
          <tr v-for="g in groups" :key="g.key" :class="{ current: sel === g.key }" style="cursor:pointer" @click="pick(g.key)">
            <td>{{ g.label || g.key }} <span v-if="g.label" class="muted">{{ g.key }}</span></td>
            <td style="width:24px" class="muted" :title="$t('Alle Werte der Mitglieder sind gleich')">{{ g.equal ? '＝' : '' }}</td>
            <td style="width:36px" class="muted" :title="$t('Mitglieder')">{{ g.members }}</td>
          </tr>
        </tbody></table>
        <form class="neu" @submit.prevent="createGroup">
          <input v-model="newKey" class="neue-gruppe" :placeholder="$t('Schlüssel, z. B. ram')" :title="$t('a–z, 0–9, _ und -, beginnt mit einem Buchstaben')" />
          <button type="submit" :disabled="!keyOk" :title="$t('Gruppe anlegen')">＋</button>
        </form>
      </div>

      <div class="rechts">
        <div v-if="groupEdit" class="kopf">
          <input v-model="groupEdit.label" class="bez" :placeholder="$t('Bezeichnung')" :title="$t('Name der Gruppe in Meldungen — leer: der Schlüssel')" />
          <label class="gleich" :title="$t('Alle Mitglieder müssen denselben Wert haben — zwei verschiedene Werte machen die Auswahl ungültig')"><input v-model="groupEdit.equal" type="checkbox" /> {{ $t('alle Werte gleich') }}</label>
          <button type="button" class="primary speichern-gruppe" :disabled="!groupDirty" @click="saveGroup">{{ $t('Speichern') }}</button>
          <button type="button" class="x entfernen-gruppe" :title="$t('Gruppe entfernen')" @click="removeGroup">✕</button>
        </div>

        <div class="step-band">{{ $t('Teile') }} · {{ shown.length }}</div>
        <table v-if="shown.length" class="grid teile"><tbody>
          <tr v-for="p in shown" :key="p.node" :class="{ current: edit?.node === p.node }" style="cursor:pointer" @click="openPart(p.node)">
            <td style="width:220px">{{ nameOf(p.node) }}</td>
            <td class="muted zusammen" :title="summary(p)">{{ summary(p) }}</td>
          </tr>
        </tbody></table>
        <div v-else class="muted leer">{{ $t('Noch kein Teil mit Zeilen') }}</div>
        <div class="kopf">
          <button type="button" class="neues-teil" :title="$t('Ein Produkt, eine Variante oder eine Gruppe im Baum wählen — Zeilen an einer Gruppe gelten für alles darunter')" @click="picking = !picking">＋ {{ $t('Teil') }}</button>
        </div>
        <TreePicker v-if="picking" v-model="picked" :roles="['group', 'product', 'variant']" :height="200" @pick="onPick" />
        <MemberEditor v-if="edit" :edit="edit" :groups="groups" :attributes="attributes" :dirty="editDirty" @save="savePart" @remove="removePart" @close="edit = null" />
      </div>
    </div>

    <div class="grenzen">
      <div class="step-band">{{ $t('Grenzen dieses Konfigurators') }} · {{ limits.length }}</div>
      <table v-if="limits.length" class="grid"><thead><tr><th>{{ $t('Gruppe') }}</th><th>{{ $t('min') }}</th><th>{{ $t('max') }}</th><th>{{ $t('Werte') }}</th><th /></tr></thead><tbody>
        <tr v-for="(l, i) in limits" :key="i">
          <td><input v-model="l.group" list="kg-gruppen-grenzen" class="grp" :placeholder="$t('Gruppe')" /></td>
          <td><input v-model.number="l.min" type="number" min="0" class="zahl" :title="$t('Mindestens so viele Teile in der Gruppe — fehlt es, ist die Auswahl unvollständig')" /></td>
          <td><input v-model.number="l.max" type="number" min="0" class="zahl" :title="$t('Höchstens so viele Teile in der Gruppe')" /></td>
          <td><input :value="valuesText(l)" class="werte" :placeholder="$t('z. B. 8, 32')" :title="$t('Erlaubte Werte der Mitglieder, mit Komma getrennt')" @input="l.valuesText = $event.target.value" /></td>
          <td class="muted satz">{{ limitSentence(l) }}</td>
          <td style="width:24px"><button type="button" class="x" :title="$t('Grenze entfernen')" @click="removeLimit(i)">✕</button></td>
        </tr>
      </tbody></table>
      <div class="kopf">
        <button type="button" class="neue-grenze" :title="$t('Mindest- und Höchstmenge und erlaubte Werte, die nur dieser Konfigurator setzt — Teile können sie zusätzlich vorgeben')" @click="addLimit">＋ {{ $t('Grenze') }}</button>
        <span class="muted">{{ $t('Die Grenzen werden mit dem Konfigurator gespeichert.') }}</span>
      </div>
      <datalist id="kg-gruppen-grenzen"><option v-for="g in groups" :key="g.key" :value="g.key">{{ g.label }}</option></datalist>
    </div>
  </div>
</template>

<style scoped>
.gruppen { padding: 4px 0; }
.spalten { display: flex; gap: 16px; align-items: flex-start; }
.liste { width: 240px; flex: none; }
.rechts { flex: 1; min-width: 0; }
.neu { display: flex; gap: 6px; margin: 8px 0; }
.neu input { flex: 1; min-width: 0; }
.kopf { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 6px 0; }
.bez { flex: 1; min-width: 160px; }
.gleich { display: inline-flex; gap: 4px; align-items: center; color: var(--muted); }
.fehler { list-style: none; padding-left: 0; margin: 0 0 8px; }
.zusammen { max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.leer { padding: 6px 0; }
.grenzen { margin-top: 18px; }
.grp { width: 130px; }
.zahl { width: 70px; }
.werte { width: 160px; }
.satz { font-size: 12px; }
.neues-teil, .neue-grenze { border: 1px dashed var(--line); background: none; color: var(--muted); padding: 4px 12px; cursor: pointer; border-radius: 6px; }
.neues-teil:hover, .neue-grenze:hover { color: var(--accent); border-color: var(--accent); }
.x { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px; }
.x:hover { color: var(--neg); }
</style>
