<script setup>
// ⊞ Struktur: den Baum als Tabelle herunterladen, in Excel entwerfen und in einem Zug einspielen — ohne Inhalte.
// Oberhalb eines Produkts stehen sonst die Attribute vieler Zweige nebeneinander, von denen jeder nur wenige füllt;
// Struktur kennt nur Namen und Verschachtelung. Sie kostet auch kein Kontingent (Kinds.Structure zählt nicht).
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { store, tree, api, icon, dialog, TreePicker, t as t_ } from 'journali'
import { toCsv, toXlsx, download, leseDatei } from '../browser.js'
import { zuTabelle, plan, planText, befehle } from '../struktur.mjs'

const route = useRoute()
const wurzel = ref(route?.query?.node ? [route.query.node] : [])
const busy = ref('')
const tabelle = ref(null)
const vorschau = ref(null)     // der Plan: was das Einspielen täte
const dateiName = ref('')
const wurzelZeile = computed(() => tree.byId.get(wurzel.value[0]))

onMounted(async () => { if (!tree.loaded) await tree.load(); if (!wurzel.value.length) wurzel.value = tree.rows.filter(r => !r.parent).slice(0, 1).map(r => r.id) })

function bauen() {
  const id = wurzel.value[0]
  if (!id) { store.toast(t_('Knoten wählen')); return null }
  const t = zuTabelle(tree.rows, id)
  tabelle.value = t
  busy.value = t_('{0} Gruppen · {1} Ebenen', [t.count, t.columns.length - 1])
  return t
}

async function herunterladen(format) {
  const t = bauen(); if (!t) return
  const name = `${wurzelZeile.value?.label || 'struktur'}-struktur`.replace(/[^\w.-]+/g, '_').slice(0, 80)
  if (format === 'csv') download(new Blob([toCsv(t)], { type: 'text/csv;charset=utf-8' }), name + '.csv')
  else download(await toXlsx(t, t_('Struktur')), name + '.xlsx')
  store.toast(t_('⇪ {0} Gruppen', [t.count]), 'ok')
}

async function datei(ev) {
  const f = ev.target.files?.[0]; if (!f) return
  dateiName.value = f.name; vorschau.value = null; busy.value = t_('lese …')
  try {
    const { kopf, zeilen } = await leseDatei(f)
    if (!tree.loaded) await tree.load()
    const p = plan(kopf, zeilen, tree.rows, wurzel.value[0])
    vorschau.value = p
    busy.value = p.fehler.length ? t_('{0} Fehler', [p.fehler.length]) : planText(p, t_)
  } catch (e) { busy.value = '✗ ' + e.message; store.toast(e.message) }
  finally { ev.target.value = '' }
}

async function einspielen() {
  const p = vorschau.value
  if (!p || p.fehler.length) return
  const anzahl = p.anlegen.length + p.umbenennen.length + p.umhaengen.length
  if (!anzahl) { store.toast(t_('nichts zu tun')); return }
  const ok = await dialog.confirm({
    title: t_('Struktur einspielen'),
    text: t_('{0} unter {1}. Gelöscht wird nichts.', [planText(p, t_), wurzelZeile.value?.label ?? '']),
    list: [...p.anlegen.slice(0, 20).map(a => '+ ' + a.pfad), ...p.umbenennen.slice(0, 20).map(u => `${u.von} → ${u.auf}`)],
    ok: t_('Einspielen'),
  })
  if (!ok) return
  busy.value = t_('spiele ein …')
  try {
    // Ein Stapel: eine Gruppe, die hier erst entsteht, steht bei ihren Kindern als @ref — der Server setzt die Id ein.
    // Als Stapel lässt sich das Ganze auch wieder zurücknehmen (⟲ im Journal)
    const r = await api.batchChunked(befehle(p, store.model?.masterLocale ?? 'de'), { label: t_('Struktur') })
    if (r.error) throw new Error(r.error.message)
    await tree.load(true)
    vorschau.value = null; dateiName.value = ''
    busy.value = ''
    store.toast(t_('⇩ {0} eingespielt', [planText(p, t_)]), 'ok')
  } catch (e) { busy.value = '✗ ' + e.message; store.toast(e.message) }
}

// Damit der Pruefstand die Ansicht bedienen kann, ohne einen Router und einen echten Dateidialog zu brauchen
defineExpose({ wurzel, tabelle, vorschau, bauen, einspielen })
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ $t("⊞ Struktur") }}</h1>
      <span class="grow" /><span :class="String(busy ?? '').startsWith('✗') ? 'fehler' : 'muted'">{{ busy }}</span></div>
    <table class="grid form"><colgroup><col style="width:84px" /><col /></colgroup><tbody>
      <tr class="step"><td colspan="2" class="step-band" style="display:table-cell;height:24px">{{ $t("1 · Wo") }}</td></tr>
      <tr><td class="attr">{{ $t("Knoten") }}</td><td>
        <div class="chips" style="margin:2px 0 4px"><span v-if="wurzelZeile" class="chip">{{ icon(wurzelZeile.role) }} {{ wurzelZeile.label }}</span><span v-else class="muted">{{ $t("Knoten anhaken — die Struktur darunter") }}</span></div>
        <TreePicker v-model="wurzel" :height="200" />
      </td></tr>
      <tr class="step"><td colspan="2" class="step-band" style="display:table-cell;height:24px">{{ $t("2 · Heraus") }}</td></tr>
      <tr><td class="attr"></td><td><div class="row">
        <button @click="bauen">{{ $t("Vorschau") }}</button>
        <button class="primary" @click="herunterladen('excel')">{{ $t("⇪ Excel") }}</button>
        <button @click="herunterladen('csv')">{{ $t("⇪ CSV") }}</button>
        <span class="muted">{{ $t("eine Spalte je Ebene, eine Zeile je Gruppe") }}</span>
      </div></td></tr>
      <tr class="step"><td colspan="2" class="step-band" style="display:table-cell;height:24px">{{ $t("3 · Hinein") }}</td></tr>
      <tr><td class="attr">{{ $t("Datei") }}</td><td><div class="row">
        <input type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" @change="datei" />
        <span v-if="dateiName" class="mono muted">{{ dateiName }}</span>
      </div></td></tr>
      <tr v-if="vorschau"><td class="attr">{{ $t("Plan") }}</td><td>
        <p v-if="vorschau.fehler.length" class="fehler">{{ vorschau.fehler.slice(0, 5).join(' · ') }}</p>
        <template v-else>
          <p>{{ planText(vorschau, $t) }}</p>
          <button class="primary" data-demo="aus" @click="einspielen">{{ $t("⇩ Einspielen") }}</button>
        </template>
      </td></tr>
    </tbody></table>
    <div class="step-band">{{ $t("4 · Vorschau") }}</div>
    <div class="scroll">
      <table v-if="tabelle" class="grid" style="width:auto"><thead><tr><th v-for="c in tabelle.columns" :key="c.key">{{ c.key }}</th></tr></thead>
        <tbody><tr v-for="(r, i) in tabelle.rows.slice(0, 200)" :key="i"><td v-for="(v, j) in r" :key="j" :class="{ muted: j === 0 }">{{ v }}</td></tr></tbody></table>
      <div v-if="!tabelle" class="empty">{{ $t("Knoten wählen, dann Vorschau oder herunterladen.") }}</div>
    </div>
  </div>
</template>
