<script setup>
// ⚙ Konfigurator: Regeln pflegen und Beispiele prüfen. Die Regeln stehen als Plugin-Daten im Journal (def:<konfigurator>); geprüft wird auf dem
// Server — hier steht nur die Bedienung. Die Prüfung eines Beispiels fragt denselben Endpunkt wie ein Shop.
import { ref, computed, onMounted } from 'vue'
import { api, store, dialog, tree, TreePicker, L, t } from 'journali'
import { emptyDefinition, cleanDefinition, KEY_PATTERN } from './model.js'
import { describeRule } from './describe.js'
import RuleEditor from './RuleEditor.vue'
import CheckPanel from './CheckPanel.vue'

const list = ref([])               // [{ key, label, root, rules, errors }]
const cur = ref('')                // Schlüssel des offenen Konfigurators
const def = ref(null)              // die Definition, wie sie bearbeitet wird
const errors = ref([])             // was der Server an der gespeicherten Definition bemängelt
const baseline = ref('')            // die Definition, wie sie gespeichert ist (aufgeräumt) — ungespeichert ist, was davon abweicht
const dirty = computed(() => !!def.value && JSON.stringify(cleanDefinition(def.value)) !== baseline.value)
const tab = ref('rules')
const busy = ref('')
const newKey = ref('')
const rootOpen = ref(false)

const attributes = computed(() => (store.model?.attributes ?? []).map(a => ({ key: a.key, label: L(a.label) || a.key })).sort((a, b) => a.label.localeCompare(b.label)))
const rootName = computed(() => def.value?.root ? (tree.byId?.get(def.value.root)?.label ?? def.value.root) : '')
const keyOk = computed(() => KEY_PATTERN.test(newKey.value) && !list.value.some(c => c.key === newKey.value))

async function loadList() {
  try { list.value = await api.get('/api/configurator') ?? []; busy.value = '' }
  catch (e) { list.value = []; busy.value = '✗ ' + e.message }
}
onMounted(loadList)

async function open(key) {
  try {
    const r = await api.get(`/api/configurator/${encodeURIComponent(key)}`)
    def.value = { label: '', rules: [], ...JSON.parse(JSON.stringify(r.definition ?? {})) }
    def.value.rules ??= []
    errors.value = r.errors ?? []
    baseline.value = JSON.stringify(cleanDefinition(def.value))
    cur.value = key; busy.value = ''
  } catch (e) { busy.value = '✗ ' + e.message }
}

async function writeDef(key, d) { await api.post(`/api/plugins/configurator/data/${encodeURIComponent('def:' + key)}`, cleanDefinition(d), 'PUT') }

async function create() {
  if (!keyOk.value) return
  const key = newKey.value
  try {
    await writeDef(key, emptyDefinition(key))
    newKey.value = ''
    await loadList(); await open(key)
  } catch (e) { store.toast(e.message) }
}

async function save() {
  // eine Regel ohne eigene Meldung bekommt ihren Satz als Meldung
  const ctx = { t, nodeName: id => tree.byId?.get(id)?.label ?? id, attributeName: k => attributes.value.find(a => a.key === k)?.label ?? k }
  for (const r of def.value.rules) if (!String(r.text ?? '').trim()) r.text = describeRule(r, ctx)
  try {
    await writeDef(cur.value, def.value)
    await loadList(); await open(cur.value)
    store.toast(t('Gespeichert'), 'ok')
  } catch (e) { store.toast(e.message) }
}

