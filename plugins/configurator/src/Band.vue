<script setup>
// Das Band „Konfiguratorgruppen“ in der Knotenansicht (docs/pflegestruktur.md 40): die Zeilen, mit denen dieses Teil zu Gruppen gehört, als Sätze — und bearbeitet
// wird hier, am Produkt, nicht erst im Reiter Gruppen des Konfigurators. Hat der Knoten keine eigenen Zeilen, gelten die des nächsten Vorfahren, der welche hat
// (eine Variante nimmt die ihres Produkts); „eigene Zeilen“ legt sie als Kopie an, eigene ersetzen die geerbten ganz.
import { ref, computed, onMounted, watch } from 'vue'
import { api, store, tree, dialog, L, t } from 'journali'
import { cleanRows, newRow } from './model.js'
import { describeRow } from './describe.js'
import MemberEditor from './MemberEditor.vue'

const props = defineProps({ nodeId: String })
const emit = defineEmits(['kopf'])

const own = ref(null)              // die eigenen Zeilen oder null
const inherited = ref(null)        // { from, rows } — die des nächsten Vorfahren, solange es keine eigenen gibt
const groups = ref([])             // [{ key, label }]
const edit = ref(null)             // { node, rows }
const base = ref('')
const error = ref('')

const attributes = computed(() => (store.model?.attributes ?? []).map(a => ({ key: a.key, label: L(a.label) || a.key })))
const nameOf = id => tree.byId?.get(id)?.label ?? id
const rows = computed(() => own.value ?? inherited.value?.rows ?? [])
const dirty = computed(() => !!edit.value && JSON.stringify(cleanRows(edit.value.rows)) !== base.value)
const ctx = computed(() => ({
  t, nodeName: nameOf, attributeName: k => attributes.value.find(a => a.key === k)?.label ?? k,
  groupName: k => groups.value.find(g => g.key === k)?.label || k,
}))
const sentence = r => describeRow(r, ctx.value)
const doc = id => `/api/plugins/configurator/data/${encodeURIComponent('member:' + id)}`
const clone = x => JSON.parse(JSON.stringify(x))

async function read() {
  error.value = ''; edit.value = null
  try {
    const [names, defined] = await Promise.all([
      api.get('/api/plugins/configurator/data?prefix=' + encodeURIComponent('member:')),
      api.get('/api/plugins/configurator/data?prefix=' + encodeURIComponent('group:') + '&values=true'),
    ])
    const have = new Set((names ?? []).map(n => n.slice('member:'.length)))
    groups.value = Object.entries(defined ?? {}).map(([n, v]) => ({ key: n.slice('group:'.length), label: v?.label ?? null }))
    own.value = have.has(props.nodeId) ? ((await api.get(doc(props.nodeId)))?.rows ?? []) : null
    inherited.value = null
    if (own.value === null) {
      for (const a of [...(tree.ancestors?.(props.nodeId) ?? [])].reverse())
        if (have.has(a.id)) { inherited.value = { from: a.id, rows: (await api.get(doc(a.id)))?.rows ?? [] }; break }
    }
    emit('kopf', own.value ? '· ' + t('{0} Zeilen', [own.value.length]) : inherited.value ? '· ' + t('{0} Zeilen', [inherited.value.rows.length]) + ' ↑ ' + nameOf(inherited.value.from) : '· ' + t('keine'))
  } catch (e) { error.value = e.message; emit('kopf', '· ✗ ' + e.message) }
}
onMounted(read)
watch(() => props.nodeId, read)

function open() {
  const copy = clone(own.value ?? inherited.value?.rows ?? [])
  edit.value = { node: props.nodeId, rows: copy.length ? copy : [newRow('member')] }
  base.value = own.value ? JSON.stringify(cleanRows(copy)) : '[]'
}
async function save() {
  const list = cleanRows(edit.value.rows)
  try {
    if (list.length) await api.post(doc(props.nodeId), { rows: list }, 'PUT'); else await api.del(doc(props.nodeId))
    store.toast(t('Gespeichert'), 'ok'); await read()
  } catch (e) { store.toast(e.message) }
}
async function remove() {
  if (own.value === null) { edit.value = null; return }   // die Kopie der geerbten Zeilen ist noch nicht gespeichert: es gibt nichts zu löschen
  const ok = await dialog.confirm({ title: t('Zeilen entfernen'), text: t('{0} — alle Zeilen dieses Teils.', [nameOf(props.nodeId)]), ok: t('Entfernen'), danger: true })
  if (!ok) return
  try { await api.del(doc(props.nodeId)); await read() } catch (e) { store.toast(e.message) }
}
</script>

<template>
  <div class="konfband">
    <div v-if="error" class="neg">✗ {{ error }}</div>
    <template v-if="!edit">
      <ul v-if="rows.length" class="saetze">
        <li v-for="(r, i) in rows" :key="i" class="satz">{{ sentence(r) }}</li>
      </ul>
      <div v-else class="muted keine">{{ $t('Keine Zeilen') }}</div>
      <div v-if="inherited" class="muted geerbt" :title="$t('Eigene Zeilen ersetzen die geerbten ganz')">↑ {{ $t('geerbt von {0}', [nameOf(inherited.from)]) }}</div>
      <div class="leiste">
        <button type="button" class="bearbeiten" :title="own ? $t('Die Zeilen dieses Teils bearbeiten') : inherited ? $t('Die geerbten Zeilen als eigene übernehmen und bearbeiten') : $t('Dieses Teil gehört mit Zeilen zu Gruppen')" @click="open">{{ own ? '✎ ' + $t('Zeilen') : inherited ? '✎ ' + $t('Eigene Zeilen') : '＋ ' + $t('Zeile') }}</button>
      </div>
    </template>
    <MemberEditor v-else :edit="edit" :groups="groups" :attributes="attributes" :dirty="dirty" @save="save" @remove="remove" @close="edit = null" />
  </div>
</template>

<style scoped>
.konfband { padding: 0 0 4px; }
.saetze { margin: 0 0 6px; padding-left: 16px; }
.satz { font-size: 13px; }
.geerbt { margin: 0 0 6px; }
.leiste { display: flex; gap: 6px; }
.bearbeiten { border: 1px dashed var(--line); background: none; color: var(--muted); padding: 4px 12px; cursor: pointer; border-radius: 6px; }
.bearbeiten:hover { color: var(--accent); border-color: var(--accent); }
</style>
