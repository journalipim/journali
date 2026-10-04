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
// limits: das Kontingent dieses Teams ({ week, month }) — dieselben Zahlen wie unter ✦ journali Limits. Die Lizenz allein
// sagt weniger, sobald ein Abo das Team anhebt (Lizenz Kostenlos, Abo Pro: es gilt Pro); ohne limits die der Lizenz.
// Rechnet das Team über ein anderes ab, fallen die beiden Zeilen weg (25.09.2026): seine Limits sind dann die des
// Zahlers und stehen unter ✦ journali Limits — mit seiner Lizenz haben sie nichts zu tun.
const props = defineProps({ team: { type: Object, default: null }, limits: { type: Object, default: null } })
// Einlösen nur beim Team, das sein Kontingent selbst trägt; wer über ein anderes abrechnet, bekommt keinen Schlüssel
const eigenes = computed(() => !!props.team && (props.team.payer ?? props.team.key) === props.team.key)
const lic = ref(null)
const said = ref('')
/// Der Weg von Hand — Schlüssel einfügen und Anforderungen — steht zugeklappt da: gekauft wird mit dem Knopf oben
/// (26.09.2026). Das Eingabefeld war das Erste, was jemand sah, und liess ihn nach einem Code suchen, den er nicht hat.
const vonHand = ref(false)
const darf = () => store.can('users')
/// Das Team führen: ein Teammanager bestellt sein Kontingent selbst (26.09.2026); der Administrator darf es überall
const fuehrt = computed(() => store.can('users') || (store.can('team') && (props.team?.managers ?? []).includes(store.auth.user)))
/// Die Adresse des Shops mit Instanz und Team daran — und, wenn eine Aktion gewählt ist, mit ihrem Rabattcode. Es ist
/// eine Adresse für alle Tarife: den Tarif wählt der Anwender im Shop, und was er kauft, findet über den Lizenzserver
/// zu diesem Team zurück.
function kaufAdresse(rabatt = null) {
  if (!lic.value?.kauf || !lic.value?.instanz || !props.team) return null
  let u
  try { u = new URL(lic.value.kauf) } catch { return null }
  u.searchParams.set('checkout[custom][instanz]', lic.value.instanz)
  u.searchParams.set('checkout[custom][team]', props.team.key)
  if (rabatt?.code) u.searchParams.set('checkout[discount_code]', rabatt.code)
  return u.toString()
}
const kannBestellen = computed(() => !!kaufAdresse())
/// Die Aktionen des Shops, die heute gelten — je eine steht als eigener Knopf da, mit ihrem Code an der Adresse
const rabatte = computed(() => lic.value?.rabatte ?? [])

/// Registrierung umstellen: registriert holt die Anlage das Tarifblatt, ohne spricht sie nicht mit dem Lizenzserver
async function registrierung(ja) {
  try {
    const r = await api.post('/api/licence/registrierung', { ja })
    said.value = r.fehler ? '✗ ' + r.fehler : '✓ ' + (ja ? t_('registriert') : t_('nicht registriert'))
    await load(); await store.poll(true)
  }
  catch (e) { said.value = '✗ ' + e.message }
}

/// Bestellen: den Shop öffnen. Der Kauf meldet sich beim Lizenzserver, ↻ holt den Stand
function bestellen(rabatt = null) {
  const url = kaufAdresse(rabatt)
  if (!url) return
  window.open(url, '_blank', 'noopener')
  said.value = '✓ ' + (rabatt ? t_('Shop geöffnet · Code {0}', [rabatt.code]) : t_('Shop geöffnet'))
}

async function load() {
  try { lic.value = await api.get('/api/licence') } catch (e) { store.toast(e.message) }
  if (!darf()) return
  try { einloesungen.value = await api.get('/api/licence/keys') } catch (e) { store.toast(e.message) }
}
onMounted(load)

// Was hier eingelöst wurde. Eine Anforderung erzeugt die Instanz nicht mehr (26.09.2026): wer einen Schlüssel braucht,
// hat vorher Kontakt, und der Support stellt ihn für die Instanz aus — die Kennung steht oben. Einlösen bleibt.
const einloesungen = ref([])