async function remove() {
  const key = cur.value
  const ok = await dialog.confirm({ title: t('Konfigurator entfernen'), text: t('{0} — mit seinen Regeln und Testfällen.', [def.value?.label || key]), ok: t('Entfernen'), danger: true })
  if (!ok) return
  try {
    const cases = await api.get(`/api/plugins/configurator/data?prefix=${encodeURIComponent('case:' + key + ':')}`) ?? []
    for (const name of cases) await api.del(`/api/plugins/configurator/data/${encodeURIComponent(name)}`)
    await api.del(`/api/plugins/configurator/data/${encodeURIComponent('def:' + key)}`)
    cur.value = ''; def.value = null; errors.value = []
    await loadList()
  } catch (e) { store.toast(e.message) }
}
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ $t("⚙ Konfigurator") }}</h1>
      <span class="grow" /><span :class="String(busy).startsWith('✗') ? 'fehler' : 'muted'">{{ busy }}</span></div>

    <div class="seiten">
      <div class="liste">
        <div class="step-band">{{ $t('Konfiguratoren') }} · {{ list.length }}</div>
        <table class="grid"><tbody>
          <tr v-for="c in list" :key="c.key" :class="{ current: cur === c.key }" style="cursor:pointer" @click="open(c.key)">
            <td>{{ c.label || c.key }} <span class="muted">{{ c.key }}</span></td>
            <td class="muted" style="width:40px" :title="$t('Regeln')">{{ c.rules }}</td>
            <td style="width:24px" :class="c.errors ? 'neg' : ''" :title="c.errors ? $t('Die Definition hat Fehler') : ''">{{ c.errors ? '✗' : '' }}</td>
          </tr>
        </tbody></table>
        <form class="neu" @submit.prevent="create">
          <input v-model="newKey" :placeholder="$t('Schlüssel, z. B. server')" :title="$t('a–z, 0–9, _ und -, beginnt mit einem Buchstaben')" />
          <button type="submit" :disabled="!keyOk" :title="$t('Konfigurator anlegen')">＋</button>
        </form>
      </div>

      <div v-if="def" class="rechts">
        <div class="kopf">
          <input v-model="def.label" class="bez" :placeholder="$t('Bezeichnung')" />
          <button type="button" class="primary" :disabled="!dirty" @click="save">{{ $t('Speichern') }}</button>
          <button type="button" :title="$t('Konfigurator entfernen')" @click="remove">✕</button>
        </div>
        <div class="kopf">
          <span class="muted" :title="$t('Der Teilbaum, aus dem gewählt werden darf — leer: alles')">{{ $t('Wurzel') }}</span>
          <button type="button" class="knoten" @click="rootOpen = !rootOpen">{{ rootName || $t('alles') }}</button>
          <button v-if="def.root" type="button" class="x" :title="$t('Wurzel entfernen')" @click="def.root = ''">✕</button>
          <span class="muted" :title="$t('Das Zeilenattribut am Produkt mit den Spalten resource und amount')">{{ $t('Ressourcen') }}</span>
          <input v-model="def.resources" class="res" placeholder="resources" />
        </div>
        <TreePicker v-if="rootOpen" v-model="def.root" :roles="['group', 'product']" allow-root :height="180" @pick="rootOpen = false" />

        <ul v-if="errors.length" class="fehler neg">
          <li v-for="(e, i) in errors" :key="i">✗ {{ e }}</li>
        </ul>

        <div class="tabs">
          <button type="button" :class="{ on: tab === 'rules' }" @click="tab = 'rules'">{{ $t('Regeln') }} · {{ def.rules.length }}</button>
          <button type="button" :class="{ on: tab === 'check' }" @click="tab = 'check'">{{ $t('Prüfen') }}</button>
        </div>
        <RuleEditor v-if="tab === 'rules'" :def="def" :attributes="attributes" />
        <CheckPanel v-else :configurator="cur" :unsaved="dirty" />
      </div>
      <div v-else class="rechts muted leer">{{ $t('Einen Konfigurator wählen oder anlegen') }}</div>
    </div>
  </div>
</template>

<style scoped>
.seiten { display: flex; gap: 16px; align-items: flex-start; padding: 8px 12px; overflow: auto; }
.liste { width: 240px; flex: none; }
.rechts { flex: 1; min-width: 0; }
.neu { display: flex; gap: 6px; margin: 8px 0; }
.neu input { flex: 1; min-width: 0; }
.kopf { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0 0 8px; }
.bez { flex: 1; min-width: 200px; }
.res { width: 140px; }
.knoten { border: 1px solid var(--line); background: var(--pane); color: var(--text); padding: 1px 8px; cursor: pointer; border-radius: 3px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.x { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px; }
.x:hover { color: var(--neg); }
.fehler { list-style: none; padding-left: 0; margin: 0 0 8px; }
.tabs { display: flex; gap: 4px; margin: 8px 0; border-bottom: 1px solid var(--line); }
.tabs button { border: 0; border-bottom: 2px solid transparent; background: none; color: var(--muted); padding: 4px 12px; cursor: pointer; }
.tabs button.on { color: var(--text); border-bottom-color: var(--accent); }
.leer { padding: 24px; }
</style>
