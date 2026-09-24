<script setup>
// Versionen am Knoten (Taloan, 19.09.2026): Freigabe = Version — Zeiger auf den Journalstand plus eingefrorene Belege der
// Erzeuger-Plugins (Datenblatt …). „Stand ansehen“ vergleicht die eigenen Werte von damals mit heute; „Zurückrollen“ zeigt den
// Plan und schreibt dann vorwärts (Stapel, rückgängig machbar). Zurückziehen markiert nur.
import { ref, computed, watch } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { t } from '../i18n.js'
import { L } from '../i18n.js'

const props = defineProps({ id: String, role: String })
const emit = defineEmits(['changed'])
const versions = ref([])
const form = ref(null)          // { channel, locale, note, retentionYears }
const diffOf = ref(null)        // { nr, rows, changed }
const plan = ref(null)          // { nr, plan, skipped }
const busy = ref('')
const channels = computed(() => store.model?.channels.map(c => c.key) ?? [])
const locales = computed(() => store.model?.locales.map(l => l.code) ?? [])
const label = a => L(store.model?.attributes.find(x => x.key === a)?.label) || a

async function load() { try { versions.value = await api.get(`/api/nodes/${encodeURIComponent(props.id)}/versions`) } catch { versions.value = [] } }
watch(() => props.id, () => { diffOf.value = null; plan.value = null; form.value = null; load() }, { immediate: true })

function openForm() { form.value = { channel: '', locale: '', note: '', retentionYears: 10 } }
async function create() {
  if (!store.actor) { store.toast(t('👤 Name fehlt → Einstellungen')); return }
  busy.value = 'erzeuge …'
  try {
    const v = await api.post(`/api/nodes/${encodeURIComponent(props.id)}/versions`, { channel: form.value.channel || null, locale: form.value.locale || null, note: form.value.note || null, retentionYears: Number(form.value.retentionYears) || 10 })
    form.value = null; await load(); emit('changed')
    store.toast(t('Version {0} — Belege werden erzeugt', [v.nr]), 'ok')
    // Erzeuger laufen im Server nach; ein paar Mal nachsehen
    for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 2000)); await load(); if (versions.value.find(x => x.nr === v.nr)?.documents.length) break }
  } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
async function render(v) {
  busy.value = t('Belege …')
  try { await api.post(`/api/nodes/${encodeURIComponent(props.id)}/versions/${v.nr}/render`, {}); for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 2000)); await load() } }
  catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
