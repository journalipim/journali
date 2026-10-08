<script setup>
// ⇪ Export → Produktberatung (docs/pflegestruktur.md 42, 08.10.2026): die Berater dieser Instanz. Ein Berater ist ein Publikationsbaum, eine Rolle,
// eine Sicht und ein paar Grenzen — als Plugin-Daten def:<schlüssel> im Journal. Hier wird er angelegt, sein Dienst bekommt ein Token, und die
// Vorschau stellt dieselbe Frage wie ein Besucher (POST /api/advisor/<schlüssel>/ask, mit dem Recht Plugins statt des Tokens).
import { ref, computed, onMounted } from 'vue'
import { api, store, dialog, L, t } from 'journali'

const KEY = /^[a-z][a-z0-9_-]{1,39}$/
const liste = ref([])          // [{ key, label, pub, errors }]
const cur = ref('')
const def = ref(null)
const basis = ref('')          // gespeicherte Form — ungespeichert ist, was davon abweicht
const meldung = ref('')
const neuKey = ref('')
const pubs = ref([]), rollen = ref([]), teams = ref([])
const tokens = ref([]), neuesToken = ref('')
const vorschauFrage = ref(''), vorschau = ref(null)

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
  }
}

async function ladeListe() {
  try { liste.value = await api.get('/api/advisor') ?? []; meldung.value = '' }
  catch (e) { liste.value = []; meldung.value = '✗ ' + e.message }
}
async function ladeAuswahl() {
  const sicher = async p => { try { return await api.get(p) ?? [] } catch { return [] } }
  ;[pubs.value, rollen.value, teams.value] = await Promise.all([sicher('/api/pub'), sicher('/api/auth/roles'), sicher('/api/teams')])
}
onMounted(() => { ladeListe(); ladeAuswahl() })

