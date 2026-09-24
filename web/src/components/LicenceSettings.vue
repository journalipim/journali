<script setup>
// Die Lizenz. Sie wird nicht gepflegt, sondern eingespielt —
// darum eine Datei, kein Stammdatum. Was sie sagt, gilt für die ganze Anlage: Einträge je Woche und Monat, das
// Was ein Team an KI verbraucht, geht an seinen Anbieter — journali lizenziert das nicht.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { t as t_ } from '../i18n.js'
import { dialog } from '../dialog.js'

const emit = defineEmits(['eingespielt'])
// Das Team, das oben im Team-Reiter gewählt ist — für es wird ein Schlüssel eingelöst
const props = defineProps({ team: { type: Object, default: null } })
// Einlösen nur beim Team, das sein Kontingent selbst trägt; wer über ein anderes abrechnet, bekommt keinen Schlüssel
const eigenes = computed(() => !!props.team && (props.team.payer ?? props.team.key) === props.team.key)
const lic = ref(null)
const said = ref('')
const darf = () => store.can('users')

async function load() {
  try { lic.value = await api.get('/api/licence') } catch (e) { store.toast(e.message) }
  if (!darf()) return
  try {
    const [a, e, p] = await Promise.all([api.get('/api/licence/requests'), api.get('/api/licence/keys'), api.get('/api/licence/packages')])
    anforderungen.value = a; einloesungen.value = e; pakete.value = p
  } catch (e) { store.toast(e.message) }
}
onMounted(load)

// Schlüssel: die Instanz fordert an und signiert, der Shop gibt frei, der Aussteller stellt aus —
// eingelöst wird nur, was hier angefordert wurde. Auf Vorrat und ohne Team; das Team wählt die IT beim Einlösen.
const anforderungen = ref([])
const einloesungen = ref([])
const pakete = ref([])
const neu = ref({ wahl: 'reset:pro', count: 1 })   // wahl: 'reset:<tarif>' oder der Schlüssel eines Pakets
// Reset getrennt für Pro und Enterprise
const RESETS = [['pro', 'Pro'], ['enterprise', t_('Enterprise')]]
const paketTitel = p => `${zahl(p.week)} / Woche · ${zahl(p.month)} / Monat · ${p.days} Tage${p.alle ? ' · alle Core-Plugins' : ''}`
const paketName = k => pakete.value.find(p => p.key === k)?.label ?? RESETS.find(r => r[0] === k)?.[1] ?? k
const artName = a => a.kind === 'reset' ? t_('Reset{0}', [a.plan ? ' ' + paketName(a.plan) : '']) : a.plan ? paketName(a.plan) : t_('Limit')
const einloesung = id => einloesungen.value.find(e => e.id === id)
const angefordert = ref('')
const saidAnf = ref('')

