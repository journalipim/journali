<script setup>
// Die Lizenz (Taloan, 23.09.2026: „die Grenzen setzt der Lizenzkey“). Sie wird nicht gepflegt, sondern eingespielt —
// darum eine Datei, kein Stammdatum. Was sie sagt, gilt für die ganze Anlage: Einträge je Woche und Monat, das
// Was ein Team an KI verbraucht, geht an seinen Anbieter — journali lizenziert das nicht (Taloan, 23.09.2026).
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'

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

// Schlüssel (Taloan, 23.09.2026): die Instanz fordert an und signiert, der Shop gibt frei, der Aussteller stellt aus —
// eingelöst wird nur, was hier angefordert wurde. Auf Vorrat und ohne Team; das Team wählt die IT beim Einlösen.
const anforderungen = ref([])
const einloesungen = ref([])
const pakete = ref([])
const neu = ref({ wahl: 'reset', count: 1 })   // wahl: 'reset' oder der Schlüssel eines Pakets
const paketTitel = p => `${zahl(p.week)} / Woche · ${zahl(p.month)} / Monat · ${p.days} Tage`
const paketName = k => pakete.value.find(p => p.key === k)?.label ?? k
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
const was = computed(() => !inhalt.value ? null : inhalt.value.o.kind && inhalt.value.o.request ? 'schluessel' : inhalt.value.o.anforderung ? null : 'lizenz')
const knopf = computed(() =>
  was.value === 'schluessel' ? { text: `⚿ Einlösen · ${props.team?.label ?? ''}`, aus: !eigenes.value,
      title: eigenes.value ? `Schlüssel für ${props.team.label} einlösen` : `${props.team?.label ?? 'Dieses Team'} rechnet über ein anderes Team ab` }
  : was.value === 'lizenz' ? { text: '⚿ Lizenz einspielen', aus: false, title: 'Lizenz dieser Instanz ersetzen' }
  : { text: '⚿ Übernehmen', aus: true, title: eingabe.value.trim() ? 'weder Lizenz noch Schlüssel' : 'Lizenz oder Schlüssel einfügen' })
const uebernehmen = () => was.value === 'schluessel' ? einloesen() : was.value === 'lizenz' ? einspielen() : null

async function anfordern() {
  try {
    const { wahl, count } = neu.value
    const r = await api.post('/api/licence/requests', wahl === 'reset' ? { kind: 'reset', count } : { kind: 'limit', plan: wahl, count })
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
    said.value = (r.until ? `✓ ${r.id} bis ${r.until}` : `✓ ${r.id} ab ${r.from}`) + (r.carried ? ` · +${r.carried} Tage` : '') + (r.geprueft ? '' : ` · ${r.grund ?? ''}`)
    await load(); await store.poll(true)
    emit('eingespielt')
  }
  catch (e) { said.value = '✗ ' + e.message }
}
const art = k => k === 'reset' ? '↺' : '⇡'
const zahl = n => (n ?? 0).toLocaleString('de-DE')

async function einspielen() {
  if (!inhalt.value) return
  try {
    const r = await api.post('/api/licence', inhalt.value.o, 'PUT')
    eingabe.value = ''
    said.value = r.geprueft ? '✓ eingespielt und geprüft' : `✓ eingespielt · ${r.grund ?? ''}`
    await load(); await store.poll(true)
    emit('eingespielt')   // die Limits daneben hängen an der Lizenz — sie sollen es sofort zeigen
  }
  catch (e) { said.value = '✗ ' + e.message }
}

/// Die Kennung dieser Instanz kopieren — ohne Zwischenablage bleibt sie markierbar stehen
async function kopiere(text) {
  try { await navigator.clipboard.writeText(text); store.toast('kopiert', 'ok') }
  catch { store.toast('Zwischenablage nicht verfügbar — Text markieren und mit Strg+C kopieren') }
}
</script>

