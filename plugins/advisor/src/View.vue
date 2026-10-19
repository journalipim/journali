<script setup>
// ⇪ Export → Produktberatung (docs/pflegestruktur.md 42, 08.10.2026): die Berater dieser Instanz. Ein Berater ist ein Publikationsbaum, eine Rolle,
// eine Sicht und ein paar Grenzen — als Plugin-Daten def:<schlüssel> im Journal. Hier wird er angelegt, sein Dienst bekommt ein Token, und die
// Vorschau stellt dieselbe Frage wie ein Besucher: an den Kern als Kindprozess von journali (POST /api/advisor/<schlüssel>/preview, mit dem Recht
// Plugins statt des Tokens) — dieselbe Abwägung wie im Dienst, mit Gedächtnis je Gespräch (09.10.2026, pflegestruktur 44).
import { ref, computed, onMounted } from 'vue'
import { api, store, dialog, L, t, beraterStarten } from 'journali'

const KEY = /^[a-z][a-z0-9_-]{1,39}$/
const liste = ref([])          // [{ key, label, pub, errors }]
const cur = ref('')
const def = ref(null)
const basis = ref('')          // gespeicherte Form — ungespeichert ist, was davon abweicht
const meldung = ref('')
const neuKey = ref('')
const pubs = ref([]), rollen = ref([]), teams = ref([])
// fremde Quellen (19.10.2026, pflegestruktur 43): Zugänge der Art mcp und ihre Werkzeuge — geladen, wenn jemand sie sehen will
const mcpZugaenge = ref([]), werkzeugListe = ref({})
const tokens = ref([]), neuesToken = ref('')
const vorschauFrage = ref(''), vorschau = ref(null), vorschauGespraech = ref('')
/// eine zufällige Kennung je Vorschau-Gespräch — der Kern merkt sich damit, was schon gefragt wurde
const neueKennung = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('')

const sichten = computed(() => (store.model?.views ?? []).map(v => ({ key: v.key, label: L(v.label) || v.key })))
const sprachen = computed(() => (store.model?.locales ?? []).map(l => l.code))
const leitsprache = computed(() => store.model?.masterLocale ?? sprachen.value[0] ?? 'de')
const keyOk = computed(() => KEY.test(neuKey.value) && !liste.value.some(b => b.key === neuKey.value))
const fehler = computed(() => liste.value.find(b => b.key === cur.value)?.errors ?? [])
const geaendert = computed(() => !!def.value && JSON.stringify(sauber(def.value)) !== basis.value)
const websites = computed({
  get: () => (def.value?.origins ?? []).join('\n'),
  set: v => { def.value.origins = String(v).split(/[\s,]+/).map(s => s.trim().replace(/\/+$/, '')).filter(Boolean) },
})

/// Was gespeichert wird: leere Felder fallen weg, Grenzen als Zahlen
function sauber(d) {
  const g = {}
  for (const k of ['jeBesucherMinute', 'jeBesucherTag', 'jeTag', 'kiJeTag']) { const n = Number(d.limits?.[k]); if (d.limits?.[k] !== '' && d.limits?.[k] != null && Number.isFinite(n) && n >= 0) g[k] = Math.floor(n) }
  const gruss = Object.fromEntries(Object.entries(d.greeting ?? {}).filter(([l, v]) => String(v ?? '').trim() && (d.locales ?? []).concat(leitsprache.value).includes(l)))
  return {
    label: String(d.label ?? '').trim() || null, pub: d.pub || null, role: d.role || null, view: d.view || null, locales: d.locales ?? [],
    greeting: gruss, ki: !!d.ki, team: d.ki ? (d.team || null) : null, mcp: d.mcp !== false, origins: d.origins ?? [], limits: g,
    url: String(d.url ?? '').trim().replace(/\/+$/, '') || null,
    // Anrede und Ton (18.10.2026): die Vorgabe („Sie“, freundlich) bleibt leer
    anrede: d.anrede === 'du' ? 'du' : null, ton: ['sachlich', 'locker'].includes(d.ton) ? d.ton : null,
    // fremde Quellen: nur Zugänge mit freigegebenen Werkzeugen, geordnet — so vergleicht „ungespeichert“ richtig
    quellen: (() => { const q = (d.quellen ?? []).filter(x => x.werkzeuge?.length).map(x => ({ zugang: x.zugang, werkzeuge: [...x.werkzeuge].sort() })).sort((a, b) => a.zugang.localeCompare(b.zugang)); return q.length ? q : null })(),
  }
}