async function withdraw(v) {
  const reason = await dialog.prompt({ title: t('Version {0} zurückziehen?', [v.nr]), warn: t('Gilt danach nicht mehr, bleibt sichtbar'), placeholder: t('Grund'), ok: t('Zurückziehen'), danger: true })
  if (reason === null) return
  try { await api.post(`/api/nodes/${encodeURIComponent(props.id)}/versions/${v.nr}/withdraw`, { reason }); await load(); emit('changed') } catch (e) { store.toast(e.message) }
}
async function showDiff(v) {
  if (diffOf.value?.nr === v.nr) { diffOf.value = null; return }
  busy.value = t('lese Stand …')
  try { const d = await api.get(`/api/nodes/${encodeURIComponent(props.id)}/versions/${v.nr}/diff`); diffOf.value = { nr: v.nr, ...d } } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
async function planRollback(v) {
  busy.value = 'plane …'
  try { const p = await api.post(`/api/nodes/${encodeURIComponent(props.id)}/versions/${v.nr}/rollback`, { dryRun: true }); plan.value = { nr: v.nr, ...p } } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
async function rollback() {
  const p = plan.value; if (!p) return
  if (!await dialog.confirm({ title: t('Auf Version {0} zurückrollen?', [p.nr]), warn: t('{0} Werte werden gesetzt', [p.plan.length]), text: p.skipped.length ? t('{0} bleiben aussen vor (unbekannt, gilt hier nicht, Zeilen)', [p.skipped.length]) : t('Als Stapel (rückgängig machbar)'), ok: t('Zurückrollen'), danger: true })) return
  busy.value = 'schreibe …'
  try { const r = await api.post(`/api/nodes/${encodeURIComponent(props.id)}/versions/${p.nr}/rollback`, { dryRun: false }); plan.value = null; diffOf.value = null; store.toast(`↶ ${r.done} gesetzt${r.errors.length ? ` · ${r.errors.length} Fehler` : ''}`, r.errors.length ? 'error' : 'ok'); emit('changed') }
  catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
const axisText = r => [r.locale, r.channel, r.row ? t('Zeile') + ' ' + r.row : null].filter(Boolean).join(' · ')
const KIND = { datasheet: t('▤ Datenblatt'), sds: t('⚠ Sicherheitsdatenblatt') }
</script>

<template>
  <div class="vers">
    <div class="row" style="gap:6px;align-items:center;margin-bottom:4px">
      <button class="primary" @click="openForm" :disabled="!!form" :title="$t('Stand jetzt einfrieren — Belege erzeugen die Erzeuger-Plugins')">{{ $t("＋ Version") }}</button>
      <span class="muted" style="font-size:12px">{{ busy || (versions.length ? $t('{0} · Aufbewahrung ab Erzeugung', [versions.length]) : $t('noch keine — eine Version ist ein Zeiger auf den Journalstand plus die Belege, die nach draussen gingen')) }}</span>
    </div>
    <div v-if="form" class="picker" style="padding:8px;margin-bottom:6px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <select v-model="form.channel" :title="$t('Kanal — mit Kanal wird Vollständigkeit geprüft')"><option value="">{{ $t("Kanal: alle") }}</option><option v-for="c in channels" :key="c" :value="c">{{ c }}</option></select>
        <select v-model="form.locale" :title="$t('Sprache des Belegs')"><option value="">{{ $t("Sprache: wie eingestellt") }}</option><option v-for="l in locales" :key="l" :value="l">{{ l }}</option></select>
        <input v-model="form.note" type="text" :placeholder="$t('Anmerkung (z. B. Anlass)')" style="flex:1;min-width:160px" />
        <label class="muted" style="font-size:12px">{{ $t("aufbewahren") + ' ' }}<input v-model="form.retentionYears" type="number" min="1" max="100" style="width:56px" />{{ ' ' + $t("Jahre") }}</label>
        <button class="primary" @click="create">{{ $t("Version erzeugen") }}</button><button @click="form = null">{{ $t("Abbrechen") }}</button>
      </div>
    </div>
    <table v-if="versions.length" class="grid" style="width:100%">
      <thead><tr><th style="width:36px">{{ $t("Nr") }}</th><th style="width:140px">{{ $t("wann · wer") }}</th><th style="width:90px">{{ $t("Kanal · Sprache") }}</th><th>{{ $t("Belege") }}</th><th style="width:70px">{{ $t("Stand") }}</th><th style="width:150px"></th></tr></thead>
      <tbody>
        <template v-for="v in [...versions].reverse()" :key="v.nr">
          <tr :class="{ off: v.withdrawn }">
            <td class="mono" :title="v.withdrawn ? $t('zurückgezogen:') + ' ' + (v.withdrawnReason || '') : $t('gilt · aufbewahren bis') + ' ' + when(v.retainUntil)">{{ v.withdrawn ? '⊘' : '✓' }} {{ v.nr }}</td>
            <td class="muted" style="font-size:12px">{{ when(v.at) }} 👤 {{ v.actor }}</td>
            <td class="mono muted">{{ v.channel || '*' }} · {{ v.locale || '*' }}</td>
            <td>
              <a v-for="d in v.documents" :key="d.kind + d.renderer" :href="d.url" target="_blank" class="chip" :title="`${d.name} · ${d.mime} · ${(d.bytes / 1024).toFixed(0)} KB · ${d.renderer ?? ''}`">{{ KIND[d.kind] ?? d.kind }}</a>
              <span v-if="!v.documents.length" class="muted" style="font-size:12px">{{ $t("noch kein Beleg") + ' ' }}<button class="x" @click="render(v)" :title="$t('Erzeuger nochmal laufen lassen')">↻</button></span>
              <span v-if="v.note" class="muted" style="font-size:12px"> · {{ v.note }}</span>
            </td>
            <td class="mono muted" :title="$t('Journal bis #') + v.journalNumber">#{{ v.journalNumber }}</td>
            <td class="row" style="gap:4px">
              <button class="x" @click="showDiff(v)" :class="{ primary: diffOf?.nr === v.nr }" :title="$t('eigene Werte damals gegen heute')">{{ $t("≠ Stand") }}</button>
              <button class="x" @click="planRollback(v)" :title="$t('Werte von damals wieder setzen — erst der Plan')">↶</button>
              <button v-if="!v.withdrawn" class="x" @click="withdraw(v)" :title="$t('zurückziehen (bleibt sichtbar)')">⊘</button>
            </td>
          </tr>
          <tr v-if="diffOf?.nr === v.nr"><td colspan="6" style="padding:4px 8px">
            <div class="muted" style="font-size:12px;margin-bottom:4px">{{ $t("Stand bei Version {0} (#{1}) gegen heute · {2} anders · geerbte Werte zählen nicht — nur dieser Knoten", [v.nr, v.journalNumber, diffOf.changed]) }}</div>
            <table class="grid" style="width:100%"><thead><tr><th>{{ $t("Attribut") }}</th><th style="width:110px">{{ $t("Achse") }}</th><th>{{ $t("damals") }}</th><th>{{ $t("heute") }}</th></tr></thead>
              <tbody><tr v-for="r in diffOf.rows.filter(x => !x.same)" :key="r.kind + r.attribute + r.locale + r.channel + r.row" :title="r.note ?? ''">
                <td>{{ r.kind === 'value' ? label(r.attribute) : r.kind === 'name' ? $t('Name') : r.kind === 'status' ? $t('Status') : $t('Anzeigename') }}<span v-if="r.note" class="neg"> ⚠</span></td>
                <td class="mono muted">{{ axisText(r) }}</td><td class="pos">{{ r.then ?? '—' }}</td><td class="muted">{{ r.now ?? '—' }}</td></tr>
                <tr v-if="!diffOf.rows.some(x => !x.same)"><td colspan="4" class="muted">{{ $t("identisch") }}</td></tr></tbody></table>
          </td></tr>
          <tr v-if="plan?.nr === v.nr"><td colspan="6" style="padding:4px 8px">
            <div class="row" style="gap:8px;align-items:center;margin-bottom:4px"><b>{{ $t("Plan: auf Version {0} zurückrollen", [v.nr]) }}</b><span class="pos">{{ $t("{0} setzen", [plan.plan.length]) }}</span><span v-if="plan.skipped.length" class="muted">{{ $t("{0} aussen vor", [plan.skipped.length]) }}</span><span class="grow" /><button class="primary" :disabled="!plan.plan.length" @click="rollback">{{ $t("↶ Zurückrollen") }}</button><button @click="plan = null">×</button></div>
            <table class="grid" style="width:100%"><tbody>
              <tr v-for="r in plan.plan" :key="'p' + r.kind + r.attribute + r.locale + r.channel"><td>{{ r.kind === 'value' ? label(r.attribute) : r.kind }}</td><td class="mono muted" style="width:110px">{{ axisText(r) }}</td><td class="muted">{{ r.now ?? '—' }}</td><td>→ <b>{{ r.then ?? '— (leeren)' }}</b></td></tr>
              <tr v-for="r in plan.skipped" :key="'s' + r.kind + r.attribute + r.locale + r.channel" class="off"><td>{{ r.kind === 'value' ? label(r.attribute) : r.kind }}</td><td class="mono muted" style="width:110px">{{ axisText(r) }}</td><td class="muted" colspan="2">⚠ {{ r.note }}</td></tr>
            </tbody></table>
          </td></tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.row { display: flex; }
tr.off td { opacity: .55; }
.chip { margin-right: 4px; text-decoration: none; }
</style>