async function oeffne(key) {
  try {
    const d = await api.get('/api/plugins/advisor/data/' + encodeURIComponent('def:' + key)) ?? {}
    def.value = { label: '', pub: '', role: '', view: '', locales: [], greeting: {}, ki: false, team: '', mcp: true, origins: [], limits: {}, ...JSON.parse(JSON.stringify(d)) }
    def.value.limits ??= {}; def.value.greeting ??= {}; def.value.locales ??= []
    basis.value = JSON.stringify(sauber(def.value))
    cur.value = key; neuesToken.value = ''; vorschau.value = null
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
  try { vorschau.value = await api.post(`/api/advisor/${encodeURIComponent(cur.value)}/ask`, { q: vorschauFrage.value, locale: grussSprachen.value[0], ki: false }) }
  catch (e) { vorschau.value = { error: e.message } }
}

const einbinden = computed(() => `<script src="https://advisor.example.com/widget.js" async><` + `/script>`)
const compose = computed(() => [
  `  advisor-${cur.value}:`,
  '    image: node:22-alpine',
  '    command: ["node", "/advisor/serve.mjs"]',
  '    volumes: ["./plugins/advisor:/advisor:ro"]',
  '    environment:',
  '      JOURNALI: http://server:8080',
  `      JOURNALI_ADVISOR: ${cur.value}`,
  '      JOURNALI_ADVISOR_TOKEN: ${JOURNALI_ADVISOR_TOKEN}',
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
        <form class="neu" @submit.prevent="anlegen">
          <input v-model="neuKey" class="neu-key" :placeholder="$t('Schlüssel, z. B. shop')" :title="$t('a–z, 0–9, _ und -, beginnt mit einem Buchstaben')" />
          <button type="submit" :disabled="!keyOk" :title="$t('Berater anlegen')">＋</button>
        </form>
      </div>

      <div v-if="def" class="rechts">
        <div class="kopf">
          <input v-model="def.label" class="bez" :placeholder="$t('Bezeichnung')" :title="$t('steht im Kopf des Chat-Fensters')" />
          <button type="button" class="primary speichern" :disabled="!geaendert" @click="speichern">{{ $t('Speichern') }}</button>
          <button type="button" class="entfernen" :title="$t('Berater entfernen')" @click="entfernen">✕</button>
        </div>
        <ul v-if="fehler.length" class="fehler neg"><li v-for="(e, i) in fehler" :key="i">✗ {{ e }}</li></ul>

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
          <tr><td class="attr">{{ $t('KI') }}</td><td><div class="row">
            <label :title="$t('die KI des gewählten Teams schreibt zu den Treffern einen kurzen Text — sonst antwortet der Berater ohne KI')"><input type="checkbox" v-model="def.ki" class="ki" />{{ ' ' + $t('Text zu den Treffern') }}</label>
            <select v-if="def.ki" v-model="def.team" class="team" :title="$t('mit dessen KI-Schlüssel, gezählt bei diesem Team')"><option value="">—</option><option v-for="tm in teams" :key="tm.key" :value="tm.key">{{ tm.label || tm.key }}</option></select>
          </div></td></tr>
          <tr><td class="attr">{{ $t('MCP') }}</td><td><label :title="$t('fremde KI-Agenten fragen den Dienst unter /mcp mit denselben Grenzen')"><input type="checkbox" v-model="def.mcp" class="mcp" />{{ ' ' + $t('Werkzeuge für KI-Agenten') }}</label></td></tr>
          <tr><td class="attr" :title="$t('je Zeile eine Adresse, etwa https://www.example.com — nur diese Websites dürfen das Chat-Fenster einbinden')">{{ $t('Websites') }}</td>
            <td><textarea v-model.lazy="websites" class="websites" rows="2" style="width:100%" placeholder="https://www.example.com" /></td></tr>
          <tr><td class="attr" :title="$t('je Besucher zählt der Dienst, je Tag zählt journali; leer heisst Vorgabe')">{{ $t('Grenzen') }}</td><td><div class="row grenzen">
            <label :title="$t('Fragen je Besucher und Minute (Vorgabe 20)')">{{ $t('Besucher/min') }} <input type="number" min="0" v-model="def.limits.jeBesucherMinute" class="zahl" /></label>
            <label :title="$t('Fragen je Besucher und Tag (Vorgabe 300)')">{{ $t('Besucher/Tag') }} <input type="number" min="0" v-model="def.limits.jeBesucherTag" class="zahl" /></label>
            <label :title="$t('Fragen aller Besucher je Tag (leer: ohne Grenze)')">{{ $t('gesamt/Tag') }} <input type="number" min="0" v-model="def.limits.jeTag" class="zahl je-tag" /></label>
            <label :title="$t('Texte der KI je Tag (leer: ohne Grenze)')">{{ $t('KI/Tag') }} <input type="number" min="0" v-model="def.limits.kiJeTag" class="zahl" /></label>
          </div></td></tr>
        </tbody></table>

        <div class="step-band" :title="$t('der Dienst meldet sich mit einem Token an; es gilt nur für die Fragen an diesen Berater')">{{ $t('Token') }} · {{ tokens.length }}</div>
        <table class="grid"><tbody>
          <tr v-for="tk in tokens" :key="tk.id" class="token"><td>{{ tk.label }} <span class="muted">{{ tk.id }}…</span></td><td class="muted">{{ new Date(tk.at).toLocaleString() }}</td>
            <td style="width:24px"><button type="button" class="x widerrufen" :title="$t('Token widerrufen')" @click="tokenWiderrufen(tk.id)">✕</button></td></tr>
        </tbody></table>
        <div class="row" style="padding:4px 8px">
          <button type="button" class="token-neu" :disabled="geaendert" :title="geaendert ? $t('ungespeicherte Änderungen') : $t('ein neues Token für den Dienst')" @click="tokenAusgeben">{{ $t('＋ Token') }}</button>
          <code v-if="neuesToken" class="neues-token" :title="$t('nur jetzt sichtbar — als JOURNALI_ADVISOR_TOKEN des Dienstes')">{{ neuesToken }}</code>
        </div>

        <div class="step-band" :title="$t('dieselbe Frage, die ein Besucher stellt — ohne Text der KI')">{{ $t('Vorschau') }}</div>
        <form class="row" style="padding:4px 8px" @submit.prevent="fragen">
          <input v-model="vorschauFrage" class="vorschau-frage" style="flex:1" :placeholder="$t('Frage eines Besuchers')" />
          <button type="submit" class="vorschau-los" :disabled="geaendert" :title="geaendert ? $t('ungespeicherte Änderungen') : ''">{{ $t('Fragen') }}</button>
        </form>
        <div v-if="vorschau" class="vorschau" style="padding:0 8px 8px">
          <div v-if="vorschau.error" class="neg">✗ {{ vorschau.error }}</div>
          <template v-else>
            <div class="muted" :title="vorschau.warning || ''">{{ $t('{0} Treffer', [vorschau.total]) }}{{ vorschau.warning ? ' · ' + $t('nur Wortsuche') : '' }}</div>
            <ol class="treffer"><li v-for="h in vorschau.hits" :key="h.id">{{ h.name }} <span class="muted">{{ (h.values ?? []).map(v => v.label + ': ' + v.value).join(' · ') }}</span></li></ol>
            <div v-if="vorschau.facets?.length" class="muted facetten">{{ $t('Facetten') }}: {{ vorschau.facets.map(f => f.label).join(', ') }}</div>
          </template>
        </div>

        <div class="step-band" :title="$t('der Dienst läuft im eigenen Container und spricht nur über /api mit journali — docs/betrieb.md')">{{ $t('Einbinden') }}</div>
        <div style="padding:4px 8px" class="einbinden">
          <div class="muted">{{ $t('Website') }}</div><pre class="code">{{ einbinden }}</pre>
          <div class="muted">{{ $t('MCP') }}</div><pre class="code">https://advisor.example.com/mcp</pre>
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
.form td { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px; }
.form td.attr { color: var(--muted); white-space: nowrap; padding-left: 8px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.zahl { width: 70px; }
.code { margin: 2px 0 8px; padding: 6px 8px; background: var(--bg2, rgba(127,127,127,.08)); border-radius: 4px; white-space: pre-wrap; word-break: break-all; font-size: 12px; }
.neues-token { user-select: all; word-break: break-all; }
.fehler { margin: 4px 8px; padding-left: 16px; }
.treffer { margin: 4px 0; padding-left: 20px; }
</style>