async function ladeListe() {
  try { liste.value = await api.get('/api/advisor') ?? []; meldung.value = '' }
  catch (e) { liste.value = []; meldung.value = '✗ ' + e.message }
  // genau ein Berater: gleich offen — die Liste hätte nur eine Zeile (14.10.2026, in der Demo der von Tannwald)
  if (!cur.value && liste.value.length === 1) await oeffne(liste.value[0].key)
}
/// Die Werkzeuge eines MCP-Zugangs — der Server fragt den fremden Server; die Antwort steht unter dem Zugang
async function ladeWerkzeuge(z) {
  werkzeugListe.value = { ...werkzeugListe.value, [z.key]: null }
  try { werkzeugListe.value = { ...werkzeugListe.value, [z.key]: (await api.get(`/api/drivers/${encodeURIComponent(z.key)}/mcp/tools`))?.tools ?? [] } }
  catch (e) { werkzeugListe.value = { ...werkzeugListe.value, [z.key]: e.message } }
}
const frei = (z, w) => (def.value.quellen ?? []).some(q => q.zugang === z && q.werkzeuge.includes(w))
function schalte(z, w) {
  const qs = (def.value.quellen ?? []).map(q => ({ ...q, werkzeuge: [...q.werkzeuge] }))
  let q = qs.find(x => x.zugang === z)
  if (!q) { q = { zugang: z, werkzeuge: [] }; qs.push(q) }
  q.werkzeuge = q.werkzeuge.includes(w) ? q.werkzeuge.filter(x => x !== w) : [...q.werkzeuge, w]
  def.value.quellen = qs.filter(x => x.werkzeuge.length)
}
/// freigegeben, aber (noch) nicht geladen: die Namen stehen trotzdem da
const freigegeben = z => (def.value.quellen ?? []).find(q => q.zugang === z)?.werkzeuge ?? []

async function ladeAuswahl() {
  const sicher = async p => { try { return await api.get(p) ?? [] } catch { return [] } }
  let zugaenge
  ;[pubs.value, rollen.value, teams.value, zugaenge] = await Promise.all([sicher('/api/pub'), sicher('/api/auth/roles'), sicher('/api/teams'), sicher('/api/drivers')])
  mcpZugaenge.value = (Array.isArray(zugaenge) ? zugaenge : []).filter(z => z.art === 'mcp')
}
onMounted(() => { ladeListe(); ladeAuswahl() })

async function oeffne(key) {
  try {
    const d = await api.get('/api/plugins/advisor/data/' + encodeURIComponent('def:' + key)) ?? {}
    def.value = { label: '', pub: '', role: '', view: '', locales: [], greeting: {}, ki: false, team: '', mcp: true, origins: [], limits: {}, url: '', anrede: 'sie', ton: 'freundlich', ...JSON.parse(JSON.stringify(d)) }
    def.value.anrede ??= 'sie'; def.value.ton ??= 'freundlich'; def.value.quellen ??= []
    def.value.limits ??= {}; def.value.greeting ??= {}; def.value.locales ??= []
    basis.value = JSON.stringify(sauber(def.value))
    cur.value = key; neuesToken.value = ''; vorschau.value = null; vorschauGespraech.value = neueKennung()
    await ladeTokens()
  } catch (e) { store.toast(e.message) }
}

async function schreibe(key, d) { await api.post('/api/plugins/advisor/data/' + encodeURIComponent('def:' + key), sauber(d), 'PUT') }

async function anlegen() {
  if (!keyOk.value) return
  const key = neuKey.value
  // Vorschlag: der erste Publikationsbaum, die Rolle reader, die Sicht „Verkaufbares“ — alles änderbar
  const d = { label: key, pub: pubs.value[0]?.id ?? '', role: rollen.value.some(r => r.key === 'reader') ? 'reader' : '', view: sichten.value.some(v => v.key === 'sellable') ? 'sellable' : '', locales: [], greeting: {}, mcp: true, origins: [], limits: {} }
  try { await schreibe(key, d); neuKey.value = ''; await ladeListe(); await oeffne(key) }
  catch (e) { store.toast(e.message) }
}

