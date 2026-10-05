<script setup>
// Die Teamseite. Ein Team ist eine Gruppe von
// Personen, die am Gesamtsystem mitarbeitet — hier steht, wer dazugehört, womit die Gruppe arbeitet und was sie verbraucht.
// Teams anlegen und entfernen gehört nicht hierher, sondern zu den Personen (👤 Anwender & Rollen).
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { ai } from '../ai.js'
import UsageBars from './UsageBars.vue'
import LicenceSettings from './LicenceSettings.vue'
import { t as t_ } from '../i18n.js'

const teams = ref([])
const gewaehlt = ref(null)     // gezeigtes Team; mit „users“ lässt sich wechseln
const mitglieder = ref([])
const eingabe = ref({ anthropic: '', openai: '', lokal: '' })   // je Anbieter das Feld für Schlüssel oder Adresse
// das lokale Modell (29.09.2026): gibt es eines am Server, steht es jedem Team zur Wahl — ohne Schlüssel, ohne Kosten
const lokal = ref({ ready: false, models: [] })
/// Wer gefragt werden kann, in der Reihenfolge des Servers: die Anbieter mit Schlüssel, danach das lokale Modell
const hat = k => (team.value?.keys ?? []).includes(k)
const nutzbar = k => k === 'lokal' ? hat('lokal') || lokal.value.ready : hat(k)
const anbieterListe = computed(() => [...(team.value?.keys ?? []).filter(k => k !== 'lokal'), ...(nutzbar('lokal') ? ['lokal'] : [])])
const anbieterGewaehlt = computed(() => { const w = team.value?.models?.['*']; return anbieterListe.value.includes(w) ? w : anbieterListe.value[0] ?? '' })
const frei = ref([])           // wer in keinem Team ist — nur die lassen sich eintragen
const dazu = ref('')
const MODELLE = {
  anthropic: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-haiku-4-5'],
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
}
const jt = ref(null)   // journali-Token dieses Teams: Limits und Verbrauch
const tage = ref([])   // KI-Austauschvolumen je Tag — was journali hingeschickt und zurückbekommen hat
const kb = b => {
  const z = (x, e) => (x / e).toLocaleString('de-DE', { maximumFractionDigits: 1 })
  return !b ? '0kb' : b >= 1073741824 ? z(b, 1073741824) + 'gb' : b >= 1048576 ? z(b, 1048576) + 'mb' : Math.max(1, Math.round(b / 1024)) + 'kb'
}
// lokal: statt eines Schlüssels steht die Adresse des Dienstes mit der Ollama-Schnittstelle (der Server prüft http:// oder https://)
const ANBIETER = [['anthropic', t_('Anthropic')], ['openai', t_('OpenAI')], ['lokal', t_('lokal')]]

const team = computed(() => teams.value.find(t => t.key === gewaehlt.value) ?? null)
const meinTeam = computed(() => teams.value.find(t => t.key === store.auth?.team) ?? null)
/// Das Team führen: Schlüssel, Modell, Mitglieder ein und aus. Der Administrator darf es überall.
const fuehrt = computed(() => store.can('users') || (store.can('team') && (team.value?.managers ?? []).includes(store.auth.user)))
/// Wessen Schlüssel das Team benutzt — eigener oder der eines anderen Teams
const lizenz = ref(null)
const zahl = n => n >= 2147483647 ? '∞' : (n ?? 0).toLocaleString('de-DE')   // Unlimited: keine Grenze
/// Anteil am Limit — 0 heisst: nichts zugeteilt, dann gibt es auch keinen Anteil
/// Was UsageBars zeigt: die Zahlen dieses Teams gegen seine Limits — nicht die der ganzen Anlage
const teamUsage = computed(() => jt.value && {
  week: { used: jt.value.used?.week ?? 0, max: jt.value.limits?.week ?? 0, resetAt: jt.value.resetWeek },
  month: { used: jt.value.used?.month ?? 0, max: jt.value.limits?.month ?? 0, resetAt: jt.value.resetMonth },
  day: { used: jt.value.used?.day ?? 0 },
  today: jt.value.today,
  head: jt.value.head,
})
const zeitraum = ref('day')      // Verlauf des Teams: Tag, Woche oder Monat
const verlaufBusy = ref(false)
async function ladeVerlauf(p = zeitraum.value) {
  zeitraum.value = p
  const k = gewaehlt.value; if (!k) return
  verlaufBusy.value = true
  try { jt.value = await api.get(`/api/teams/${encodeURIComponent(k)}/tokens/journali?history=${p}&limit=30`) } catch {}
  finally { verlaufBusy.value = false }
}

