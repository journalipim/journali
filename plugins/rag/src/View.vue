<script setup>
// ⇪ Export → KI-Wissensbasis: das Profil des Jobs rag (28.09.2026). Hier steht, WAS ausgeleitet wird — Teilbaum,
// Knoten, Sprachen, Version und Belege, Text der Dokumente. Verzeichnis und Zeitplan stehen am Job (⏱ Jobs).
// Gespeichert als profile:<name> in den Daten des Plugins — dieselben Namen, die der Profil-Editor des Taskers bis
// dahin anlegte; der JobRunner füllt daraus die Parameter des Laufs (Listen mit Komma).
import { ref, computed, onMounted } from 'vue'
import { store, tree, icon, plugins, TreePicker, ProfileBar } from 'journali'
import { t as t_ } from 'journali'

const root = ref('')
const role = ref('product')
const locales = ref([])
const withVersions = ref(true)
const withDocs = ref(true)

const ROLLEN = ['product', 'variant', 'group', 'all']
const rollenText = { product: t_('▦ Produkte'), variant: t_('◆ Varianten'), group: t_('▣ Gruppen'), all: t_('alle Knoten') }
const alleSprachen = computed(() => (store.model?.locales ?? []).map(l => l.code))
const leitsprache = computed(() => store.model?.masterLocale ?? alleSprachen.value[0] ?? 'de')

// Das Profil: Werte in der Form der Parameter — der Job liest sie so, wie sie hier stehen
const profileGet = () => ({ root: root.value, role: role.value, locales: [...locales.value], withVersions: withVersions.value, withDocs: withDocs.value })
function profileSet(p) {
  root.value = p?.root ?? ''
  role.value = ROLLEN.includes(p?.role) ? p.role : 'product'
  // ältere Profile (Profil-Editor des Taskers) tragen die Sprachen als Text mit Komma, Schalter als Text
  const l = p?.locales
  locales.value = Array.isArray(l) ? [...l] : String(l ?? '').split(/[,\s]+/).filter(Boolean)
  withVersions.value = p?.withVersions == null ? true : String(p.withVersions) === 'true'
  withDocs.value = p?.withDocs == null ? true : String(p.withDocs) === 'true'
}

// Wie viele Knoten der Lauf ausleitet — derselbe Filter wie im Job
const knoten = computed(() => {
  const unter = id => { for (let p = tree.byId.get(id)?.parent; p; p = tree.byId.get(p)?.parent) if (p === root.value) return true; return false }
  return tree.rows.filter(r => (root.value ? r.id === root.value || unter(r.id) : true) && r.role !== 'media' && (role.value === 'all' || r.role === role.value)).length
})
const sprachenText = computed(() => (locales.value.length ? locales.value : [leitsprache.value]).join(', '))
const wurzel = computed(() => root.value ? tree.byId.get(root.value) : null)

function sprache(c) { const s = new Set(locales.value); s.has(c) ? s.delete(c) : s.add(c); locales.value = alleSprachen.value.filter(x => s.has(x)) }
onMounted(() => { if (!tree.loaded) tree.load() })
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ $t("✧ KI-Wissensbasis") }}</h1><span class="grow" />
      <span class="muted anzahl" :title="$t('so viele Knoten leitet ein Lauf mit diesem Profil aus, je Sprache ein Dokument')">{{ $t("{0} Knoten · {1}", [knoten, sprachenText]) }}</span></div>
    <table class="grid form"><colgroup><col style="width:96px" /><col /></colgroup><tbody>
      <tr><td class="attr">{{ $t("Profil") }}</td><td><ProfileBar plugin="rag" scope="profile" :get="profileGet" :set="profileSet" /></td></tr>
      <tr><td class="attr">{{ $t("Teilbaum") }}</td><td>
        <div class="muted" style="margin:2px 0 4px">{{ wurzel ? icon(wurzel.role) + ' ' + wurzel.label : $t('⌂ alles') }}</div>
        <TreePicker v-model="root" :roles="['group', 'product']" allow-root :height="220" />
      </td></tr>
      <tr><td class="attr">{{ $t("Knoten") }}</td><td><select v-model="role" class="rolle" style="width:100%"><option v-for="r in ROLLEN" :key="r" :value="r">{{ rollenText[r] }}</option></select></td></tr>
      <tr><td class="attr">{{ $t("Sprachen") }}</td><td><div class="chips">
        <span v-for="c in alleSprachen" :key="c" class="view-chip sprache" :class="{ on: locales.includes(c) }" @click="sprache(c)">{{ c }}</span>
        <span v-if="!locales.length" class="muted" :title="$t('ohne Auswahl gilt die Leitsprache')">{{ ' ' + $t("· Leitsprache {0}", [leitsprache]) }}</span></div></td></tr>
      <tr><td class="attr">{{ $t("Version") }}</td><td><label :title="$t('die jüngste nicht zurückgezogene Version des Knotens mit ihren Belegen — die Zitierstelle')"><input type="checkbox" v-model="withVersions" class="versionen" />{{ ' ' + $t("freigegebene Version und Belege mitgeben") }}</label></td></tr>
      <tr><td class="attr">{{ $t("Dokumente") }}</td><td><label :title="$t('Text der gültigen und freigegebenen Dokumente am Knoten, aus dem Dokumentindex')"><input type="checkbox" v-model="withDocs" class="dokumente" />{{ ' ' + $t("Text der Dokumente am Knoten mitgeben") }}</label></td></tr>
      <tr><td class="attr"></td><td><div class="row">
        <router-link v-if="plugins.enabled('tasker')" to="/p/tasker/jobs?new=rag" custom v-slot="{ navigate }"><button class="primary" @click="navigate" :title="$t('Verzeichnis und Zeitplan stehen am Job — dort dieses Profil wählen')">{{ $t("⏱ als Job") }}</button></router-link>
        <router-link v-if="plugins.enabled('tasker')" to="/p/tasker/jobs" custom v-slot="{ navigate }"><button @click="navigate" :title="$t('die Jobs unter ⏱ Jobs — Zeitplan, Läufe, Logs')">{{ $t("⏱ Jobs verwalten") }}</button></router-link>
      </div></td></tr>
    </tbody></table>
  </div>
</template>

<style scoped>
.form { width: 100%; border-bottom: 1px solid var(--line); }
.form td { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px; }
.form td.attr { color: var(--muted); white-space: nowrap; padding-left: 8px; }
.row { display: flex; gap: 6px; align-items: center; }
</style>