async function speichern() {
  try { await schreibe(cur.value, def.value); await ladeListe(); await oeffne(cur.value); store.toast(t('Gespeichert'), 'ok') }
  catch (e) { store.toast(e.message) }
}

async function entfernen() {
  const key = cur.value
  const ok = await dialog.confirm({ title: t('Berater entfernen'), text: t('{0} — sein Dienst antwortet danach nicht mehr.', [def.value?.label || key]), ok: t('Entfernen'), danger: true })
  if (!ok) return
  try {
    for (const tk of tokens.value) await api.del(`/api/advisor/${encodeURIComponent(key)}/tokens/${encodeURIComponent(tk.id)}`)
    await api.del('/api/plugins/advisor/data/' + encodeURIComponent('def:' + key))
    cur.value = ''; def.value = null; tokens.value = []
    await ladeListe()
  } catch (e) { store.toast(e.message) }
}

function sprache(c) {
  const s = new Set(def.value.locales); s.has(c) ? s.delete(c) : s.add(c)
  def.value.locales = sprachen.value.filter(x => s.has(x))
}
const grussSprachen = computed(() => def.value?.locales?.length ? def.value.locales : [leitsprache.value])

async function ladeTokens() {
  try { tokens.value = await api.get(`/api/advisor/${encodeURIComponent(cur.value)}/tokens`) ?? [] } catch { tokens.value = [] }
}
async function tokenAusgeben() {
  try { const r = await api.post(`/api/advisor/${encodeURIComponent(cur.value)}/tokens`, { label: t('Dienst') }); neuesToken.value = r.token; await ladeTokens() }
  catch (e) { store.toast(e.message) }
}
async function tokenWiderrufen(id) {
  const ok = await dialog.confirm({ title: t('Token widerrufen'), text: t('Der Dienst mit diesem Token bekommt danach keine Antwort mehr.'), ok: t('Widerrufen'), danger: true })
  if (!ok) return
  try { await api.del(`/api/advisor/${encodeURIComponent(cur.value)}/tokens/${encodeURIComponent(id)}`); await ladeTokens() }
  catch (e) { store.toast(e.message) }
}

async function fragen() {
  // mit KI, wenn der Berater sie nutzt — die Vorschau zeigt, was ein Besucher bekommt, und warum die KI nicht antwortet (09.10.2026)
  try { vorschau.value = await api.post(`/api/advisor/${encodeURIComponent(cur.value)}/preview`, { gespraech: vorschauGespraech.value, q: vorschauFrage.value, locale: grussSprachen.value[0], ki: !!def.value.ki }) }
  catch (e) { vorschau.value = { error: e.message } }
}
/// Eine gesammelte Angabe als Text, wie im Chat-Fenster: „Preis (EUR): bis 200“ — ohne „bis“ las sich eine Grenze wie ein genauer Wert (14.10.2026)
const angabe = f => f.label + ': ' + (f.op === 'le' ? t('bis') + ' ' : f.op === 'ge' ? t('ab') + ' ' : '') + (f.valueLabel ?? f.value)
/// Ein neues Gespräch in der Vorschau: der Kern vergisst die gesammelten Angaben
function neuesGespraech() {
  vorschauGespraech.value = neueKennung(); vorschau.value = null; vorschauFrage.value = ''
}