/// Was noch zur Verfügung steht — nie unter 0
const rest = zeitraum => (jt.value?.limits?.[zeitraum] ?? 0) >= 2147483647 ? 2147483647 : Math.max(0, (jt.value?.limits?.[zeitraum] ?? 0) - (jt.value?.used?.[zeitraum] ?? 0))
/// Viel verfügbar ist grün; wird es knapp, gelb; ist nichts mehr da, rot
const freiTon = zeitraum => {
  const grenze = jt.value?.limits?.[zeitraum] ?? 0
  if (!grenze) return 'muted'
  const anteil = Math.round((rest(zeitraum) / grenze) * 100)
  return anteil <= 10 ? 'neg' : anteil <= 30 ? 'warn' : 'pos'
}

/// Das lokale Modell des gezeigten Teams: an seiner Adresse, sonst an der des Servers
async function lokalLaden() {
  try { const l = await api.get(`/api/ai/lokal/models${gewaehlt.value ? '?team=' + encodeURIComponent(gewaehlt.value) : ''}`); lokal.value = { ready: !!l?.ready, models: l?.models ?? [] } } catch { lokal.value = { ready: false, models: [] } }
}
async function load() {
  try {
    teams.value = await api.get('/api/teams')
    // Die Seite beginnt beim eigenen Team: gefragt wird über das Team der Mitgliedschaft, und nur dessen Wahl (aktiv, Modell) zählt für die eigenen Fragen
    if (!teams.value.some(t => t.key === gewaehlt.value)) gewaehlt.value = teams.value.find(t => t.key === store.auth?.team)?.key ?? teams.value[0]?.key ?? null
    await lokalLaden()
    await details()
  } catch (e) { store.toast(e.message) }
}
async function wechsel() { await lokalLaden(); await details() }
async function details() {
  const k = gewaehlt.value; if (!k) return
  const p = encodeURIComponent(k)
  try { mitglieder.value = await api.get(`/api/teams/${p}/members`) } catch { mitglieder.value = [] }
  try { frei.value = await api.get('/api/teams/free') } catch { frei.value = [] }
  try { lizenz.value = await api.get('/api/licence') } catch { lizenz.value = null }
  try { jt.value = await api.get(`/api/teams/${p}/tokens/journali?history=${zeitraum.value}&limit=30`) } catch { jt.value = null }
  try { tage.value = (await api.get(`/api/teams/${p}/usage?days=14`)).days ?? [] } catch { tage.value = [] }
}
onMounted(load)
// Ein neuer Journalstand kann von hier kommen oder von einem anderen Anwender — auch von einem anderen Server
// (26.09.2026: Teams, die woanders geändert wurden, standen hier veraltet). Nicht nachladen, solange jemand tippt:
// sonst verschwindet die halbe Eingabe unter den Fingern.
watch(() => store.head, () => {
  if (document.activeElement?.closest?.('.section')?.querySelector('input:focus, select:focus, textarea:focus')) return
  load()
})