// Eingefügt wird, was im Fenster steht — auch Zeilen davor und danach (Konsole, BEGIN/END-Marker). Gemeint ist das
// JSON von der ersten { bis zur letzten }. Ein Schlüssel trägt Art und Fingerabdruck der Anforderung; eine Anforderung
// selbst (die eigene, zurückkopiert) wird nicht übernommen; alles andere ist eine Lizenz.
const eingabe = ref('')
const inhalt = computed(() => {
  const t = eingabe.value, a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try { const o = JSON.parse(t.slice(a, b + 1)); return o && typeof o === 'object' && !Array.isArray(o) ? { text: t.slice(a, b + 1), o } : null } catch { return null }
})
// Ein Lizenzschlüssel aus dem Shop (Abo, Taloan 24.09.2026) ist kein JSON, sondern eine Kennung wie 495C1AF0-1CFB-…
const ABO = /\b[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\b/i
const aboKey = computed(() => inhalt.value ? null : eingabe.value.match(ABO)?.[0] ?? null)
const was = computed(() => !inhalt.value ? (aboKey.value ? 'abo' : null) : inhalt.value.o.kind && inhalt.value.o.request ? 'schluessel' : inhalt.value.o.anforderung ? null : 'lizenz')
// Der Stand des Abos für das oben gewählte Team
const aboTeam = computed(() => lic.value?.abos?.find(a => a.team === props.team?.key) ?? null)
const knopf = computed(() =>
  was.value === 'abo' ? { text: t_('⚿ Abo verbinden · {0}', [props.team?.label ?? '']), aus: !eigenes.value || !lic.value?.lizenzserver,
      title: !lic.value?.lizenzserver ? t_('Kein Lizenzserver eingestellt') : eigenes.value ? t_('Abo für {0} verbinden', [props.team.label]) : t_('{0} rechnet über ein anderes Team ab', [props.team?.label ?? t_('Dieses Team')]) }
  : was.value === 'schluessel' ? { text: t_('⚿ Einlösen · {0}', [props.team?.label ?? '']), aus: !eigenes.value,
      title: eigenes.value ? t_('Schlüssel für {0} einlösen', [props.team.label]) : t_('{0} rechnet über ein anderes Team ab', [props.team?.label ?? t_('Dieses Team')]) }
  : was.value === 'lizenz' ? { text: t_('⚿ Lizenz einspielen'), aus: false, title: t_('Lizenz dieser Instanz ersetzen') }
  : { text: t_('⚿ Übernehmen'), aus: true, title: eingabe.value.trim() ? t_('weder Lizenz noch Schlüssel') : t_('Lizenz oder Schlüssel einfügen') })
const uebernehmen = () => was.value === 'abo' ? verbinden() : was.value === 'schluessel' ? einloesen() : was.value === 'lizenz' ? einspielen() : null

/// Abo verbinden: der Server fragt den Lizenzserver und legt den bestätigten Stand ins Journal des Teams
async function verbinden() {
  if (!aboKey.value || !eigenes.value) return
  try {
    const r = await api.post('/api/licence/abo', { team: props.team.key, key: aboKey.value })
    eingabe.value = ''
    said.value = t_('✓ Abo {0} · bezahlt bis {1}', [r.planLabel, r.paidUntil]) + (r.geprueft ? '' : ' · ' + t_('ungeprüft'))
    await load(); await store.poll(true)
    emit('eingespielt')
  }
  catch (e) { said.value = '✗ ' + e.message }
}

/// Offene Anforderung wegwerfen — eine eingelöste weist der Server ab
async function wirfWeg(a) {
  if (!await dialog.confirm({ title: t_('Anforderung {0} wegwerfen?', [a.id]), warn: t_('Ein Schlüssel dazu lässt sich dann nicht mehr einlösen.'), ok: t_('Wegwerfen') })) return
  try { await api.del(`/api/licence/requests/${encodeURIComponent(a.id)}`); await load() }
  catch (e) { store.toast(e.message) }
}

async function anfordern() {
  try {
    const { wahl, count } = neu.value
    const r = await api.post('/api/licence/requests', wahl.startsWith('reset:') ? { kind: 'reset', plan: wahl.slice(6), count } : { kind: 'limit', plan: wahl, count })
    angefordert.value = r.length === 1 ? r[0].text : '[' + r.map(x => x.text).join(',\n') + ']'
    saidAnf.value = `✓ ${r.length} angefordert`
    await load()
  }
  catch (e) { saidAnf.value = '✗ ' + e.message }
}

async function einloesen() {
  if (!inhalt.value || !eigenes.value) return
  try {
    const r = await api.post('/api/licence/keys', { key: inhalt.value.text, team: props.team.key })
    eingabe.value = ''
    said.value = (r.until ? `✓ ${r.id} bis ${r.until}` : `✓ ${r.id} ab ${r.from}`) + (r.carried ? ' ' + t_('· +{0} Tage', [r.carried]) : '') + (r.geprueft ? '' : ` · ${r.grund ?? ''}`)
    await load(); await store.poll(true)
    emit('eingespielt')
  }
  catch (e) { said.value = '✗ ' + e.message }
}
const art = k => k === 'reset' ? '↺' : '⇡'
const zahl = n => n >= 2147483647 ? '∞' : (n ?? 0).toLocaleString('de-DE')   // Unlimited: keine Grenze

async function einspielen() {
  if (!inhalt.value) return
  try {
    const r = await api.post('/api/licence', inhalt.value.o, 'PUT')
    eingabe.value = ''
    said.value = r.geprueft ? t_('✓ eingespielt und geprüft') : `✓ eingespielt · ${r.grund ?? ''}`
    await load(); await store.poll(true)
    emit('eingespielt')   // die Limits daneben hängen an der Lizenz — sie sollen es sofort zeigen
  }
  catch (e) { said.value = '✗ ' + e.message }
}

/// Die Kennung dieser Instanz kopieren — ohne Zwischenablage bleibt sie markierbar stehen
async function kopiere(text) {
  try { await navigator.clipboard.writeText(text); store.toast('kopiert', 'ok') }
  catch { store.toast(t_('Zwischenablage nicht verfügbar — Text markieren und mit Strg+C kopieren')) }
}
</script>

<template>
  <div class="section">
    <h2>{{ $t("⚿ journali Lizenz") + ' ' }}<span v-if="lic?.holder" class="muted">· {{ lic.holder }}</span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:170px" /><col style="width:200px" /><col /></colgroup><tbody>
      <tr>
        <td class="muted">{{ $t("Stand") }}</td>
        <td>
          <span v-if="lic?.abgelaufen" class="neg">{{ $t("● abgelaufen") }}</span>
          <span v-else-if="lic?.geprueft" class="pos">{{ $t("● geprüft") }}</span>
          <span v-else class="warn">{{ $t("● ungeprüft") }}</span>
        </td>
        <td class="muted">{{ lic?.grund ?? '' }}</td>
      </tr>
      <tr v-if="lic?.instanzTarif" class="tarif"><td class="muted" :title="$t('Der höchste Tarif der Instanz: nach ihm richten sich Plugins und Publikationsbäume.')">{{ $t("◆ Tarif") }}</td>
        <td>{{ lic.instanzTarif.label }}<span v-if="lic.trial && !lic.abgelaufen" class="muted">{{ ' ' + $t("· Test") }}</span></td><td></td></tr>
      <tr v-if="aboTeam" class="abo"><td class="muted" :title="$t('Stand des Abos vom Lizenzserver, täglich aufgefrischt')">{{ $t("◆ Abo · {0}", [aboTeam.teamLabel]) }}</td>
        <td :title="$t('zuletzt bestätigt {0}', [String(aboTeam.issued).slice(0, 16).replace('T', ' ')])">{{ aboTeam.planLabel }}<span class="muted">{{ ' · ' + $t('bezahlt bis {0}', [aboTeam.paidUntil]) }}</span><span v-if="!aboTeam.gilt" class="neg">{{ ' · ' + $t('abgelaufen') }}</span><span v-else-if="!aboTeam.geprueft" class="warn">{{ ' · ' + $t('ungeprüft') }}</span></td><td></td></tr>
      <tr v-if="lic?.validUntil"><td class="muted">{{ $t("gültig bis") }}</td><td class="mono">{{ lic.validUntil }}</td><td></td></tr>
      <tr v-if="lic?.instanzTarif" class="baeume"><td class="muted" :title="$t('Publikationsbäume: vorhanden / erlaubt')">{{ $t("▣ Publikationsbäume") }}</td>
        <td class="mono">{{ lic.pubTrees ?? 0 }} / {{ lic.instanzTarif.pubTrees ?? '∞' }}</td><td></td></tr>
      <tr><td class="muted" :title="$t('journali-Token je Woche: jede Pflege schreibt einen Eintrag ins Journal.')">{{ $t("▤ Token / Woche") }}</td><td class="mono">{{ zahl(lic?.entriesWeek) }}</td><td></td></tr>
      <tr><td class="muted" :title="$t('journali-Token je Monat: jede Pflege schreibt einen Eintrag ins Journal.')">{{ $t("▦ Token / Monat") }}</td><td class="mono">{{ zahl(lic?.entriesMonth) }}</td><td></td></tr>
      <tr v-if="lic?.countFrom"><td class="muted" :title="$t('Was vor diesem Tag im Journal steht, zählt nicht mehr mit.')">{{ $t("◷ gezählt ab") }}</td><td class="mono">{{ lic.countFrom }}</td><td></td></tr>
      <tr v-if="lic?.instanz"><td class="muted" :title="$t('Diese Instanz. Eine Lizenz wird auf diese Kennung ausgestellt und gilt nur hier.')">{{ $t("⌗ Instanz") }}</td>
        <td class="mono" style="user-select:all">{{ lic.instanz }}</td>
        <td><button class="x" :title="$t('Kennung kopieren')" @click="kopiere(lic.instanz)">⧉</button></td></tr>
    </tbody></table>

    <div v-if="darf()" class="uebernahme" style="margin-top:8px">
      <textarea v-model="eingabe" class="eingabe" rows="4" style="width:100%;max-width:640px" :placeholder="$t('Lizenz oder Schlüssel')"></textarea>
      <div class="row" style="gap:8px;margin-top:4px">
        <button class="primary" :disabled="knopf.aus" :title="knopf.title" @click="uebernehmen">{{ knopf.text }}</button>
        <span class="said" :class="said.startsWith('✗') ? 'fehler' : 'muted'" style="font-size:12px">{{ said }}</span>
      </div>
    </div>

    <div v-if="darf()" class="schluessel" style="margin-top:16px">
      <h3>{{ $t("⚷ Schlüssel") }}</h3>
      <div class="row anfordern" style="gap:6px;flex-wrap:wrap;align-items:center">
        <select v-model="neu.wahl" class="wahl">
          <option v-for="[k, l] in RESETS" :key="'reset:' + k" :value="'reset:' + k">{{ $t("↺ Reset {0}", [l]) }}</option>
          <option v-for="p in pakete" :key="p.key" :value="p.key">⇡ {{ p.label }} · {{ paketTitel(p) }}</option>
        </select>
        <select v-model.number="neu.count" class="anzahl" :title="$t('Anzahl Anforderungen')">
          <option v-for="n in [1, 2, 5, 10]" :key="n" :value="n">× {{ n }}</option>
        </select>
        <button @click="anfordern" :title="$t('Anforderung erstellen und mit dem Schlüssel dieser Instanz signieren')">{{ $t("⚷ Anfordern") }}</button>
        <span class="said-anf" :class="saidAnf.startsWith('✗') ? 'fehler' : 'muted'" style="font-size:12px">{{ saidAnf }}</span>
      </div>
      <div v-if="angefordert" class="row" style="gap:6px;margin-top:4px;align-items:flex-start">
        <textarea class="angefordert mono" readonly rows="3" style="width:100%;max-width:640px" :value="angefordert"></textarea>
        <button class="x" :title="$t('Anforderung kopieren')" @click="kopiere(angefordert)">⧉</button>
      </div>

      <table v-if="anforderungen.length" class="grid anforderungen" style="width:auto;margin-top:8px"><thead><tr>
        <th>{{ $t("Id") }}</th><th>{{ $t("Art") }}</th><th>{{ $t("angefordert") }}</th><th>{{ $t("eingelöst") }}</th><th>{{ $t("Team") }}</th><th>{{ $t("gilt bis") }}</th><th></th>
      </tr></thead><tbody>
        <tr v-for="a in anforderungen" :key="a.id">
          <td class="mono">{{ a.id }}</td>
          <td :title="a.kind === 'limit' ? paketTitel(a) : $t('Das Team zählt ab dem Einlösen neu.')">{{ art(a.kind) }} {{ artName(a) }}</td>
          <td class="mono">{{ String(a.created).slice(0, 10) }}</td>
          <template v-if="a.team">
            <td class="mono pos">✓ {{ einloesung(a.id)?.from ?? '' }}</td>
            <td>{{ a.teamLabel }}</td>
            <td class="mono" :title="einloesung(a.id)?.carried ? $t('+{0} Tage aus dem laufenden Limit', [einloesung(a.id).carried]) : ''">{{ einloesung(a.id)?.until ?? '' }}<template v-if="einloesung(a.id)?.carried"> (+{{ einloesung(a.id).carried }})</template></td>
            <td></td>
          </template>
          <template v-else>
            <td class="muted">{{ $t("● offen") }}</td><td></td><td></td>
            <td style="white-space:nowrap"><button class="x" :title="$t('Anforderung kopieren')" @click="kopiere(a.text)">⧉</button><button class="x neg" :title="$t('Anforderung wegwerfen — ein Schlüssel dazu lässt sich dann nicht mehr einlösen')" @click="wirfWeg(a)">🗑</button></td>
          </template>
        </tr>
      </tbody></table>

    </div>
  </div>
</template>