/// wo der Dienst erreichbar ist — gespeichert am Berater, sonst ein Platzhalter für den Code zum Einbinden
const dienst = computed(() => (def.value?.url || '').replace(/\/+$/, '') || 'https://advisor.example.com')
const einbinden = computed(() => `<script src="${dienst.value}/widget.js" async><` + `/script>`)
/// Das echte Chat-Fenster auf dieser Seite (15.10.2026): lädt widget.js vom Dienst des Beraters — so, wie eine Website es einbindet — und öffnet es;
/// ein zweiter Klick öffnet dasselbe wieder (web/src/berater.js, wie „Produktberater starten“ oben). Der Dienst lässt es nur zu, wenn diese Adresse
/// unter Websites steht.
function chatOeffnen() { beraterStarten(dienst.value, grussSprachen.value[0]) }
const compose = computed(() => [
  `  advisor-${cur.value}:`,
  '    image: node:22-alpine',
  '    command: ["node", "/advisor/serve.mjs"]',
  `    volumes: ["./plugins/advisor:/advisor:ro", "advisor-${cur.value}-daten:/daten"]`,
  '    environment:',
  '      JOURNALI: http://server:8080',
  `      JOURNALI_ADVISOR: ${cur.value}`,
  '      JOURNALI_ADVISOR_TOKEN: ${JOURNALI_ADVISOR_TOKEN}',
  '      JOURNALI_ADVISOR_DATA: /daten',
  '    ports: ["127.0.0.1:8090:8090"]',
].join('\n'))
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ $t("✆ Produktberatung") }}</h1>
      <span class="grow" /><span :class="String(meldung).startsWith('✗') ? 'fehler' : 'muted'">{{ meldung }}</span></div>

    <div class="seiten">
      <div class="liste">
        <div class="step-band">{{ $t('Berater') }} · {{ liste.length }}</div>
        <table class="grid"><tbody>
          <tr v-for="b in liste" :key="b.key" class="berater" :class="{ current: cur === b.key }" style="cursor:pointer" @click="oeffne(b.key)">
            <td>{{ b.label || b.key }} <span class="muted">{{ b.key }}</span></td>
            <td style="width:24px" :class="b.errors.length ? 'neg' : 'pos'" :title="b.errors.join(' · ')">{{ b.errors.length ? '✗' : '✓' }}</td>
          </tr>
        </tbody></table>
        <form class="neu" data-demo="aus" @submit.prevent="anlegen">
          <input v-model="neuKey" class="neu-key" :placeholder="$t('Schlüssel, z. B. shop')" :title="$t('a–z, 0–9, _ und -, beginnt mit einem Buchstaben')" />
          <button type="submit" :disabled="!keyOk" :title="$t('Berater anlegen')">＋</button>
        </form>
      </div>

      <div v-if="def" class="rechts">
        <div class="kopf">
          <input v-model="def.label" class="bez" :placeholder="$t('Bezeichnung')" :title="$t('steht im Kopf des Chat-Fensters')" />
          <button type="button" class="primary speichern" data-demo="aus" :disabled="!geaendert" @click="speichern">{{ $t('Speichern') }}</button>
          <button type="button" class="entfernen" data-demo="aus" :title="$t('Berater entfernen')" @click="entfernen">✕</button>
        </div>
        <ul v-if="fehler.length" class="fehler neg"><li v-for="(e, i) in fehler" :key="i">✗ {{ e }}</li></ul>

        <!-- in der Demo nur ansehen: speichern geht dort nicht, und ungespeichert sperrte die Vorschau -->
        <fieldset class="felder" :disabled="!!store.demo">
        <table class="grid form"><colgroup><col style="width:120px" /><col /></colgroup><tbody>
          <tr><td class="attr" :title="$t('welche Produkte der Berater kennt: was dieser Baum für seinen Kanal ausleitet')">{{ $t('Publikationsbaum') }}</td>
            <td><select v-model="def.pub" class="pub"><option value="">—</option><option v-for="p in pubs" :key="p.id" :value="p.id">{{ p.label }} · {{ p.channel }}{{ p.market ? ' · ' + p.market : '' }}</option></select></td></tr>
          <tr><td class="attr" :title="$t('der Berater sieht, was diese Rolle sieht — eingeschränkte Knoten und Ordner bleiben aussen vor')">{{ $t('Rolle') }}</td>
            <td><select v-model="def.role" class="rolle"><option value="">—</option><option v-for="r in rollen" :key="r.key" :value="r.key">{{ r.label || r.key }}</option></select></td></tr>
          <tr><td class="attr" :title="$t('nur die Attribute dieser Sicht erscheinen am Produkt, in den Facetten und im Vergleich')">{{ $t('Sicht') }}</td>
            <td><select v-model="def.view" class="sicht"><option value="">—</option><option v-for="v in sichten" :key="v.key" :value="v.key">{{ v.label }}</option></select></td></tr>
          <tr><td class="attr">{{ $t('Sprachen') }}</td><td><div class="chips">
            <span v-for="c in sprachen" :key="c" class="view-chip sprache" :class="{ on: def.locales.includes(c) }" @click="sprache(c)">{{ c }}</span>
            <span v-if="!def.locales.length" class="muted" :title="$t('ohne Auswahl gilt die Leitsprache')">{{ ' ' + $t('· Leitsprache {0}', [leitsprache]) }}</span></div></td></tr>
          <tr v-for="l in grussSprachen" :key="'g' + l"><td class="attr">{{ $t('Begrüssung {0}', [l]) }}</td>
            <td><input v-model="def.greeting[l]" class="gruss" style="width:100%" :title="$t('der erste Satz im Chat-Fenster')" /></td></tr>
          <tr><td class="attr" :title="$t('in den festen Sätzen des Beraters und in den Texten der KI')">{{ $t('Anrede') }}</td>
            <td><select v-model="def.anrede" class="anrede"><option value="sie">{{ $t('Sie') }}</option><option value="du">{{ $t('du') }}</option></select></td></tr>
          <tr><td class="attr">{{ $t('KI') }}</td><td><div class="row">
            <label :title="$t('die KI des gewählten Teams schreibt zu den Treffern einen kurzen Text — sonst antwortet der Berater ohne KI')"><input type="checkbox" v-model="def.ki" class="ki" />{{ ' ' + $t('Text zu den Treffern') }}</label>
            <select v-if="def.ki" v-model="def.team" class="team" :title="$t('mit dessen KI-Schlüssel, gezählt bei diesem Team')"><option value="">—</option><option v-for="tm in teams" :key="tm.key" :value="tm.key">{{ tm.label || tm.key }}</option></select>
            <select v-if="def.ki" v-model="def.ton" class="ton" :title="$t('wie die KI schreibt — die Fakten bleiben dieselben')"><option value="sachlich">{{ $t('sachlich') }}</option><option value="freundlich">{{ $t('freundlich') }}</option><option value="locker">{{ $t('locker') }}</option></select>
          </div></td></tr>
          <tr v-if="def.ki" class="quellen"><td class="attr" :title="$t('MCP-Server, deren Werkzeuge die KI des Beraters nutzen darf — eingerichtet unter ⌁ Zugänge, Art MCP-Server')">{{ $t('Quellen') }}</td><td>
            <div v-if="!mcpZugaenge.length" class="muted">{{ $t('kein MCP-Zugang') }}</div>
            <div v-for="z in mcpZugaenge" :key="z.key" class="quelle">
              <div class="row"><strong>{{ z.label || z.key }}</strong>
                <button type="button" class="werkzeuge-laden" :title="$t('die Werkzeuge des MCP-Servers lesen')" @click="ladeWerkzeuge(z)">{{ $t('Werkzeuge') }}</button>
                <span v-if="werkzeugListe[z.key] === null" class="muted">…</span>
                <span v-else-if="typeof werkzeugListe[z.key] === 'string'" class="neg">✗ {{ werkzeugListe[z.key] }}</span></div>
              <label v-for="w in (Array.isArray(werkzeugListe[z.key]) ? werkzeugListe[z.key] : freigegeben(z.key).map(name => ({ name })))" :key="w.name" class="werkzeug" :title="w.description || ''">
                <input type="checkbox" :checked="frei(z.key, w.name)" @change="schalte(z.key, w.name)" />{{ ' ' + w.name }}</label>
            </div>
          </td></tr>
          <tr><td class="attr">{{ $t('MCP') }}</td><td><label :title="$t('fremde KI-Agenten fragen den Dienst unter /mcp mit denselben Grenzen')"><input type="checkbox" v-model="def.mcp" class="mcp" />{{ ' ' + $t('Werkzeuge für KI-Agenten') }}</label></td></tr>
          <tr><td class="attr" :title="$t('wo der Dienst des Beraters erreichbar ist — für den Code zum Einbinden und das Chat-Fenster hier')">{{ $t('Dienst') }}</td>
            <td><input v-model="def.url" class="dienst-url" style="width:100%" placeholder="https://advisor.example.com" /></td></tr>
          <tr><td class="attr" :title="$t('je Zeile eine Adresse, etwa https://www.example.com — nur diese Websites dürfen das Chat-Fenster einbinden')">{{ $t('Websites') }}</td>
            <td><textarea v-model.lazy="websites" class="websites" rows="2" style="width:100%" placeholder="https://www.example.com" /></td></tr>
          <tr><td class="attr" :title="$t('je Besucher zählt der Dienst, je Tag zählt journali; leer heisst Vorgabe')">{{ $t('Grenzen') }}</td><td><div class="row grenzen">
            <label :title="$t('Fragen je Besucher und Minute (Vorgabe 20)')">{{ $t('Besucher/min') }} <input type="number" min="0" v-model="def.limits.jeBesucherMinute" class="zahl" /></label>
            <label :title="$t('Fragen je Besucher und Tag (Vorgabe 300)')">{{ $t('Besucher/Tag') }} <input type="number" min="0" v-model="def.limits.jeBesucherTag" class="zahl" /></label>
            <label :title="$t('Fragen aller Besucher je Tag (leer: ohne Grenze)')">{{ $t('gesamt/Tag') }} <input type="number" min="0" v-model="def.limits.jeTag" class="zahl je-tag" /></label>
            <label :title="$t('Texte der KI je Tag (leer: ohne Grenze)')">{{ $t('KI/Tag') }} <input type="number" min="0" v-model="def.limits.kiJeTag" class="zahl" /></label>
          </div></td></tr>
        </tbody></table>
        </fieldset>

        <div data-demo="aus">
        <div class="step-band" :title="$t('der Dienst meldet sich mit einem Token an; es gilt nur für die Fragen an diesen Berater')">{{ $t('Token') }} · {{ tokens.length }}</div>
        <table class="grid"><tbody>
          <tr v-for="tk in tokens" :key="tk.id" class="token"><td>{{ tk.label }} <span class="muted">{{ tk.id }}…</span></td><td class="muted">{{ new Date(tk.at).toLocaleString() }}</td>
            <td style="width:24px"><button type="button" class="x widerrufen" :title="$t('Token widerrufen')" @click="tokenWiderrufen(tk.id)">✕</button></td></tr>
        </tbody></table>
        <div class="row" style="padding:4px 8px">
          <button type="button" class="token-neu" :disabled="geaendert" :title="geaendert ? $t('ungespeicherte Änderungen') : $t('ein neues Token für den Dienst')" @click="tokenAusgeben">{{ $t('＋ Token') }}</button>
          <code v-if="neuesToken" class="neues-token" :title="$t('nur jetzt sichtbar — als JOURNALI_ADVISOR_TOKEN des Dienstes')">{{ neuesToken }}</code>
        </div>
        </div>

        <div class="step-band" :title="$t('dieselbe Frage, die ein Besucher stellt — mit Text der KI, wenn der Berater sie nutzt')">{{ $t('Vorschau') }}</div>
        <form class="row" style="padding:4px 8px" @submit.prevent="fragen">
          <input v-model="vorschauFrage" class="vorschau-frage" style="flex:1" :placeholder="$t('Frage eines Besuchers')" />
          <button type="submit" class="vorschau-los" :disabled="geaendert" :title="geaendert ? $t('ungespeicherte Änderungen') : ''">{{ $t('Fragen') }}</button>
          <button type="button" class="vorschau-neu" :title="$t('ein neues Gespräch: die gesammelten Angaben fallen weg')" @click="neuesGespraech">↺</button>
          <button v-if="def.url && !geaendert" type="button" class="chat-oeffnen" :title="$t('das Chat-Fenster des Dienstes auf dieser Seite, wie auf einer Website')" @click="chatOeffnen">{{ $t('✆ Chat-Fenster') }}</button>
        </form>
        <div v-if="vorschau" class="vorschau" style="padding:0 8px 8px">
          <div v-if="vorschau.error" class="neg">✗ {{ vorschau.error }}</div>
          <template v-else>
            <div v-if="vorschau.texte?.satz || vorschau.texte?.ueber" class="satz">{{ vorschau.texte.ueber ? vorschau.texte.ueber + ' ' : '' }}{{ vorschau.texte.satz }}</div>
            <div v-for="(h, i) in vorschau.texte?.hinweise ?? []" :key="'h' + i" class="muted hinweis">{{ h }}</div>
            <!-- die Frage des Beraters gehört zur Antwort, wie im Chat-Fenster (14.10.2026: die Vorschau liess sie weg) -->
            <div v-if="vorschau.texte?.statt || vorschau.texte?.frage" class="frage">{{ [vorschau.texte.statt, vorschau.texte.frage].filter(Boolean).join(' ') }}</div>
            <div v-if="vorschau.filter?.length || vorschau.words?.length" class="muted gesammelt" :title="$t('was der Kern aus dem Gespräch gesammelt hat')">{{ [...(vorschau.words ?? []), ...(vorschau.filter ?? []).map(angabe)].join(' · ') }}</div>
            <table v-if="vorschau.about?.values?.length" class="grid about"><tbody><tr v-for="v in vorschau.about.values" :key="v.key"><td class="attr">{{ v.label }}</td><td>{{ v.value }}</td></tr></tbody></table>
            <div class="muted" :title="vorschau.warning || ''">{{ $t('{0} Treffer', [vorschau.total]) }}{{ vorschau.warning && !vorschau.warning.startsWith('KI') ? ' · ' + $t('nur Wortsuche') : '' }}</div>
            <div v-if="vorschau.warning?.startsWith('KI')" class="neg ki-fehler">✗ {{ vorschau.warning }}</div>
            <div v-if="vorschau.answer" class="ki-text" :title="$t('Text von einer KI erstellt')">✧ {{ vorschau.answer }}</div>
            <div v-for="u in vorschau.docs ?? []" :key="u.n" class="unterlage muted" :title="u.text">⎘ U{{ u.n }} {{ u.heading || u.name }} · {{ u.name }}</div>
            <ol class="treffer"><li v-for="h in vorschau.hits" :key="h.id">{{ h.name }} <span class="muted">{{ (h.values ?? []).map(v => v.label + ': ' + v.value).join(' · ') }}</span></li></ol>
            <div v-if="vorschau.facets?.length" class="muted facetten">{{ $t('Facetten') }}: {{ vorschau.facets.map(f => f.label).join(', ') }}</div>
          </template>
        </div>

        <div class="step-band" data-demo="aus" :title="$t('der Dienst läuft im eigenen Container und spricht nur über /api mit journali — docs/betrieb.md')">{{ $t('Einbinden') }}</div>
        <div style="padding:4px 8px" class="einbinden" data-demo="aus">
          <div class="muted">{{ $t('Website') }}</div><pre class="code">{{ einbinden }}</pre>
          <div class="muted">{{ $t('MCP') }}</div><pre class="code">{{ dienst }}/mcp</pre>
          <div class="muted">compose.yaml</div><pre class="code">{{ compose }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.seiten { display: flex; gap: 0; flex: 1; min-height: 0; }
.liste { width: 260px; border-right: 1px solid var(--line); overflow-y: auto; }
.rechts { flex: 1; overflow-y: auto; min-width: 0; }
.kopf { display: flex; gap: 6px; align-items: center; padding: 6px 8px; }
.kopf .bez { flex: 1; }
.neu { display: flex; gap: 4px; padding: 6px 8px; }
.neu input { flex: 1; min-width: 0; }
.form { width: 100%; }
.felder { border: 0; padding: 0; margin: 0; min-width: 0; }
.form td { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px; }
.form td.attr { color: var(--muted); white-space: nowrap; padding-left: 8px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.zahl { width: 70px; }
.code { margin: 2px 0 8px; padding: 6px 8px; background: var(--bg2, rgba(127,127,127,.08)); border-radius: 4px; white-space: pre-wrap; word-break: break-all; font-size: 12px; }
.neues-token { user-select: all; word-break: break-all; }
.fehler { margin: 4px 8px; padding-left: 16px; }
.treffer { margin: 4px 0; padding-left: 20px; }
</style>