async function schluessel(anbieter) {
  const wert = (eingabe.value[anbieter] ?? '').trim()
  if (!wert) { store.toast(anbieter === 'lokal' ? t_('Adresse fehlt') : t_('Schlüssel fehlt')); return }
  try {
    await api.post(`/api/teams/${encodeURIComponent(gewaehlt.value)}/keys`, { keys: { [anbieter]: wert } }, 'PUT')
    eingabe.value[anbieter] = ''
    await load(); store.toast(anbieter === 'lokal' ? t_('Adresse für das lokale Modell liegt beim Server') : t_('Schlüssel für {0} liegt beim Server', [anbieter]), 'ok')
  } catch (e) { store.toast(e.message) }
}
async function schluesselWeg(anbieter) {
  if (!await dialog.confirm({ title: t_('Schlüssel {0} entfernen?', [anbieter]), text: t_('Ohne ihn arbeitet „{0}“ nicht mehr über diesen Anbieter.', [team.value.label]), ok: t_('✕ Entfernen') })) return
  try { await api.post(`/api/teams/${encodeURIComponent(gewaehlt.value)}/keys`, { keys: { [anbieter]: '' } }, 'PUT'); await load() } catch (e) { store.toast(e.message) }
}
/// Die Modelle zur Wahl: die Liste des Anbieters, und der gesetzte Wert, auch wenn die Liste ihn nicht (mehr) führt
const modelle = k => {
  const liste = k === 'lokal' ? lokal.value.models : (MODELLE[k] ?? [])
  const jetzt = team.value?.models?.[k]
  return jetzt && !liste.includes(jetzt) ? [jetzt, ...liste] : liste
}
async function modell(anbieter, wert) {
  try { await api.post(`/api/teams/${encodeURIComponent(gewaehlt.value)}`, { models: { [anbieter]: wert } }, 'PUT'); await load(); ai.loadState() } catch (e) { store.toast(e.message) }
}
/// Was gezählt wird — die Vorgänge hinter Kinds.Counts im Kern (data, publish). Über Nichtgezähltes steht hier nichts.
function hilfeToken() {
  dialog.help({
    title: t_('✦ journali Limits · gezählt wird'),
    rows: [
      [t_('Anlegen'), t_('Artikel, Varianten, Zeilen einer Mehrfachangabe, Assets, Relationen')],
      [t_('Benennen'), t_('einem Knoten einen Namen geben oder ihn ändern')],
      [t_('Ändern'), t_('jeder Wert, Status, Kennung, die Reihenfolge von Zeilen')],
      [t_('Zurückziehen'), t_('Artikel, Zeilen, Assets, Relationen — und das Zurückholen')],
      [t_('Einordnen'), t_('ein Asset in einen Ordner, eine Kennung an ein Fremdsystem')],
      [t_('Übernehmen'), t_('Import und Kopieren schreiben dieselben Einträge wie Handarbeit')],
      [t_('Freigeben'), t_('eine Freigabe erteilen, eine Freigabe zurücknehmen')],
      [t_('Versionieren'), t_('Version anlegen, Dokument anhängen, Version zurückziehen')],
      [t_('Workflow'), t_('einen Schritt setzen, eine Zuständigkeit vergeben')],
      [t_('Übersetzen'), t_('Auftrag hinaus, Rückläufer herein, Stand am Knoten markieren')],
    ],
  })
}

async function eintragen() {
  if (!dazu.value) return
  try { await api.post(`/api/teams/${encodeURIComponent(gewaehlt.value)}/members/${encodeURIComponent(dazu.value)}`, {}); dazu.value = ''; await details() }
  catch (e) { store.toast(e.message) }
}
async function austragen(m) {
  if (!await dialog.confirm({ title: `${m.name || m.key} austragen?`, text: t_('Danach ist die Person in keinem Team — ohne Schlüssel, ohne Kontingent.'), ok: t_('✕ Austragen') })) return
  try { await api.del(`/api/teams/${encodeURIComponent(gewaehlt.value)}/members/${encodeURIComponent(m.key)}`); await details() } catch (e) { store.toast(e.message) }
}
</script>