<template>
  <div class="section">
    <h2>⚿ journali Lizenz <span v-if="lic?.holder" class="muted">· {{ lic.holder }}</span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:170px" /><col style="width:200px" /><col /></colgroup><tbody>
      <tr>
        <td class="muted">Stand</td>
        <td>
          <span v-if="lic?.abgelaufen" class="neg">● abgelaufen</span>
          <span v-else-if="lic?.geprueft" class="pos">● geprüft</span>
          <span v-else class="warn">● ungeprüft</span>
        </td>
        <td class="muted">{{ lic?.grund ?? '' }}</td>
      </tr>
      <tr v-if="lic?.validUntil"><td class="muted">gültig bis</td><td class="mono">{{ lic.validUntil }}</td><td></td></tr>
      <tr><td class="muted" title="journali-Token je Woche: jede Pflege schreibt einen Eintrag ins Journal.">▤ Token / Woche</td><td class="mono">{{ zahl(lic?.entriesWeek) }}</td><td></td></tr>
      <tr><td class="muted" title="journali-Token je Monat: jede Pflege schreibt einen Eintrag ins Journal.">▦ Token / Monat</td><td class="mono">{{ zahl(lic?.entriesMonth) }}</td><td></td></tr>
      <tr v-if="lic?.countFrom"><td class="muted" title="Was vor diesem Tag im Journal steht, zählt nicht mehr mit.">◷ gezählt ab</td><td class="mono">{{ lic.countFrom }}</td><td></td></tr>
      <tr v-if="lic?.instanz"><td class="muted" title="Diese Instanz. Eine Lizenz wird auf diese Kennung ausgestellt und gilt nur hier.">⌗ Instanz</td>
        <td class="mono" style="user-select:all">{{ lic.instanz }}</td>
        <td><button class="x" title="Kennung kopieren" @click="kopiere(lic.instanz)">⧉</button></td></tr>
    </tbody></table>

    <div v-if="darf()" class="uebernahme" style="margin-top:8px">
      <textarea v-model="eingabe" class="eingabe" rows="4" style="width:100%;max-width:640px" placeholder="Lizenz oder Schlüssel"></textarea>
      <div class="row" style="gap:8px;margin-top:4px">
        <button class="primary" :disabled="knopf.aus" :title="knopf.title" @click="uebernehmen">{{ knopf.text }}</button>
        <span class="said" :class="said.startsWith('✗') ? 'fehler' : 'muted'" style="font-size:12px">{{ said }}</span>
      </div>
    </div>

    <div v-if="darf()" class="schluessel" style="margin-top:16px">
      <h3>⚷ Schlüssel</h3>
      <div class="row anfordern" style="gap:6px;flex-wrap:wrap;align-items:center">
        <select v-model="neu.wahl" class="wahl">
          <option value="reset" title="Das Team zählt ab dem Einlösen neu.">↺ Reset</option>
          <option v-for="p in pakete" :key="p.key" :value="p.key">⇡ {{ p.label }} · {{ paketTitel(p) }}</option>
        </select>
        <select v-model.number="neu.count" class="anzahl" title="Anzahl Anforderungen">
          <option v-for="n in [1, 2, 5, 10]" :key="n" :value="n">× {{ n }}</option>
        </select>
        <button @click="anfordern" title="Anforderung erstellen und mit dem Schlüssel dieser Instanz signieren">⚷ Anfordern</button>
        <span class="said-anf" :class="saidAnf.startsWith('✗') ? 'fehler' : 'muted'" style="font-size:12px">{{ saidAnf }}</span>
      </div>
      <div v-if="angefordert" class="row" style="gap:6px;margin-top:4px;align-items:flex-start">
        <textarea class="angefordert mono" readonly rows="3" style="width:100%;max-width:640px" :value="angefordert"></textarea>
        <button class="x" title="Anforderung kopieren" @click="kopiere(angefordert)">⧉</button>
      </div>

      <table v-if="anforderungen.length" class="grid anforderungen" style="width:auto;margin-top:8px"><thead><tr>
        <th>Id</th><th>Art</th><th>angefordert</th><th>eingelöst</th><th>Team</th><th>gilt bis</th><th></th>
      </tr></thead><tbody>
        <tr v-for="a in anforderungen" :key="a.id">
          <td class="mono">{{ a.id }}</td>
          <td :title="a.kind === 'limit' ? paketTitel(a) : 'Das Team zählt ab dem Einlösen neu.'">{{ art(a.kind) }} {{ a.plan ? paketName(a.plan) : a.kind === 'reset' ? 'Reset' : 'Limit' }}</td>
          <td class="mono">{{ String(a.created).slice(0, 10) }}</td>
          <template v-if="a.team">
            <td class="mono pos">✓ {{ einloesung(a.id)?.from ?? '' }}</td>
            <td>{{ a.teamLabel }}</td>
            <td class="mono" :title="einloesung(a.id)?.carried ? `+${einloesung(a.id).carried} Tage aus dem laufenden Limit` : ''">{{ einloesung(a.id)?.until ?? '' }}<template v-if="einloesung(a.id)?.carried"> (+{{ einloesung(a.id).carried }})</template></td>
            <td></td>
          </template>
          <template v-else>
            <td class="muted">● offen</td><td></td><td></td>
            <td><button class="x" title="Anforderung kopieren" @click="kopiere(a.text)">⧉</button></td>
          </template>
        </tr>
      </tbody></table>

    </div>
  </div>
</template>