// Eingefügt wird, was im Fenster steht — auch Zeilen davor und danach (Konsole, BEGIN/END-Marker). Gemeint ist das
// JSON von der ersten { bis zur letzten }. Ein Schlüssel trägt Art und Fingerabdruck der Anforderung; eine Anforderung
// selbst (die eigene, zurückkopiert) wird nicht übernommen; alles andere ist eine Lizenz.
const eingabe = ref('')
const inhalt = computed(() => {
  const t = eingabe.value, a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try { const o = JSON.parse(t.slice(a, b + 1)); return o && typeof o === 'object' && !Array.isArray(o) ? { text: t.slice(a, b + 1), o } : null } catch { return null }
})
// Ein Lizenzschlüssel aus dem Shop (Abo) ist kein JSON, sondern eine Kennung wie 495C1AF0-1CFB-…
const ABO = /\b[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\b/i
const aboKey = computed(() => inhalt.value ? null : eingabe.value.match(ABO)?.[0] ?? null)
// Eine Lizenz für die ganze Instanz gibt es nicht (25.09.2026): jede gehört einem Team — Abo oder Schlüssel zum Kopieren
const was = computed(() => !inhalt.value ? (aboKey.value ? 'abo' : null) : inhalt.value.o.kind && inhalt.value.o.sig && (inhalt.value.o.request || inhalt.value.o.instance) ? 'schluessel' : null)
// Der Stand des Abos für das oben gewählte Team
const aboTeam = computed(() => lic.value?.abos?.find(a => a.team === props.team?.key) ?? null)
/// Woher der Tarif kommt — als Beisatz in der Zeile Tarif (03.10.2026: „Pro“ ohne Herkunft verstand niemand)
const herkunft = computed(() => {
  const q = lic.value?.quelle
  if (!q) return lic.value?.trial && !lic.value?.abgelaufen ? t_('Test') : ''
  if (q.art === 'abo') return t_('aus dem Abo von {0} bis {1}', [q.teamLabel, q.bis])
  if (q.art === 'schluessel') return t_('aus einem Schlüssel von {0} bis {1}', [q.teamLabel, q.bis])
  if (q.art === 'test') return t_('Test')
  return t_('aus der Lizenz')
})
/// Die Schlüssel des oben gewählten Teams, die heute gelten
const schluessel = computed(() => (lic.value?.schluessel ?? []).filter(k => !props.team || k.team === props.team.key))
/// Warum ein Abo nicht gilt: entzogen (der Lizenzserver sagt es) oder abgelaufen
const aboGrund = a => a.geprueft === false ? t_('ungeprüft') : a.status === 'entzogen' ? t_('entzogen') : t_('abgelaufen')
const knopf = computed(() =>
  was.value === 'abo' ? { text: t_('⚿ Abo verbinden · {0}', [props.team?.label ?? '']), aus: !eigenes.value || !lic.value?.lizenzserver,
      title: !lic.value?.lizenzserver ? t_('Kein Lizenzserver eingestellt') : eigenes.value ? t_('Abo für {0} verbinden', [props.team.label]) : t_('{0} rechnet über ein anderes Team ab', [props.team?.label ?? t_('Dieses Team')]) }
  : was.value === 'schluessel' ? { text: t_('⚿ Einlösen · {0}', [props.team?.label ?? '']), aus: !eigenes.value,
      title: eigenes.value ? t_('Schlüssel für {0} einlösen', [props.team.label]) : t_('{0} rechnet über ein anderes Team ab', [props.team?.label ?? t_('Dieses Team')]) }
  : { text: t_('⚿ Übernehmen'), aus: true, title: eingabe.value.trim() ? t_('kein Schlüssel') : t_('Schlüssel aus dem Shop oder zum Kopieren einfügen') })
const uebernehmen = () => was.value === 'abo' ? verbinden() : was.value === 'schluessel' ? einloesen() : null

/// Den Stand des Abos sofort neu holen — mit dem Shop-Schlüssel, den der Server sich gemerkt hat, oder ohne (dann hat
/// ihn der Lizenzserver aus dem Kauf). Gilt für das oben gewählte Team, auch wenn es noch keinen Stand hat.
const standTeam = computed(() => props.team?.key ?? aboTeam.value?.team ?? null)
async function auffrischen() {
  if (!standTeam.value) return
  try {
    const r = await api.post(`/api/licence/abo/${encodeURIComponent(standTeam.value)}/auffrischen`, {})
    said.value = t_('✓ Abo {0} · gültig bis {1}', [r.planLabel, r.paidUntil])
    await load(); await store.poll(true)
    emit('eingespielt')
  }
  catch (e) { said.value = '✗ ' + e.message }
}

/// Abo verbinden: der Server fragt den Lizenzserver und legt den bestätigten Stand ins Journal des Teams
async function verbinden() {
  if (!aboKey.value || !eigenes.value) return
  try {
    const r = await api.post('/api/licence/abo', { team: props.team.key, key: aboKey.value })
    eingabe.value = ''
    said.value = t_('✓ Abo {0} · gültig bis {1}', [r.planLabel, r.paidUntil]) + (r.geprueft ? '' : ' · ' + t_('ungeprüft'))
    await load(); await store.poll(true)
    emit('eingespielt')
  }
  catch (e) { said.value = '✗ ' + e.message }
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

/// Die Kennung dieser Instanz kopieren — ohne Zwischenablage bleibt sie markierbar stehen
async function kopiere(text) {
  try { await navigator.clipboard.writeText(text); store.toast('kopiert', 'ok') }
  catch { store.toast(t_('Zwischenablage nicht verfügbar — Text markieren und mit Strg+C kopieren')) }
}
</script>

<style scoped>
/* Eine Aktion des Shops: grün, weil sie etwas gibt. Ein Kasten je Aktion, darin Wirkung, Code und die beiden Knöpfe. */
.aktion { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 6px 10px; max-width: 640px;
  border: 1px solid var(--pos); border-radius: 6px; background: color-mix(in srgb, var(--pos) 12%, var(--pane)); }
.aktion .wirkung { flex: 1; }
.aktion .code { font-family: var(--mono, monospace); font-weight: 600; letter-spacing: .04em; }
.aktion .bis { font-size: 12px; white-space: nowrap; }
</style>

<template>
  <div class="section">
    <h2>{{ $t("⚿ journali Lizenz") }}</h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:170px" /><col style="width:200px" /><col /></colgroup><tbody>
      <!-- Eine Instanz hat keine Lizenz — jede gehört einem Team (25.09.2026): Abo und Schlüssel stehen beim Team. Übrig bleibt
           der Test einer neuen Instanz; er gehört zum Init Team und steht nur dort, solange er läuft. -->
      <tr v-if="lic?.instanzTarif" class="tarif"><td class="muted" :title="$t('Der höchste Tarif der Instanz: nach ihm richten sich Plugins und Publikationsbäume.')">{{ $t("◆ Tarif") }}</td>
        <td>{{ lic.instanzTarif.label }}<span v-if="herkunft" class="muted herkunft">{{ ' · ' + herkunft }}</span></td><td></td></tr>
      <tr v-if="aboTeam" class="abo"><td class="muted" :title="$t('Stand des Abos vom Lizenzserver, täglich aufgefrischt')">{{ $t("◆ Abo · {0}", [aboTeam.teamLabel]) }}</td>
        <td :title="$t('zuletzt bestätigt {0}', [String(aboTeam.issued).slice(0, 16).replace('T', ' ')])">
          <template v-if="aboTeam.gilt === false"><span class="neg abo-grund">{{ '✗ ' + aboGrund(aboTeam) }}</span><span class="muted">{{ ' · ' + $t('{0} bis {1}', [aboTeam.planLabel, aboTeam.paidUntil]) }}</span></template>
          <template v-else>{{ aboTeam.planLabel }}<span class="muted">{{ ' · ' + $t('gültig bis {0}', [aboTeam.paidUntil]) }}</span></template>
          <span v-if="!aboTeam.geprueft && aboTeam.gilt !== false" class="neg" :title="$t('Ohne passende Signatur zählt der Stand nicht.')">{{ ' · ' + $t('ungeprüft') }}</span></td>
        <td><button v-if="fuehrt && lic.lizenzserver && aboTeam.team === team?.key" class="x auffrischen" :title="$t('Stand vom Lizenzserver neu holen')" @click="auffrischen">↻</button></td></tr>
      <tr v-if="lic?.serverZusatz > 0" class="zusatz-server"><td class="muted" :title="$t('Gilt für die ganze Instanz, gleich über welches Team gekauft.')">{{ $t("◆ Zusatz Multi-Server") }}</td>
        <td>{{ $t('+{0} Server', [lic.serverZusatz]) }}<span class="muted">{{ ' · ' + $t('{0} erlaubt', [lic.erlaubteServer >= 2147483647 ? '∞' : lic.erlaubteServer]) }}</span></td><td></td></tr>
      <tr v-for="k in schluessel" :key="k.id" class="schluessel"><td class="muted" :title="$t('Eingelöster Schlüssel: er gibt dem Team Tarif und Grenzen bis zum genannten Tag.')">{{ $t("◆ Schlüssel · {0}", [k.teamLabel]) }}</td>
        <td :title="k.id"><span :class="{ muted: k.zaehlt === false }">{{ k.planLabel ?? $t('Grenzen') }}</span><span class="muted">{{ ' · ' + $t('{0} bis {1}', [k.from, k.until]) }}</span>
          <span v-if="k.zaehlt === false" class="muted zaehlt-nicht" :title="$t('Das Team hat einen Stand vom Lizenzserver; es gilt allein, was er sagt.')">{{ ' · ' + $t('zählt nicht') }}</span></td><td></td></tr>
      <tr v-if="lic?.trial && lic?.geprueft && team?.primary" class="test"><td class="muted" :title="$t('Test einer neuen Instanz, ab dem ersten Eintrag im Journal')">{{ $t("◆ Test · {0}", [team.label]) }}</td>
        <td>{{ lic.tarif?.label }}<span class="muted">{{ ' · ' + $t('gültig bis {0}', [lic.validUntil]) }}</span></td><td></td></tr>
      <tr v-if="lic?.instanzTarif" class="baeume"><td class="muted" :title="$t('Publikationsbäume: vorhanden / erlaubt')">{{ $t("▣ Publikationsbäume") }}</td>
        <td class="mono">{{ lic.pubTrees ?? 0 }} / {{ lic.instanzTarif.pubTrees ?? '∞' }}</td><td></td></tr>
      <tr v-if="!team || eigenes"><td class="muted" :title="$t('journali-Token je Woche: jede Pflege schreibt einen Eintrag ins Journal.')">{{ $t("▤ Token / Woche") }}</td><td class="mono woche" :title="$t('Kontingent von {0} · Lizenz der Instanz {1}', [team?.label ?? '', zahl(lic?.entriesWeek)])">{{ zahl(limits?.week ?? lic?.entriesWeek) }}</td><td></td></tr>
      <tr v-if="!team || eigenes"><td class="muted" :title="$t('journali-Token je Monat: jede Pflege schreibt einen Eintrag ins Journal.')">{{ $t("▦ Token / Monat") }}</td><td class="mono monat" :title="$t('Kontingent von {0} · Lizenz der Instanz {1}', [team?.label ?? '', zahl(lic?.entriesMonth)])">{{ zahl(limits?.month ?? lic?.entriesMonth) }}</td><td></td></tr>
      <tr v-if="lic?.countFrom"><td class="muted" :title="$t('Was vor diesem Tag im Journal steht, zählt nicht mehr mit.')">{{ $t("◷ gezählt ab") }}</td><td class="mono">{{ lic.countFrom }}</td><td></td></tr>
      <tr v-if="lic?.instanz" class="instanz"><td class="muted" :title="$t('Diese Instanz. Eine Lizenz wird auf diese Kennung ausgestellt und gilt nur hier.')">{{ $t("⌗ Instanz") }}</td>
        <td class="mono" style="user-select:all">{{ lic.instanz }}</td>
        <td><button class="x" :title="$t('Kennung kopieren')" @click="kopiere(lic.instanz)">⧉</button></td></tr>
      <tr v-if="darf() && lic?.lizenzserver" class="registrierung"><td class="muted" :title="$t('Registriert holt diese Anlage Tarife und Aktionen des Shops und nennt dabei ihre Kennung.')">{{ $t("⇄ Lizenzserver") }}</td>
        <td><button class="x" :class="lic.registriert ? 'pos' : 'muted'" :title="lic.registriert ? $t('Registrierung zurücknehmen') : $t('Diese Anlage registrieren')" @click="registrierung(!lic.registriert)">{{ lic.registriert ? $t("● registriert") : $t("○ nicht registriert") }}</button></td><td></td></tr>
    </tbody></table>

    <!-- Kontingent bestellen: Instanz und Team hängen am Buy-Link, der Kauf findet über den Lizenzserver zum Team zurück -->
    <div v-if="fuehrt && eigenes && kannBestellen && lic?.lizenzserver" class="bestellen row" style="gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap">
      <button class="primary bestellen-knopf" :title="$t('Shop öffnen — der Kauf gehört danach {0}', [team?.label ?? ''])" @click="bestellen()">{{ $t("⚿ Bestellen · {0}", [team?.label ?? '']) }}</button>
      <button v-if="!aboTeam" class="x holen" :title="$t('Stand vom Lizenzserver holen')" @click="auffrischen">↻</button>
      <span v-if="!darf()" class="said" :class="said.startsWith('✗') ? 'fehler' : 'muted'" style="font-size:12px">{{ said }}</span>
    </div>

    <!-- Die Aktionen des Shops: der Shop kennt keinen Streichpreis, nur Codes — die Wirkung steht hier, der Code daneben -->
    <div v-for="r in rabatte" :key="r.code" class="aktion" :title="r.bis ? $t('gültig bis {0}', [r.bis]) : ''">
      <span class="wirkung">{{ '✦ ' + r.text }}</span>
      <code class="code" style="user-select:all">{{ r.code }}</code>
      <button class="x kopieren" :title="$t('Rabattcode kopieren')" @click="kopiere(r.code)">⧉</button>
      <button v-if="fuehrt && eigenes && kannBestellen && lic?.lizenzserver" class="x mit-code" :title="$t('Shop mit diesem Code öffnen')" @click="bestellen(r)">⚿</button>
      <span v-if="r.bis" class="bis muted">{{ $t('bis {0}', [r.bis]) }}</span>
    </div>

    <div v-if="darf() && lic?.vonHand" class="hand" style="margin-top:12px">
      <button class="x von-hand" :title="$t('Schlüssel einfügen und Anforderungen — für eine Anlage ohne Verbindung zum Lizenzserver')" @click="vonHand = !vonHand">{{ (vonHand ? '● ' : '○ ') + $t("⚷ Von Hand") }}</button>
    </div>

    <div v-if="darf() && lic?.vonHand && vonHand" class="uebernahme" style="margin-top:8px">
      <textarea v-model="eingabe" class="eingabe" rows="4" style="width:100%;max-width:640px" :placeholder="$t('Schlüssel')"></textarea>
      <div class="row" style="gap:8px;margin-top:4px">
        <button class="primary" :disabled="knopf.aus" :title="knopf.title" @click="uebernehmen">{{ knopf.text }}</button>
        <span class="said" :class="said.startsWith('✗') ? 'fehler' : 'muted'" style="font-size:12px">{{ said }}</span>
      </div>
    </div>

    <!-- Was hier eingelöst wurde. Angefordert wird nichts mehr: der Support stellt den Schlüssel für diese Instanz aus -->
    <div v-if="darf() && lic?.vonHand && vonHand && einloesungen.length" class="schluessel" style="margin-top:16px">
      <h3>{{ $t("⚷ Schlüssel · {0}", [einloesungen.length]) }}</h3>
      <table class="grid eingeloest" style="width:auto"><thead><tr>
        <th>{{ $t("Id") }}</th><th>{{ $t("Art") }}</th><th>{{ $t("eingelöst") }}</th><th>{{ $t("Team") }}</th><th>{{ $t("gilt bis") }}</th>
      </tr></thead><tbody>
        <tr v-for="e in einloesungen" :key="e.id">
          <td class="mono">{{ e.id }}</td>
          <td>{{ art(e.kind) }} {{ e.kind === 'reset' ? $t('Reset') : $t('Limit') }}</td>
          <td class="mono pos">✓ {{ e.from }}</td>
          <td>{{ e.teamLabel ?? e.team }}</td>
          <td class="mono" :title="e.carried ? $t('+{0} Tage aus dem laufenden Limit', [e.carried]) : ''">{{ e.until ?? '' }}<template v-if="e.carried"> (+{{ e.carried }})</template></td>
        </tr>
      </tbody></table>
    </div>
  </div>
</template>