<template>
  <div v-if="!team" class="section muted">{{ $t("kein Team") }}</div>
  <template v-else>
    <div class="section">
      <h2>◍ {{ team.label }}
        <span class="muted">· {{ mitglieder.length }}<span v-if="team.primary" class="accent" :title="store.startphase ? $t('Init Team: bleibt') : $t('Init Team: bleibt, trägt die Limits der Lizenz')"> ①</span></span>
        <select v-if="teams.length > 1" v-model="gewaehlt" style="margin-left:8px" @change="wechsel">
          <option v-for="t in teams" :key="t.key" :value="t.key">{{ t.label }}</option>
        </select>
      </h2>
      <table class="grid" style="width:auto">
        <thead><tr><th>{{ $t("Person") }}</th><th>{{ $t("Rolle") }}</th><th>{{ $t("zuletzt") }}</th><th></th></tr></thead>
        <tbody>
          <tr v-for="m in mitglieder" :key="m.key" class="row">
            <td>{{ m.name || m.key }} <span class="mono muted" style="font-size:12px">{{ m.key }}</span>
              <span v-if="(team.managers ?? []).includes(m.key)" class="accent" :title="$t('führt dieses Team')">★</span>
              <span v-if="!m.enabled" class="neg" :title="$t('gesperrt')">⊘</span></td>
            <td class="muted">{{ m.role }}</td>
            <td class="muted">{{ m.lastAt ? new Date(m.lastAt).toLocaleDateString() : '' }}</td>
            <td><button v-if="fuehrt && !(team.managers ?? []).includes(m.key)" class="x" :title="$t('aus dem Team austragen')" @click="austragen(m)">✕</button></td>
          </tr>
          <tr v-if="!mitglieder.length"><td colspan="4" class="muted">{{ $t("niemand") }}</td></tr>
          <tr v-if="fuehrt">
            <td colspan="4" class="row" style="gap:6px">
              <select v-model="dazu" style="width:200px" :title="$t('Eintragen lässt sich nur, wer in keinem Team ist')">
                <option value="">—</option>
                <option v-for="f in frei" :key="f.key" :value="f.key">{{ f.name || f.key }} · {{ f.role }}</option>
              </select>
              <button class="x" :title="$t('in das Team eintragen')" :disabled="!dazu" @click="eintragen">+</button>
              <span v-if="!frei.length" class="muted" style="font-size:12px" :title="$t('Wer wechseln soll, wird erst in seinem Team ausgetragen')">{{ $t("niemand teamlos") }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>


    <!-- Startphase: keine Lizenz, keine Limits (05.10.2026) -->
    <LicenceSettings v-if="!store.startphase" :team="team" :limits="jt?.limits" @eingespielt="details" />

    <div v-if="!store.startphase" class="section limits">
      <h2>{{ $t("✦ journali Limits") + ' ' }}<button class="x" :title="$t('Was gezählt wird')" @click="hilfeToken">?</button>
      </h2>
      <table class="grid form" style="width:auto"><colgroup><col style="width:150px" /><col style="width:320px" /><col /></colgroup><tbody>
        <tr>
          <td class="muted" :title="$t('Was diesem Team in diesem Zeitraum noch zur Verfügung steht')">{{ $t("Verfügbar") }}</td>
          <td class="mono">
            <span :class="freiTon('week')">{{ $t("▤ {0} / Woche", [zahl(rest('week'))]) }}</span> ·
            <span :class="freiTon('month')">{{ $t("▦ {0} / Monat", [zahl(rest('month'))]) }}</span>
          </td>
          <td class="muted" style="font-size:12px"><span v-if="!jt?.limits?.week && !jt?.limits?.month">{{ $t("kein eigenes Kontingent") }}</span></td>
        </tr>
        <tr>
          <td class="muted" :title="$t('Das Kontingent dieses Teams — der Administrator trägt es aus der Lizenz ein')">{{ $t("Kontingent") }}</td>
          <td class="mono muted">{{ ' ' + $t("▤ {0} / Woche · ▦ {1} / Monat", [zahl(jt?.limits?.week), zahl(jt?.limits?.month)]) + ' ' }}</td>
          <td class="muted" style="font-size:12px">
            <span v-if="jt && jt.payer !== jt.team">{{ $t("gemeinsam mit {0} · eigener Anteil ▦ {1}", [jt.payerLabel, zahl(jt.mine?.month)]) }}</span>
          </td>
        </tr>
        <tr>
          <td class="muted" :title="$t('Was die Mitglieder in diesem Zeitraum geschrieben haben')">{{ $t("Genutzt") }}</td>
          <td class="mono muted">
            ▤ {{ zahl(jt?.used?.week) }} · ▦ {{ zahl(jt?.used?.month) }}
          </td>
          <td></td>
        </tr>
      </tbody></table>
      <UsageBars v-if="jt" :usage="teamUsage" :history="jt.history ?? []" :period="zeitraum" :busy="verlaufBusy" @period="ladeVerlauf" />
    </div>

    <div class="section">
      <h2 :title="$t('Schlüssel und Modell dieses Teams; der Schlüssel bleibt beim Server.')">{{ $t("✧ KI API Keys") }}</h2>
      <table class="grid form ki-anbieter" style="width:auto"><thead><tr class="muted">
        <th style="width:90px" :title="$t('welchen Anbieter die Plugins fragen')">{{ $t("Wird gefragt") }}</th>
        <th style="width:90px">{{ $t("Anbieter") }}</th>
        <th style="width:330px" :title="$t('Schlüssel oder Adresse; sie bleiben beim Server, nie im Journal, nie im Browser')">{{ $t("Zugang") }}</th>
        <th style="width:240px" :title="$t('welches Modell der Anbieter fragt — es bestimmt Kosten und Güte')">{{ $t("Modell") }}</th>
      </tr></thead><tbody>
        <tr v-for="[k, name] in ANBIETER" :key="k" :class="k">
          <td>
            <button class="x schalter" :class="{ primary: anbieterGewaehlt === k && nutzbar(k) }" :disabled="!fuehrt || !nutzbar(k)" :title="$t('{0} fragen (die Plugins nehmen diesen Anbieter)', [name])" @click="modell('*', k)">{{ anbieterGewaehlt === k && nutzbar(k) ? $t("● aktiv") : $t("○ inaktiv") }}</button>
          </td>
          <td>{{ name }}</td>
          <td class="row" style="gap:4px">
            <template v-if="hat(k)">
              <span class="pos" :title="k === 'lokal' ? $t('Adresse hinterlegt') : $t('Schlüssel hinterlegt')">{{ $t("✓ hinterlegt") }}</span>
              <button v-if="fuehrt" class="x" :title="k === 'lokal' ? $t('Adresse entfernen') : $t('Schlüssel entfernen')" @click="schluesselWeg(k)">×</button>
            </template>
            <template v-else-if="fuehrt">
              <input v-model="eingabe[k]" :type="k === 'lokal' ? 'text' : 'password'" :placeholder="k === 'lokal' ? 'http://localhost:11434' : $t('Schlüssel')" style="width:190px" @keydown.enter="schluessel(k)" />
              <button class="x" :disabled="!eingabe[k]" :title="k === 'lokal' ? $t('Adresse hinterlegen (sie bleibt beim Server, nie im Journal, nie im Browser)') : $t('Schlüssel hinterlegen (er bleibt beim Server, nie im Journal, nie im Browser)')" @click="schluessel(k)">⚿</button>
            </template>
            <span v-else class="muted">—</span>
            <span v-if="k === 'lokal' && !hat('lokal') && lokal.ready" class="muted" :title="$t('Adresse aus der Umgebung des Servers')">{{ $t("Server") }}</span>
            <span v-if="k === 'lokal' && nutzbar('lokal')" :class="lokal.models.length ? 'muted' : 'fehler'" :title="lokal.models.length ? $t('Modelle des Dienstes') : $t('Dienst antwortet nicht')">{{ lokal.models.length ? $t("{0} Modelle", [lokal.models.length]) : $t("✗ nicht erreichbar") }}</span>
          </td>
          <td>
            <select v-if="nutzbar(k)" :value="team.models?.[k] ?? ''" :disabled="!fuehrt" style="width:220px" @change="modell(k, $event.target.value)">
              <option value="">{{ $t("— Vorgabe —") }}</option>
              <option v-for="m in modelle(k)" :key="m" :value="m">{{ m }}</option>
            </select>
            <span v-else class="muted">—</span>
          </td>
        </tr>
        <tr v-if="meinTeam && meinTeam.key !== team.key">
          <td class="muted" colspan="2" :title="$t('Gefragt wird über das Team deiner Mitgliedschaft; die Wahl hier gilt für dessen Mitglieder')">{{ $t("Dein Team") }}</td>
          <td colspan="2" class="warn">{{ meinTeam.label }}</td>
        </tr>
        <tr>
          <td class="muted" colspan="2" :title="$t('Wessen Schlüssel dieses Team benutzt')">{{ $t("Schlüssel von") }}</td>
          <td colspan="2">
            <span v-if="team.keys.length" class="pos">{{ $t("diesem Team") }}</span>
            <span v-else-if="team.keysFrom" class="muted">{{ $t("Team {0}", [team.keysFrom]) }}</span>
            <span v-else class="neg">{{ $t("keiner hinterlegt") }}</span>
          </td>
        </tr>
      </tbody></table>
    </div>

    <div class="section">
      <h2 :title="$t('Was journali an den Anbieter geschickt und von ihm zurückbekommen hat; über Tokens und Kosten sagt journali nichts.')">{{ $t("✧ KI Austauschvolumen") }}</h2>
      <table v-if="tage.length" class="grid" style="width:auto"><thead><tr><th style="width:110px">{{ $t("Tag") }}</th><th class="num" style="width:70px">{{ $t("Aufrufe") }}</th><th class="num" style="width:90px" :title="$t('hingeschickt')">{{ $t("↑ hin") }}</th><th class="num" style="width:90px" :title="$t('zurückbekommen')">{{ $t("↓ zurück") }}</th><th class="num" style="width:90px">Σ</th><th>{{ $t("Anlass") }}</th></tr></thead><tbody>
        <tr v-for="t in tage" :key="t.day" class="row">
          <td class="mono">{{ t.day }}</td>
          <td class="num mono">{{ t.calls }}</td>
          <td class="num mono">{{ kb(t.bytesIn) }}</td>
          <td class="num mono">{{ kb(t.bytesOut) }}</td>
          <td class="num mono">{{ kb(t.bytes) }}</td>
          <td class="muted" style="font-size:12px">{{ Object.entries(t.byPurpose ?? {}).map(([a, v]) => `${a} ${kb(v)}`).join(' · ') }}</td>
        </tr>
      </tbody></table>
      <div v-else class="muted" style="font-size:12px">{{ $t("noch nichts gemessen") }}</div>
    </div>
  </template>
</template>
