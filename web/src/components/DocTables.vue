<script setup>
// Werte aus einem Dokument den Attributen zuordnen (27.09.2026, pflegestruktur 34 L; Text gegen das Modell 28.09.2026).
// Ein technisches Dokument wird nicht nur angehängt, sondern ausgewertet — aus zwei Quellen, in einer Liste:
// 1. Tabellen (▦): der Leser (Plugin docs) legt Schlüssel/Wert-Zeilen neben den Text; je Zeile schlägt der Mapper das
//    Attribut vor — gefunden oder neu. Ohne KI, immer.
// 2. Text gegen das Modell (✦): die Attribute, die an diesem Knoten gelten, und der Text des Dokuments gehen an die KI;
//    sie nennt je Attribut Wert, Seite, Stelle und Sicherheit — und dazu alle weiteren technischen Daten als
//    Bezeichnung/Wert, die zu keinem Attribut der Liste passen; die gehen durch den Mapper wie eine Tabellenzeile.
//    Nur mit KI-Schlüssel am Team, und nur auf Knopfdruck — was Token kostet, läuft nicht von selbst.
// 2a. Text gegen das Modell ohne KI (▦ Zeile, ⌕ Sinnsuche): bei einem Datenblatt steht der Wert in derselben Zeile wie
//    sein Schlüssel. Je Attribut, das hier gilt, die Zeile, deren Schlüssel Bezeichnung, Attributschlüssel oder ein Synonym
//    trifft; für den Rest die Suche im Dokument (Wörter und Vektoren, wenn embed läuft) und im Abschnitt die passendste
//    Schlüssel/Wert-Zeile. Findet ohne Kosten, was zu finden ist — die KI bleibt für das, was so nicht zu fassen ist.
// 3. Textbausteine (▤): jeder Abschnitt mit Überschrift aus dem Index — ohne Wert, aber mit Platz am Produkt. Fliesstext
//    wird ein html-Attribut; eine Aufzählung („Funkentstörung“ mit acht Punkten) wird eine Werteliste, deren Werte die
//    Sätze sind — einmal gepflegt, einmal übersetzt, am Produkt ausgewählt. Je Satz Best Guess gegen die Werte der Liste,
//    denn das nächste Datenblatt sagt „bitte nicht kreuzen“ statt „nicht kreuzen“. Ohne KI, ohne Haken vorbelegt.
// Es schreibt nichts ohne ✓. Dann: neue Attribute ins Modell (zählt nicht) — in eine Gruppe, die der Anwender wählt oder
// neu anlegt; gilt sie am Knoten noch nicht, kommt sie an ihn oder an eine Ebene darüber, die er wählt —, dann ein Stapel:
// je Wert attribute.set und dazu der Beleg (value.source: Dokument, Seite, Stelle). Zielen zwei Zeilen mit demselben Wert auf ein Attribut, ist das kein Widerspruch — geschrieben wird einmal.
// Mit verschiedenen Werten trägt keine den Haken: der Anwender wählt, nicht der Dialog.
// props: node = die Knotenansicht (id, role, groups, attachedGroups, values); media = Ids der Dokumente; names = Id → Name
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { ai } from '../ai.js'
import { icon, tree } from '../tree.js'
import { ensureUnit } from '../compliance.js'
import { suggestPairs, convert, validate, splitUnit, norm, similarity, SYNONYMS, DOC_GROUP } from '../mapper.js'
import { attachFiles } from '../media.js'
import { t as t_ } from '../i18n.js'
import { L } from '../i18n.js'

/// media/names: Dokumente, die schon am Knoten hängen. dateien/typen: Dateien, die der Dialog selbst hochlädt und
/// anhängt (Shift+Drop) — so steht der Fortschritt vom ersten Moment an hier, nicht erst nach dem Hochladen
const props = defineProps({ node: { type: Object, required: true }, media: { type: Array, default: () => [] }, names: { type: Object, default: () => ({}) },
  dateien: { type: Array, default: () => [] }, typen: { type: Array, default: () => [] } })
const medien = ref([...props.media])
const namen = ref({ ...props.names })
const hochladen = ref(false)
const emit = defineEmits(['close', 'done'])

const TYPEN = ['text', 'integer', 'decimal', 'boolean', 'date', 'enum']
const docs = ref(new Map())      // id → { state, tables }
const tabellenZeilen = ref([])
const zeilenWerte = ref([])   // ohne KI aus dem Text: ▦ Zeile, ⌕ Sinnsuche
const kiZeilen = ref([])
const textZeilen = ref([])
const rows = computed(() => [...tabellenZeilen.value, ...zeilenWerte.value, ...kiZeilen.value, ...textZeilen.value])
/// Die Werte nach Attribut sortiert — die Quelle nennt die Seite, die Reihenfolge des Dokuments braucht niemand
const zielName = r => r.target === 'attr' ? (L(attrs.value.find(a => a.key === r.attribute)?.label) || r.attribute || '') : r.target === 'new' ? (r.key || r.newKey || '') : r.key || ''
const werte = computed(() => rows.value.filter(r => !r.baustein).sort((a, b) => zielName(a).localeCompare(zielName(b), 'de', { sensitivity: 'base' })))
const bausteineZeilen = computed(() => rows.value.filter(r => r.baustein))
/// Von welcher bis zu welcher Seite die Bausteine reichen — sie stehen in der Reihenfolge des Dokuments
const bausteineSeiten = computed(() => { const s = bausteineZeilen.value.map(r => r.page).filter(p => p != null); return s.length ? [Math.min(...s), Math.max(...s)] : [0, 0] })
const warten = ref(true)          // ein Dokument ist noch nicht gelesen — der Job liest es, wir fragen nach
const hinweis = ref('')
const ki = ref(ai.available() ? 'bereit' : 'aus')   // aus | bereit | läuft | fertig | fehler — läuft erst auf Knopfdruck
const texte = new Map()           // Dokument → Abschnitte, für die KI auf Knopfdruck
const textZahl = ref(0)           // wie viele Texte da sind — die Map ist nicht reaktiv, der Zähler schon
const kiHinweis = ref('')
const busy = ref(false)
/// Was das Übernehmen gerade tut: Attribute anlegen, Listen ergänzen, Werte schreiben — mit Zähler, weil achtzig neue
/// Attribute achtzig Anfragen sind (28.09.2026)
const arbeit = ref(null)   // { text, erledigt, gesamt } oder null
/// Mehrere Anfragen zugleich: vier Stränge über dieselbe Liste — die Reihenfolge ist egal, jede Sache steht für sich
async function reihum(liste, f, straenge = 4) {
  const rest = [...liste]
  await Promise.all(Array.from({ length: Math.min(straenge, rest.length) }, async () => { while (rest.length) await f(rest.shift()) }))
}
let gestartet = false, timer = null
const textGeholt = new Set()      // Dokumente, deren Text schon geholt ist (Textbausteine, Zeilen, KI)
/// Die Schritte, die Werte nachliefern: je Dokument der Text, dann je offenem Attribut eine Suche. Der Balken sagt,
/// wann nichts mehr kommt (28.09.2026)
const schritte = ref({ gesamt: 0, erledigt: 0 })
const laeuft = computed(() => schritte.value.erledigt < schritte.value.gesamt)
const prozent = computed(() => schritte.value.gesamt ? Math.round(schritte.value.erledigt / schritte.value.gesamt * 100) : 100)
const t0 = Date.now()
const WARTEN_MS = 120_000, TAKT_MS = 1500
const TEXT_MAX = 60_000           // Zeichen, die an die KI gehen — ein Datenblatt hat wenige Seiten, ein Katalog nicht

const model = computed(() => store.model ?? {})
const attrs = computed(() => (model.value.attributes ?? []).filter(a => !['rows', 'formula', 'template', 'html'].includes(a.type))
  .sort((a, b) => (L(a.label) || a.key).localeCompare(L(b.label) || b.key, 'de', { sensitivity: 'base' })))
const units = computed(() => model.value.units ?? [])
/// Attribute für die Bausteine: html für Fliesstext, mehrwertige Wertelisten für Aufzählungen
const bausteinAttrs = computed(() => (model.value.attributes ?? []).filter(a => a.type === 'html' || (a.type === 'enum' && a.multiple))
  .sort((a, b) => (a.type === 'html' ? 0 : 1) - (b.type === 'html' ? 0 : 1) || (L(a.label) || a.key).localeCompare(L(b.label) || b.key, 'de', { sensitivity: 'base' })))
/// Der Anwender stellt den Typ eines neuen Bausteins um: html (Absätze und Listen) oder enum (die Sätze als Werteliste)
function typBaustein(r) {
  if (r.newType === 'enum') alsListe(r, r.saetze, null)
  else { r.listValues = null; r.multiple = false; r.converted = alsHtml(r.value); r.error = null; r.why = '' }
}
const gilt = key => (props.node.groups ?? []).some(g => g.key === key)
const gruppeHier = key => { const a = (model.value.attributes ?? []).find(x => x.key === key); return !a?.group || gilt(a.group) }
const genommen = computed(() => rows.value.filter(r => r.take && r.target !== 'skip' && r.converted != null && r.converted !== ''))
const anzahl = computed(() => rows.value.length)
const name = id => namen.value[id] ?? id
const mehrere = computed(() => medien.value.length > 1)

// ---- Wohin mit neuen Attributen: eine Gruppe des Modells oder eine neue, und die Ebene, an der sie hängt.
// Vorgabe ist „aus Dokument“, wenn es die Gruppe gibt — sonst eine neue mit diesem Namen. Der Anwender wählt anders,
// wenn er es besser weiss: „Elektrik“ an die Produktgruppe darüber, damit alle Produkte darunter das Attribut haben
const gruppen = computed(() => model.value.groups ?? [])
const gruppe = ref(gruppen.value.some(g => g.key === DOC_GROUP) ? DOC_GROUP : '+')   // Schlüssel einer Gruppe oder '+' = neu
const gruppeName = ref(t_('aus Dokument'))
const ebene = ref(props.node.id)
/// Der Pfad von der Wurzel bis hierher — die Ebenen, an die eine Gruppe kommen kann
const pfad = computed(() => [...(props.node.ancestors ?? []).map(a => ({ id: a.id, role: a.role, label: a.label })), { id: props.node.id, role: props.node.role, label: tree.byId.get(props.node.id)?.label ?? props.node.id }])
const neueZeilen = computed(() => genommen.value.some(r => r.target === 'new'))
/// Schlüssel aus einem Namen: klein, Umlaute aufgelöst, alles andere ein Unterstrich
const schluessel = s => String(s ?? '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const gruppeKey = computed(() => gruppe.value === '+' ? schluessel(gruppeName.value) : gruppe.value)
/// Kommt die gewählte Gruppe von einem Vorfahren? Dann hängt nichts — die Ebene entfällt. Hängt sie am Knoten selbst,
/// bleibt die Ebene wählbar: eine Ebene darüber hängt sie dort an, und der Server räumt sie hier weg (AttachGroups)
const vonOben = key => (props.node.groups ?? []).some(g => g.key === key && g.from && g.from !== props.node.id)
const gruppeGilt = computed(() => gruppe.value !== '+' && vonOben(gruppe.value))

/// Die Attribute, die an diesem Knoten gelten: aus den Gruppen am Pfad, die hier aktiv sind. Das ist die Liste,
/// gegen die der Text gelesen wird — nicht das ganze Modell.
const attributeHier = computed(() => {
  const keys = new Set((props.node.groups ?? []).filter(g => g.active !== false).flatMap(g => g.attributes ?? []))
  return attrs.value.filter(a => keys.has(a.key))
})
/// Was der Knoten für dieses Attribut schon hat: der eigene Wert, sonst — wenn das Attribut vererbt — der des nächsten
/// Vorfahren. Ohne Zeile; bei Sprachen die ohne, sonst die Mastersprache, sonst die erste
function vorhanden(key) {
  const master = model.value.masterLocale ?? 'de'
  const such = werte => { const l = (werte ?? []).filter(v => v.attribute === key && !v.row && (v.value != null && v.value !== '' || v.values?.length)); return l.find(v => !v.locale) ?? l.find(v => v.locale === master) ?? l[0] ?? null }
  const eigen = such(props.node.values); if (eigen) return { ...eigen, von: null }
  if (!(model.value.attributes ?? []).find(a => a.key === key)?.inheritable) return null
  for (const an of props.node.ancestors ?? []) { const v = such(an.values); if (v) return { ...v, von: an.label ?? an.id } }
  return null
}
/// „1,2“ und „1.2“ sind derselbe Wert, „104 Hz“ und „104  Hz“ auch
const gleichWert = (a, b) => { const n = s => String(s ?? '').trim().replace(/\s+/g, ' '); if (n(a) === n(b)) return true; const x = Number(n(a).replace(',', '.')), y = Number(n(b).replace(',', '.')); return n(a) !== '' && !Number.isNaN(x) && !Number.isNaN(y) && x === y }
const kurz = s => nurText(String(s ?? '')).slice(0, 40)
/// Steht am Knoten schon ein Wert? Dann steht er in der Zeile: derselbe → ohne Haken (es gibt nichts zu schreiben);
/// ein anderer eigener → ohne Haken, der Anwender entscheidet; ein anderer geerbter → mit Haken, das Dokument gehört zu
/// diesem Knoten und sein Wert bricht die Vererbung (28.09.2026)
function schonDa(r) {
  r.vorhanden = null; r.gleich = false
  if (r.target !== 'attr' || r.inaktiv || r.error) return r
  const v = vorhanden(r.attribute); if (!v) return r
  const alt = v.values ?? [v.value]
  const neu = r.listValues ? r.listValues.map(x => x.value) : r.multiple ? glieder(r.converted) : [r.converted]
  r.vorhanden = alt.map(kurz).join(', '); r.von = v.von
  r.gleich = alt.length === neu.length && alt.every(a => neu.some(b => gleichWert(a, b)))
  if (r.gleich) { r.take = false; r.why = t_('gleich · {0}', [r.vorhanden]) }
  else if (!v.von) { r.take = false; r.why = t_('hat schon · {0}', [r.vorhanden]) }
  else r.why = t_('geerbt · {0}', [r.vorhanden])
  return r
}
/// Der Tooltip zum Grund: woher der vorhandene Wert kommt
const whyTitel = r => r.gleich ? t_('Der Knoten hat diesen Wert schon{0}', [r.von ? ' — ' + t_('geerbt von {0}', [r.von]) : '']) : r.vorhanden ? (r.von ? t_('geerbt von {0} — der Wert aus dem Dokument gilt dann für diesen Knoten', [r.von]) : t_('Der Knoten hat einen eigenen Wert')) : ''

/// Zahl mit Einheit, die das Modell nicht kennt: der Mapper liess „104 Hz“ als Text stehen, weil er nur bekannte Einheiten
/// abtrennt (splitUnit). Für ein neues Attribut wird daraus eine Zahl mit neuer Einheit — angelegt beim ✓ (ensureUnit)
const ZAHL_EINHEIT = /^([+-]?\d[\d.,\s']*?)\s*([A-Za-zµΩ°%][A-Za-z0-9µΩ°%²³/]{0,7})\.?$/   // „560 Stk.“ — der Punkt gehört nicht zur Einheit
function einheitRaten(r) {
  if (r.target !== 'new' || r.unit || r.number != null) return r
  const m = String(r.value ?? '').trim().match(ZAHL_EINHEIT); if (!m) return r
  // „2.800 Stk.“: Punkt als Tausendertrenner (Dreiergruppen, kein Komma) — sonst wäre es 2,8
  const zahl = /^\d{1,3}(\.\d{3})+$/.test(m[1].trim()) ? m[1].trim().replace(/\./g, '') : m[1].trim(), sym = m[2]
  r.number = zahl; r.unit = sym; r.unitNeu = !units.value.some(u => u.key === sym || Object.values(u.label ?? {}).includes(sym))
  r.newType = /[.,]\d/.test(zahl) ? 'decimal' : 'integer'
  r.converted = convert(zahl, { type: r.newType }, model.value); r.error = validate(r.converted, { type: r.newType }, model.value)
  if (r.error) { r.newType = 'text'; r.unit = null; r.unitNeu = false; r.number = null; r.converted = r.value; r.error = null }
  else r.why = t_('neu als {0} {1}', [r.newType, sym])
  return r
}

/// Eine Aufzählung („EN 55015, EN 61000-3-2, EN 61347-2-12“) wird eine Werteliste, mehrwertig — angelegt beim ✓ mit
/// genau diesen Werten. Nur für ein neues Attribut, das sonst Text wäre: zwei oder mehr Glieder, jedes kurz
// Ein Komma zwischen Ziffern ist eine Dezimalstelle („1,5 mm²“), kein Trenner: getrennt wird an „;“ und an „, “ vor
// etwas, das keine Ziffer ist
const AUFZAEHLUNG = /\s*;\s*|,\s+(?=[^\d\s])/
const glieder = s => String(s ?? '').split(AUFZAEHLUNG).map(x => x.trim()).filter(Boolean)
function listeRaten(r) {
  if (r.target !== 'new' || r.newType !== 'text') return r
  const g = glieder(r.value)
  // Glieder einer Aufzählung sind kurz und aus wenigen Wörtern — „Zur Verdrahtung können Litzen- oder Volldraht …, …“
  // ist ein Satz mit Komma, keine Liste
  if (g.length < 2 || g.some(x => x.length > 40 || x.split(/\s+/).length > 4 || /[.!?]$/.test(x))) return r
  if (g.every(x => /^\d/.test(x))) return r   // „1,5 mm², 2,5 mm²“: Zahlen sind Werte, keine Werteliste
  return alsListe(r, g)
}
/// Eine Zeile wird eine Werteliste — neu (def null) oder die Liste eines vorhandenen enum-Attributs. Je Glied ein Wert:
/// Schlüssel, Text, und ob er in der Liste schon steht
function alsListe(r, g, def = null) {
  const liste = def?.list ? (model.value.lists ?? []).find(l => l.key === def.list) : null
  r.newType = 'enum'; r.multiple = def ? !!def.multiple || g.length > 1 : g.length > 1; r.unit = null; r.unitNeu = false; r.number = null
  r.listValues = zuordnen([...new Set(g)], liste)
  r.converted = r.listValues.map(v => v.value).join(','); r.error = null
  const neu = r.listValues.filter(v => v.neu).length
  if (def) { r.why = liste?.closed && neu ? t_('Liste {0} ist geschlossen', [def.list]) : neu ? t_('{0} neu in Liste {1}', [neu, def.list]) : ''; r.error = liste?.closed && neu ? r.why : null }
  else r.why = t_('neu als Werteliste mit {0} Werten', [r.listValues.length])
  return r
}
/// Ein Satz, kein Code: lang genug und aus Wörtern — nur dann zählt Ähnlichkeit. „EN 61347-2-12“ und „EN 61347-2-13“
/// sind sich ähnlich und doch verschieden
const istSatz = s => s.length >= 20 && /[a-zäöüß]{3,}\s+[a-zäöüß]{3,}/i.test(s)
/// Jedes Glied gegen die Werte der Liste: gleich, normalisiert gleich, oder — bei Sätzen — ähnlich ab der Schwelle des
/// Mappers. Sonst neu, mit einem Schlüssel aus dem Text
function zuordnen(glieder, liste) {
  const werte = liste?.values ?? []
  const vergeben = new Set(werte.map(v => v.value))
  return glieder.map(s => {
    const n = norm(s); let best = null, bs = 0
    for (const v of werte) for (const l of [v.value, ...Object.values(v.label ?? {})]) { const sc = similarity(n, norm(l)); if (sc > bs) { bs = sc; best = v } }
    if (best && (bs === 1 || (istSatz(s) && bs >= 0.72))) return { value: best.value, label: s, neu: false, trifft: Math.round(bs * 100) }
    let key = schluessel(s).slice(0, 60) || 'wert'; let i = 2; const basis = key
    while (vergeben.has(key)) key = `${basis}_${i++}`
    vergeben.add(key)
    return { value: key, label: s, neu: true, trifft: null }
  })
}
/// Was ein enum-Attribut aus dem Modell bekommt: Glieder gegen seine Liste — neue kommen beim ✓ dazu, wenn die Liste offen ist
function listeZuordnen(r) {
  const def = r.target === 'attr' ? attrs.value.find(a => a.key === r.attribute) : null
  if (def?.type !== 'enum') return r
  return alsListe(r, glieder(r.value).length ? glieder(r.value) : [String(r.value ?? '').trim()], def)
}
/// Kurz: ≣ 4 · 2 neu — und je Satz, wohin er geht
const listeText = r => `${r.multiple ? '≣' : '☰'} ${r.listValues?.length ?? 0}` + (r.listValues?.some(v => v.neu) ? ` · ${r.listValues.filter(v => v.neu).length} ${t_('neu')}` : '')
const listeTitel = r => (r.listValues ?? []).map(v => `${v.label} → ${v.value}${v.neu ? ' +' : v.trifft < 100 ? ` (${v.trifft} %)` : ''}`).join('\n')
/// Der Anwender stellt den Typ eines neuen Attributs um: enum macht aus dem Wert eine Liste, jeder andere Typ formt ihn um
function typ(r) {
  if (r.newType === 'enum') { alsListe(r, glieder(r.value).length ? glieder(r.value) : [String(r.value ?? '').trim()]); return }
  r.multiple = false; r.listValues = null
  r.converted = convert(r.number ?? r.value, { type: r.newType }, model.value); r.error = validate(r.converted, { type: r.newType }, model.value)
  r.why = r.unit ? t_('neu als {0} {1}', [r.newType, r.unit]) : t_('neu als {0}', [r.newType])
}

/// Aus den gelesenen Tabellen die Zeilen des Dialogs: Schlüssel links, Wert rechts, dazu der Vorschlag des Mappers.
function baue() {
  const paare = []; const je = new Map()
  for (const [id, d] of docs.value) for (const tb of d.tables ?? []) for (const cells of tb.rows ?? []) {
    if (!Array.isArray(cells) || cells.length < 2) continue
    const key = String(cells[0] ?? '').trim(), value = cells.slice(1).map(c => String(c ?? '').trim()).filter(Boolean).join(' ')
    if (!key || !value) continue
    const k = `${id}|${norm(key)}`; const da = je.get(k)
    if (!da) { const p = { key, value, doc: id, heading: tb.heading ?? null, page: tb.page ?? null, werte: [value] }; je.set(k, p); paare.push(p) }
    else if (!da.werte.some(v => gleichWert(v, value))) { da.werte.push(value); da.value = da.werte.join(' · ') }
  }
  const vorschlag = suggestPairs(paare, model.value, { role: props.node.role })
  tabellenZeilen.value = vorschlag.map((v, i) => {
    const r = listeZuordnen(listeRaten(einheitRaten({ ...paare[i], ...v, quelle: 'tabelle', quote: null, confidence: null })))
    // ein gefundenes Attribut, dessen Gruppe hier nicht gilt: der Server lehnte den Wert ab — als Hinweis, nicht als Sperre
    if (r.target === 'attr' && !gruppeHier(r.attribute)) { r.why = t_('Gruppe {0} gilt an diesem Knoten nicht', [attrs.value.find(a => a.key === r.attribute)?.group ?? '']); r.inaktiv = true }
    r.take = r.target !== 'skip' && !r.error && !r.inaktiv && r.converted != null
    return schonDa(r)
  })
  entdoppeln()
}

/// Die Abschnitte mit Überschrift werden Textbausteine: aufeinanderfolgende Abschnitte unter derselben Überschrift
/// zusammen, zu kurze und Überschriften aus blossen Zahlen nicht. Keine Zeile trägt einen Haken — man nimmt, was gehört
const MIN_TEXT = 40
function bausteine(id, chunks) {
  const gruppen = []
  for (const c of chunks ?? []) {
    if (!c.heading) continue
    const last = gruppen.at(-1)
    if (last && last.heading === c.heading) last.body += '\n' + c.body
    else gruppen.push({ heading: String(c.heading).trim(), body: String(c.body ?? ''), page: c.page ?? null })
  }
  // eine Überschrift ist kurz: bis 60 Zeichen, bis acht Wörter — „Um Geräteausfälle durch Masseschlüsse zu vermeiden,
  // muss die Verdrahtung“ hielt der Leser für eine, es ist ein Satz. Ein Umbruch im Fliesstext ist auch keine: der Text
  // geht klein weiter („Seh- und Arbeitsbedingungen zielt HCL vorrangig auf“ + „den circadianen Rhythmus ab“), oder die
  // Zeile endet mit einem Wort, das den Satz fortsetzt; „Größe“ + „(mm)“ ist ein Spaltenkopf (28.09.2026)
  const MAX_UEBERSCHRIFT = 60
  const GEHT_WEITER = /\b(und|oder|sowie|mit|auf|für|von|vom|bei|zu|zum|zur|der|die|das|den|dem|des|ein|eine|einen|einem|einer|im|in|an|am|nach|über|unter|durch|ohne|gegen|um|bis|als|wie|aus|sich|noch|auch|nur|sehr|so|dass|ob|wenn|weil|and|or|with|for|of|to|the|a|an|in|on|at|by|from|as)$/i
  const umbruch = g => GEHT_WEITER.test(g.heading) || /[a-zäöüß][.!?]\s+[A-ZÄÖÜ]/.test(g.heading) || /^[a-zäöüß(]/.test(g.body.trim())
  const neu = gruppen.filter(g => g.body.trim().length >= MIN_TEXT && !/^\d+([.,]\d+)?$/.test(g.heading) && schluessel(g.heading)
    && g.heading.length <= MAX_UEBERSCHRIFT && g.heading.split(/\s+/).length <= 8 && !/[,.;]$/.test(g.heading) && !umbruch(g)).map(g => {
    const zeilen = String(g.body).split(/\r?\n/).map(z => z.trim()).filter(Boolean)
    const punkte = zeilen.filter(z => /^[•\-–*·]\s*\S/.test(z)).map(z => z.replace(/^[•\-–*·]\s*/, ''))
    const r = { key: g.heading, value: g.body, doc: id, page: g.page, heading: g.heading, quote: null, confidence: null, quelle: 'text', baustein: true,
      target: 'new', attribute: null, newKey: schluessel(g.heading), newType: 'html', unit: null, number: null, converted: alsHtml(g.body), error: null, why: '', inaktiv: false, take: false,
      saetze: punkte.length >= 2 ? punkte : zeilen.map(z => z.replace(/^[•\-–*·]\s*/, '')) }
    // die Überschrift sucht ein Attribut — „Funkentstörung“ trifft die Liste, die es schon gibt
    const [v] = suggestPairs([{ key: g.heading, value: r.saetze[0] ?? g.body }], model.value, { role: props.node.role })
    const def = v?.target === 'attr' ? (model.value.attributes ?? []).find(a => a.key === v.attribute) : null
    if (def && (def.type === 'enum' || def.type === 'html')) { r.target = 'attr'; r.attribute = def.key; r.inaktiv = !gruppeHier(def.key); r.why = r.inaktiv ? t_('Gruppe {0} gilt an diesem Knoten nicht', [def.group ?? '']) : '' }
    // die Überschrift trifft ein Attribut anderen Typs („Gewicht“ ist eine Zahl): der Baustein bekommt einen eigenen
    // Schlüssel — sonst überschriebe der ✓ die Definition des Attributs, und der Server lehnte ab (626 Werte, 28.09.2026)
    else if (def || (model.value.attributes ?? []).some(a => a.key === r.newKey)) { r.why = def ? t_('Attribut {0} ist {1}', [def.key, def.type]) : t_('Schlüssel {0} gibt es', [r.newKey]); r.newKey = r.newKey + '_text' }
    if (def?.type === 'enum' || (!def && punkte.length >= 2)) alsListe(r, r.saetze, def?.type === 'enum' ? def : null)
    // Trifft der Baustein ein vorhandenes Attribut, das hier noch leer ist, ist er angehakt — das Modell sagt, das
    // Produkt hat es, das Datenblatt liefert es. Neues bleibt ohne Haken: man nimmt, was auf die Seite gehört
    r.take = r.target === 'attr' && !r.inaktiv && !r.error
    return schonDa(r)
  })
  textZeilen.value = [...textZeilen.value.filter(r => r.doc !== id), ...neu]
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/// Absätze und Aufzählungen aus dem Text: eine Zeile mit • oder – wird ein Listenpunkt, alles andere ein Absatz
function alsHtml(text) {
  const out = []; let li = []
  const flush = () => { if (li.length) { out.push('<ul>' + li.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'); li = [] } }
  for (const zeile of String(text ?? '').split(/\r?\n/)) {
    const z = zeile.trim(); if (!z) continue
    const m = z.match(/^[•\-–*·]\s*(.+)$/)
    if (m) li.push(m[1]); else { flush(); out.push(`<p>${esc(z)}</p>`) }
  }
  flush(); return out.join('')
}
/// Nur der Text, ohne Auszeichnung — für die Vorschau in der Zeile
const nurText = html => String(html ?? '').replace(/<\/(p|li)>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

// ---- Text gegen das Modell ohne KI
/// Eine Zeile Schlüssel/Wert: zwei Leerzeichen, Doppelpunkt oder Tab dazwischen
const KV_ZEILE = /^(.{2,60}?)(?:\s{2,}|:\s+|\t)(\S.*)$/
const kvZeile = z => { const m = String(z ?? '').trim().match(KV_ZEILE); return m ? { key: m[1].trim().replace(/:$/, ''), value: m[2].trim() } : null }
/// Wie gut ein Zeilenschlüssel ein Attribut trifft: gleich 1, beginnt damit 0,85, Synonym des Mappers 1, sonst Ähnlichkeit
function trifft(def, key) {
  const k = norm(key), master = model.value.masterLocale ?? 'de'
  const namen = [def.key, def.label?.[master], ...Object.values(def.label ?? {}), ...(SYNONYMS[def.key] ?? [])].filter(Boolean).map(norm)
  let best = 0
  for (const n of namen) { const sc = k === n ? 1 : k.startsWith(n + ' ') || k.startsWith(n) && k.length <= n.length + 3 ? 0.85 : similarity(k, n); if (sc > best) best = sc }
  return best
}
/// Die Zahl in einem Wert: „pro Stk.  0,105 kg“ → 0,105 — für ein Zahlenattribut zählt nur sie. Null, wenn keine da ist
const ZAHL = /[+-]?\d+(?:[.,]\d+)?/
function zahlIn(value, def) {
  const s = String(value ?? '')
  const split = def.unit ? splitUnit(s, model.value) : null
  if (split) return split.number
  const m = s.match(ZAHL); return m ? m[0] : null
}
/// Aus einer gefundenen Zeile eine Wertzeile für das Attribut — Einheit im Wert abgetrennt, umgeformt, geprüft.
/// Ein Zahlenattribut ohne Zahl im Wert (ein Tabellenkopf, eine Nebenzelle) gibt keine Zeile: ein falscher Vorschlag ist
/// schlechter als keiner
function wertZeile(def, id, kv, page, quelle, sc) {
  const master = model.value.masterLocale ?? 'de'
  const numerisch = def.type === 'integer' || def.type === 'decimal'
  const zahl = numerisch ? zahlIn(kv.value, def) : null
  if (numerisch && zahl == null) return null
  if (!/[\p{L}\d]{2}/u.test(String(kv.value))) return null   // „È“ aus einer Symbolschrift ist kein Wert
  if (/[≥≤<>=:]\s*$/.test(String(kv.value).trim())) return null   // „tc/ta für ≥“ ist ein Kopf, kein Wert
  const converted = convert(numerisch ? zahl : kv.value, def, model.value), error = validate(converted, def, model.value)
  const r = { key: def.label?.[master] || L(def.label) || def.key, value: kv.value, doc: id, page, heading: null, quote: `${kv.key}: ${kv.value}`, confidence: Math.round(sc * 100) / 100,
    quelle, fest: true, target: 'attr', attribute: def.key, newKey: def.key, newType: def.type, unit: def.unit ?? null, converted, error, why: '', inaktiv: !gruppeHier(def.key) }
  if (r.inaktiv) r.why = t_('Gruppe {0} gilt an diesem Knoten nicht', [def.group ?? ''])
  // ein Vorschlag unter der Schwelle der Zeilenregel (die erste Überschrift als Name) steht da, aber ohne Haken
  r.take = !r.error && !r.inaktiv && r.converted != null && sc >= 0.72
  return schonDa(listeZuordnen(r))
}
/// Spaltentabelle: die Zellen einer Zeile, getrennt durch zwei Leerzeichen oder Tab
const SPALTEN = /\s{2,}|\t/
const zellen = z => String(z ?? '').split(SPALTEN).map(x => x.trim()).filter(Boolean)
/// EAN-13 / GTIN: dreizehn Ziffern mit Prüfziffer
const gtin13 = s => /^\d{13}$/.test(s) && (10 - ([...s.slice(0, 12)].reduce((sum, d, i) => sum + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10 === Number(s[12])
const istKennung = (def, art) => (SYNONYMS[art] ?? []).includes(norm(def.key)) || (SYNONYMS[art] ?? []).includes(norm(def.label?.[model.value.masterLocale ?? 'de'] ?? ''))
/// Die Wertzeile zu einem Tabellenkopf: der Kopf ist oft umgebrochen („Typ  Artikelnummer“, dann „Verpackung“, „Karton“,
/// … je eine Zeile), die Werte kommen Zeilen später in einer Zeile mit genügend Zellen. Bis zwölf Zeilen voraus, dieselbe Seite
function wertzeileNach(alle, i, mindestens) {
  for (let k = i + 1; k <= i + 12 && k < alle.length; k++) {
    if (alle[k].page !== alle[i].page) return null
    const c = zellen(alle[k].z); if (c.length >= Math.max(3, mindestens)) return c
  }
  return null
}
const TYP_SPALTE = ['typ', 'type', 'bezeichnung', 'modell', 'model']
/// Kandidaten je Attribut aus dem Text: 1. Schlüssel  Wert in einer Zeile; 2. Spaltentabelle — der Attributname ist eine
/// Zelle eines Kopfs, der Wert steht in derselben Spalte der Wertzeile; 3. eine EAN mit Prüfziffer, irgendwo; 4. der Name aus
/// der Spalte „Typ“ einer Tabelle — die Typenbezeichnung eines Datenblatts. Die erste Überschrift war es nicht: die hiess „Gewicht“
function kandidatenFuer(def, alle) {
  const out = []
  for (const [i, x] of alle.entries()) {
    if (x.kv) { const sc = trifft(def, x.kv.key); if (sc >= 0.72) out.push({ kv: x.kv, page: x.page, sc }) }
    const c = zellen(x.z)
    if (c.length >= 2) {
      let werte = null
      c.forEach((zelle, j) => {
        const sc = trifft(def, zelle); const typ = istKennung(def, 'name') && TYP_SPALTE.includes(norm(zelle))
        if (sc < 0.72 && !typ) return
        werte ??= wertzeileNach(alle, i, c.length)
        if (werte?.[j]) out.push({ kv: { key: zelle, value: werte[j] }, page: x.page, sc: typ ? 0.85 : sc * 0.9 })
      })
    }
  }
  if (istKennung(def, 'ean')) for (const x of alle) for (const t of String(x.z).split(/\s+/)) if (gtin13(t)) out.push({ kv: { key: 'EAN', value: t }, page: x.page, sc: 1 })
  return out.sort((a, b) => b.sc - a.sc)
}
/// Stufe 1: je Attribut die Zeile, deren Schlüssel es trifft — oder die Spalte darunter, die EAN, die erste Überschrift.
/// Stufe 2: für den Rest die Suche im Dokument, im gefundenen Abschnitt die passendste Schlüssel/Wert-Zeile
async function ausZeilen(id, chunks) {
  const liste = attributeHier.value.filter(a => a.type !== 'html')
  if (!liste.length || !chunks?.length) return
  const alle = chunks.flatMap(c => String(c.body ?? '').split(/\r?\n/).map(z => z.trim()).filter(Boolean).map(z => ({ z, kv: kvZeile(z), page: c.page ?? null })))
  const neu = []; const offen = []
  const suchen = []
  for (const def of liste) {
    // die Kandidaten nach Treffer sortiert — der erste, der einen Wert ergibt, zählt: „Gewicht  pro Stk.“ trifft
    // genauso gut wie „Gewicht  pro Stk.  0,105 kg“, hat aber keine Zahl
    let z = null
    for (const k of kandidatenFuer(def, alle)) { z = wertZeile(def, id, k.kv, k.page, 'zeile', k.sc); if (z) break }
    if (z) neu.push(z); else offen.push(def)
  }
  zeilenWerte.value = [...zeilenWerte.value.filter(r => r.doc !== id), ...neu]
  entdoppeln()
  // Sinnsuche: Wörter und Vektoren — was der Server hat. Nur für das, was die Zeilen nicht fanden, und je Attribut eine Frage
  suchen.push(...offen.slice(0, 40)); schritte.value.gesamt += suchen.length
  let getan = 0, stop = false
  const eine = async def => {
    const q = def.label?.[model.value.masterLocale ?? 'de'] || L(def.label) || def.key
    let hits = []
    try { const r = await api.get(`/api/docs/search?q=${encodeURIComponent(q)}&mode=hybrid&under=${encodeURIComponent(props.node.id)}&limit=5`); if (r?.ready === false) { stop = true; return }; hits = (r?.hits ?? []).filter(h => h.media === id) } catch { stop = true; return }
    getan++; schritte.value.erledigt++
    // ab 0,6, und der Wert muss einer sein: „È“ oder „tc Punkt“ aus einem Tabellenkopf sind keiner
    const kandidaten = []
    for (const h of hits) for (const z of String(chunks.find(c => c.seq === h.seq)?.body ?? '').split(/\r?\n/)) { const kv = kvZeile(z); if (!kv) continue; const sc = trifft(def, kv.key); if (sc >= 0.6 && kv.value.length >= 2 && /[\p{L}\d]{2}/u.test(kv.value)) kandidaten.push({ kv, page: h.page ?? null, sc }) }
    let z = null
    for (const k of kandidaten.sort((a, b) => b.sc - a.sc)) {
      z = wertZeile(def, id, k.kv, k.page, 'suche', k.sc)
      if (z && z.listValues?.some(v => v.neu)) z = null   // die Suche schlägt einer Werteliste nichts Neues vor — ein Normen-Text als Satz wäre falsch
      if (z) break
    }
    if (z) neu.push(z)
  }
  // vier Abfragen zugleich; die Reihenfolge der Antworten ist egal, die Zeilen stehen nachher nach Attribut sortiert
  const reihe = [...suchen]
  await Promise.all(Array.from({ length: 4 }, async () => { while (reihe.length && !stop) await eine(reihe.shift()) }))
  schritte.value.erledigt += suchen.length - getan   // abgebrochen: der Rest zählt als erledigt, es kommt nichts mehr
  zeilenWerte.value = [...zeilenWerte.value.filter(r => r.doc !== id), ...neu]
  entdoppeln()
}

/// Der Text eines Dokuments für die KI: Abschnitte mit Seitenmarke, bis zur Grenze. Liefert Text und ob gekürzt wurde.
function textFuer(chunks) {
  let out = '', seite = null, gekuerzt = false
  for (const c of chunks) {
    const stueck = (c.page != null && c.page !== seite ? `\n[Seite ${c.page}]\n` : '') + (c.heading ? `${c.heading}\n` : '') + c.body + '\n'
    if (out.length + stueck.length > TEXT_MAX) { gekuerzt = true; break }
    out += stueck; seite = c.page ?? seite
  }
  return { text: out.trim(), gekuerzt }
}

/// Der Text gegen das Modell: die Attribute, die hier gelten, und der Text — die KI nennt Wert, Seite, Stelle, Sicherheit.
/// Was zu keinem Attribut passt, kommt als Bezeichnung/Wert und geht durch den Mapper — sonst fände sie an einem Knoten
/// mit drei Attributen drei Werte, während das Datenblatt zwanzig hat
async function lies(id, chunks) {
  const liste = attributeHier.value
  if (!chunks?.length) return
  const master = model.value.masterLocale ?? 'de'
  const { text, gekuerzt } = textFuer(chunks)
  if (gekuerzt) kiHinweis.value = t_('✦ nur die ersten {0} Zeichen gelesen', [TEXT_MAX])
  const frage = liste.map(a => {
    const list = a.type === 'enum' && a.list ? (model.value.lists ?? []).find(l => l.key === a.list) : null
    return `- ${a.key}: ${a.label?.[master] || L(a.label) || a.key} (${a.type}${a.unit ? ' ' + a.unit : ''})${list ? ` — erlaubt: ${list.values.map(v => v.value).join(' | ')}` : ''}`
  }).join('\n')
  const system = t_('Du liest ein technisches Dokument. Erstens: für jedes Attribut der Liste „Attribute“ der Wert, wenn er im Text steht. Zweitens: alle weiteren technischen Daten als Bezeichnung und Wert — auch aus Tabellen und Massangaben in Zeichnungen. Gibt es dafür schon ein Attribut in der Liste „Vorhandene Attribute“, nenne seinen Schlüssel in attribute und seine Bezeichnung in label — erfinde keine neue Bezeichnung für dieselbe Sache. Antworte NUR mit JSON: {"items":[{"key":"<Attributschlüssel>","value":"<Wert>","page":<Seitenzahl oder null>,"quote":"<die Stelle im Text, wörtlich, kurz>","confidence":0.0-1.0}],"more":[{"attribute":"<Schlüssel aus Vorhandene Attribute oder null>","label":"<Bezeichnung>","value":"<Wert mit Einheit>","page":<Seitenzahl oder null>,"quote":"<die Stelle, wörtlich, kurz>","confidence":0.0-1.0}]}. Nichts raten, nichts ableiten, nichts doppelt. In items: Zahlen ohne Einheit (die Einheit steht am Attribut), Datum als JJJJ-MM-TT, ja/nein als true/false, Listenwerte nur aus den erlaubten.')
  // Alle Attribute des Modells, kurz: die KI nennt den Schlüssel, wenn es die Sache schon gibt — sonst hiess „Lampenwattage“
  // beim zweiten Lauf „Lampenleistung“, und der Mapper fand es nicht (28.09.2026). Der Systemtext ist gecacht
  const vorhanden = attrs.value.map(a => `${a.key}: ${a.label?.[master] || L(a.label) || a.key}`).join('\n')
  // Die Attributliste steht im Systemtext: sie ist für jedes Dokument dieses Knotens dieselbe, der Server cacht sie —
  // nur der Text des Dokuments wechselt
  const user = `Dokument „${name(id)}“:\n${text}`
  const j = await ai.ask({ system: `${system}\n\nAttribute:\n${frage || '(keine)'}\n\nVorhandene Attribute:\n${vorhanden || '(keine)'}`, user, json: true, maxTokens: 4000, purpose: t_('Dokument lesen') })
  const neu = []
  const sicherheit = x => typeof x === 'number' ? Math.max(0, Math.min(1, x)) : null
  for (const it of j?.items ?? []) {
    const def = liste.find(a => a.key === it.key); if (!def || it.value == null || it.value === '') continue
    // die Einheit im Wert, obwohl keine verlangt war: „22 mm“ → 22, wenn das Modell die Einheit kennt
    const roh = String(it.value).trim(); const split = def.unit ? splitUnit(roh, model.value) : null
    const converted = convert(split?.number ?? roh, def, model.value); const error = validate(converted, def, model.value)
    // fest: die KI hat gegen genau dieses Attribut gelesen — das Ziel steht, kein Wähler
    const r = { key: def.label?.[master] || L(def.label) || def.key, value: roh, doc: id, page: it.page ?? null, heading: null, quote: it.quote ?? null,
      confidence: sicherheit(it.confidence), quelle: 'ki', fest: true,
      target: 'attr', attribute: def.key, newKey: def.key, newType: def.type, unit: def.unit ?? null, converted, error, why: '', inaktiv: !gruppeHier(def.key) }
    if (r.inaktiv) r.why = t_('Gruppe {0} gilt an diesem Knoten nicht', [def.group ?? ''])
    r.take = !r.error && !r.inaktiv && r.converted != null
    neu.push(schonDa(r))
  }
  // Weitere Daten: Bezeichnung/Wert wie eine Tabellenzeile — der Mapper sucht das Attribut im ganzen Modell oder schlägt ein neues vor
  const paare = (j?.more ?? []).filter(m => m?.label && m?.value != null && String(m.value).trim() !== '')
    .map(m => ({ key: String(m.label).trim(), value: String(m.value).trim(), doc: id, heading: null, page: m.page ?? null, quote: m.quote ?? null, confidence: sicherheit(m.confidence),
      genannt: attrs.value.find(a => a.key === String(m.attribute ?? '').trim())?.key ?? null }))
  if (paare.length) suggestPairs(paare, model.value, { role: props.node.role }).forEach((v, i) => {
    // Nennt die KI ein vorhandenes Attribut, gilt das — sie kannte die Liste. Sonst der Mapper, aber nur Schlüssel,
    // Bezeichnung, Synonym: ein reiner Ähnlichkeitstreffer („λ bei 50 Hz“ ≈ „Strom bei 50 Hz“) ist keiner
    if (paare[i].genannt) { const def = attrs.value.find(a => a.key === paare[i].genannt); Object.assign(v, { target: 'attr', attribute: def.key, why: t_('von der KI zugeordnet'), converted: convert(v.number ?? paare[i].value, def, model.value) }); v.error = validate(v.converted, def, model.value) }
    else if (v.target === 'attr' && /^ähnlich /.test(v.why ?? '')) Object.assign(v, { target: 'new', attribute: null, why: '', converted: convert(v.number ?? paare[i].value, { type: v.newType }, model.value), error: null })
    const r = listeZuordnen(listeRaten(einheitRaten({ ...paare[i], ...v, quelle: 'ki', fest: false })))
    if (r.target === 'attr' && !gruppeHier(r.attribute)) { r.why = t_('Gruppe {0} gilt an diesem Knoten nicht', [attrs.value.find(a => a.key === r.attribute)?.group ?? '']); r.inaktiv = true }
    r.take = r.target !== 'skip' && !r.error && !r.inaktiv && r.converted != null
    neu.push(schonDa(r))
  })
  kiZeilen.value = [...kiZeilen.value.filter(r => r.doc !== id), ...neu]
  entdoppeln()
}

/// Die Tabellen holen — und, wenn die KI da ist, den Text. Ein Dokument ohne Zustand ist noch nicht gelesen: einmal
/// den Job „Dokumente lesen“ anstossen und dann nachfragen, bis er fertig ist — der Job läuft im Hintergrund, der
/// Dialog wartet auf ihn, nicht der Anwender.
async function lade() {
  const offen = []
  for (const id of medien.value) {
    try {
      const r = await api.get(`/api/docs/${encodeURIComponent(id)}/tables`)
      if (r.ready === false) { hinweis.value = t_('Kein Dokumentindex — der Server läuft ohne Postgres'); warten.value = false; ki.value = ki.value === 'aus' ? 'aus' : 'fertig'; return }
      docs.value.set(id, r)
      if (!r.state) offen.push(id)
    } catch (e) { hinweis.value = e.message }
  }
  docs.value = new Map(docs.value)
  baue()
  // „wird gelesen“ meint den Job, nicht die KI: ist kein Dokument mehr offen, ist der Job durch — die KI hat ihr eigenes Zeichen
  if (!offen.length) warten.value = false
  await textLesen()
  if (!offen.length) return
  await anstossen()
  if (Date.now() - t0 > WARTEN_MS) { warten.value = false; hinweis.value = t_('{0} Dokumente sind noch nicht gelesen — der Job „Dokumente lesen“ holt sie nach', [offen.length]); return }
  timer = setTimeout(lade, TAKT_MS)
}
/// Je gelesenem Dokument einmal den Text holen: Textbausteine, Zeilen und Sinnsuche — ohne KI. Der Text bleibt für die
/// KI liegen, die erst auf Knopfdruck läuft
async function textLesen() {
  const faellig = medien.value.filter(id => docs.value.get(id)?.state === 'text' && !textGeholt.has(id))
  schritte.value.gesamt += faellig.length
  for (const id of faellig) {
    textGeholt.add(id)
    let chunks = []
    try { const r = await api.get(`/api/docs/${encodeURIComponent(id)}/text`); if (r.state === 'text') chunks = r.chunks ?? [] }
    catch (e) { hinweis.value = e.message; schritte.value.erledigt++; continue }
    texte.set(id, chunks); textZahl.value = texte.size
    bausteine(id, chunks)
    schritte.value.erledigt++
    await ausZeilen(id, chunks)
  }
}
/// Der Knopf: der Text jedes gelesenen Dokuments geht gegen das Modell — einmal je Dokument, kostet Token
const kiBereit = computed(() => ki.value !== 'aus' && ki.value !== 'läuft' && textZahl.value > 0)
async function kiFragen() {
  if (!kiBereit.value) return
  ki.value = 'läuft'; kiHinweis.value = ''
  try { for (const [id, chunks] of texte) await lies(id, chunks); ki.value = 'fertig' }
  catch (e) { ki.value = 'fehler'; kiHinweis.value = '✗ ' + e.message }
}
/// Noch einmal lesen: der Index kennt den Stand des Lesers von damals — ohne Tabellen, mit geklebten Zellen. Der Eintrag
/// im Index wird gelöscht, der Job liest das Dokument neu, der Dialog wartet wie beim ersten Mal
async function neuLesen() {
  if (busy.value) return
  busy.value = true
  try {
    for (const id of medien.value) await api.del(`/api/docs/${encodeURIComponent(id)}`)
    docs.value = new Map(); tabellenZeilen.value = []; zeilenWerte.value = []; kiZeilen.value = []; textZeilen.value = []; textGeholt.clear(); texte.clear(); textZahl.value = 0
    gestartet = false; warten.value = true; hinweis.value = ''; kiHinweis.value = ''; if (ki.value !== 'aus') ki.value = 'bereit'
    schritte.value = { gesamt: 0, erledigt: 0 }
    if (timer) { clearTimeout(timer); timer = null }
    await lade()
  } catch (e) { hinweis.value = e.message }
  finally { busy.value = false }
}
async function anstossen() {
  if (gestartet) return
  gestartet = true
  try {
    const jobs = await api.get('/api/jobs')
    const job = (Array.isArray(jobs) ? jobs : []).find(j => j.plugin === 'docs')
    if (!job) { hinweis.value = t_('Kein Job des Plugins „Dokumente lesen“'); return }
    await api.post(`/api/jobs/${encodeURIComponent(job.key)}/run`, {})
  } catch { /* läuft schon oder ist aus — der Zustand kommt mit der nächsten Abfrage */ }
}

/// Das Ziel einer Zeile als Schlüssel: Attribut oder neuer Schlüssel
const zielKey = r => r.target === 'attr' ? r.attribute : r.target === 'new' ? r.newKey : null
const gleich = (a, b) => String(a.converted ?? '') === String(b.converted ?? '')
/// Die anderen Zeilen mit demselben Ziel, deren Wert ein anderer ist — nur die sind ein Widerspruch
const widerspricht = r => { const k = zielKey(r); return k ? rows.value.filter(x => x !== r && zielKey(x) === k && !gleich(x, r)) : [] }
/// Nach dem Laden: bei verschiedenen Werten für ein Attribut trägt keine Zeile den Haken, jede nennt den anderen Wert.
/// Gleiche Werte bleiben angehakt — geschrieben wird dann einmal (uebernehmen)
function entdoppeln() {
  for (const r of rows.value) {
    const andere = widerspricht(r); if (!andere.length) continue
    r.take = false; r.why = '≠ ' + [...new Set(andere.map(x => x.converted))].join(', ')   // der Widerspruch wiegt mehr als der Grund des Mappers
  }
}
/// Der Anwender hakt eine Zeile an: die mit demselben Ziel und anderem Wert verlieren den Haken
function haken(r) {
  if (!r.take) return
  for (const x of widerspricht(r)) x.take = false
}

/// Der Anwender ändert das Ziel einer Zeile: ein vorhandenes Attribut, „neu“ oder nichts.
function ziel(r, v) {
  if (v === '') { r.target = 'skip'; r.take = false; return }
  if (r.baustein) {   // Ziel wechseln: neu, ein html-Attribut (der Text bleibt HTML) oder ein enum-Attribut (die Sätze gegen seine Liste)
    if (v === '+') { r.target = 'new'; r.attribute = null; r.inaktiv = false; r.why = ''; typBaustein(r); r.take = true; haken(r); return }
    const def = bausteinAttrs.value.find(a => a.key === v)
    r.target = 'attr'; r.attribute = v; r.inaktiv = !gruppeHier(v); r.take = !r.inaktiv
    r.why = r.inaktiv ? t_('Gruppe {0} gilt an diesem Knoten nicht', [def?.group ?? '']) : ''
    if (def?.type === 'enum') { alsListe(r, r.saetze, def); r.take = !r.inaktiv && !r.error }
    else { r.newType = 'html'; r.listValues = null; r.multiple = false; r.converted = alsHtml(r.value) }
    schonDa(r); haken(r); return
  }
  if (v === '+') { r.target = 'new'; r.inaktiv = false; r.vorhanden = null; r.gleich = false; r.converted = convert(r.number ?? r.value, { type: r.newType }, model.value); r.error = validate(r.converted, { type: r.newType }, model.value); r.take = !r.error && r.converted != null; r.why = t_('neu als {0}', [r.newType]); listeRaten(einheitRaten(r)); haken(r); return }
  const def = attrs.value.find(a => a.key === v)
  r.target = 'attr'; r.attribute = v; r.inaktiv = !gruppeHier(v); r.listValues = null; r.multiple = false
  r.converted = convert(r.number ?? r.value, def, model.value); r.error = validate(r.converted, def, model.value)
  r.take = !r.inaktiv && !r.error; r.why = r.inaktiv ? t_('Gruppe {0} gilt an diesem Knoten nicht', [def?.group ?? '']) : ''
  if (def?.type === 'enum') { listeZuordnen(r); r.take = !r.inaktiv && !r.error }
  schonDa(r); haken(r)
}
const zielWert = r => r.target === 'attr' ? r.attribute : r.target === 'new' ? '+' : ''

/// Die Quelle einer Zeile, kurz: ▦ Tabelle oder ✦ KI, Seite, Sicherheit — der Rest steht im Tooltip
const quelleText = r => [r.quelle === 'ki' ? '✦' : r.quelle === 'suche' ? '⌕' : '▦', [r.page != null ? t_('S. {0}', [r.page]) : '', r.confidence != null ? `${Math.round(r.confidence * 100)} %` : ''].filter(Boolean).join(' · ')].filter(Boolean).join(' ')
const quelleTitel = r => [mehrere.value ? name(r.doc) : '', r.quelle === 'ki' ? t_('von der KI im Text gefunden') : r.quelle === 'zeile' ? t_('aus einer Zeile im Text — ohne KI') : r.quelle === 'suche' ? t_('über die Suche im Dokument gefunden — ohne KI') : t_('aus einer Tabelle im Dokument'), r.heading, r.quote ? '„' + r.quote + '“' : ''].filter(Boolean).join('\n')

async function uebernehmen() {
  const liste = genommen.value; if (!liste.length) return
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  busy.value = true
  const master = model.value.masterLocale
  const heute = new Date().toISOString().slice(0, 10)
  try {
    // 1. Modell: die Gruppe, wenn sie neu ist; dann jedes neue Attribut einmal — Bezeichnung ist der Schlüssel aus dem Dokument
    const neu = new Map()
    for (const r of liste) if (r.target === 'new') neu.set(r.newKey, r)
    const gk = gruppeKey.value
    if (neu.size && !gk) { store.toast(t_('Gruppe ohne Namen')); busy.value = false; return }
    if (neu.size && !gruppen.value.some(g => g.key === gk))
      await api.post(`/api/model/groups/${encodeURIComponent(gk)}`, { key: gk, label: { [master]: gruppeName.value.trim() }, activeFrom: null }, 'PUT')
    arbeit.value = { text: t_('Attribute'), erledigt: 0, gesamt: neu.size }
    await reihum([...neu], async ([key, r]) => {
      if (attrs.value.some(a => a.key === key)) { store.toast(t_('Schlüssel {0} gibt es', [key])); arbeit.value.erledigt++; return }   // nie eine Definition überschreiben
      // eine Einheit, die das Modell nicht kennt, wird angelegt — Schlüssel ist das Symbol (ensureUnit)
      const unit = r.unit ? (r.unitNeu ? await ensureUnit(r.unit) : r.unit) : null
      // eine Werteliste: die Liste unter dem Schlüssel des Attributs, ihre Werte aus dem Dokument, dann das Attribut darauf
      if (r.newType === 'enum') {
        if (!(model.value.lists ?? []).some(l => l.key === key)) await api.post(`/api/model/lists/${encodeURIComponent(key)}`, { key, label: { [master]: r.key } }, 'PUT')
        await api.post(`/api/model/lists/${encodeURIComponent(key)}/values`, (r.listValues ?? []).map(v => ({ value: v.value, label: { [master]: v.label } })), 'PUT')
      }
      await api.post(`/api/model/attributes/${encodeURIComponent(key)}`, { key, label: { [master]: r.key }, type: r.newType, unit, group: gk, ...(r.newType === 'enum' ? { list: key, multiple: !!r.multiple } : {}), ...(r.baustein && r.newType === 'html' ? { axes: ['locale'] } : {}) }, 'PUT')   // die Sprachachse heisst axes, nicht perLocale
      arbeit.value.erledigt++
    })
    // 2. die Gruppe an die gewählte Ebene, wenn sie am Pfad noch nicht gilt — sonst gälte kein neues Attribut hier.
    // Eine Ebene darüber: erst lesen, was dort hängt — GroupsAttached ist die ganze Liste
    if (neu.size && !vonOben(gk)) {
      const ziel = ebene.value
      const dort = ziel === props.node.id ? (props.node.attachedGroups ?? []) : ((await api.get(`/api/nodes/${encodeURIComponent(ziel)}`)).attachedGroups ?? [])
      if (!dort.includes(gk)) await api.post(`/api/nodes/${encodeURIComponent(ziel)}/groups`, { groups: [...dort, gk] }, 'PUT')
    }
    // 2b. Sätze, die in einer vorhandenen Liste noch fehlen — einmal je Liste, vor dem Stapel
    const nachtrag = new Map()
    for (const r of liste) if (r.target === 'attr' && r.listValues?.some(v => v.neu)) { const def = (r.baustein ? bausteinAttrs.value : attrs.value).find(a => a.key === r.attribute); if (def?.list) { if (!nachtrag.has(def.list)) nachtrag.set(def.list, []); nachtrag.get(def.list).push(...r.listValues.filter(v => v.neu)) } }
    if (nachtrag.size) arbeit.value = { text: t_('Wertelisten'), erledigt: 0, gesamt: nachtrag.size }
    await reihum([...nachtrag], async ([lk, vs]) => {
      await api.post(`/api/model/lists/${encodeURIComponent(lk)}/values`, vs.map(v => ({ value: v.value, label: { [master]: v.label } })), 'PUT')
      arbeit.value.erledigt++
    })
    // 3. ein Stapel für die Werte — je Wert der Beleg dazu: das Dokument, die Seite, die Stelle. Zwei Zeilen mit
    // demselben Ziel und Wert (Tabelle und KI sagen dasselbe) schreiben einmal; die Werte sind sonst nicht in Einklang
    const einmal = []; const ziele = new Set()
    for (const r of liste) { const k = zielKey(r); if (ziele.has(k)) continue; ziele.add(k); einmal.push(r) }
    for (const r of einmal) if (widerspricht(r).some(x => x.take)) { store.toast(t_('{0}: zwei Werte', [r.key])); busy.value = false; return }
    const commands = einmal.flatMap(r => {
      const def = r.target === 'attr' ? (r.baustein ? bausteinAttrs.value : attrs.value).find(a => a.key === r.attribute) : null
      const attribute = r.target === 'new' ? r.newKey : r.attribute
      const locale = def?.perLocale || (r.baustein && r.target === 'new' && r.newType === 'html') ? master : null
      const note = [r.quote ? '„' + r.quote + '“' : r.heading, r.confidence != null ? t_('Sicherheit {0} %', [Math.round(r.confidence * 100)]) : null].filter(Boolean).join(' · ') || null
      // ein html-Attribut hat immer eine Sprache — auch neu angelegt (perLocale am Attribut)
      // mehrwertig geht als values, alles andere als value
      const mehrwertig = r.target === 'new' ? !!r.multiple : !!def?.multiple
      return [
        { op: 'attribute.set', args: { node: props.node.id, attribute, locale, channel: null, value: mehrwertig ? null : r.converted, values: mehrwertig ? (r.listValues ? r.listValues.map(v => v.value) : glieder(r.converted)) : null, row: null } },
        { op: 'value.source', args: { node: props.node.id, attribute, locale, source: name(r.doc), title: r.page != null ? t_('Seite {0}', [r.page]) : null, note, method: r.quelle === 'ki' ? 'ai' : 'import', checkedAt: heute } },
      ]
    })
    arbeit.value = { text: t_('Werte'), erledigt: 0, gesamt: einmal.length }
    const res = await api.post('/api/batch?skipErrors=true', { commands })
    arbeit.value.erledigt = einmal.length
    // gezählt werden die Werte, nicht die Belege — jeder zweite Befehl ist der Beleg zum ersten
    const n = (res.results ?? []).filter(x => x.index % 2 === 0).length
    for (const s of res.skipped ?? []) if (s.index % 2 === 0) store.toast(`${einmal[s.index / 2]?.key ?? s.index}: ${s.message}`)
    if (res.error) store.toast(res.error.message)
    if (n) store.toast(t_('{0} Werte aus dem Dokument übernommen', [n]) + (neu.size ? ' · ' + t_('{0} Attribute neu', [neu.size]) : ''), 'ok')
    emit('done')
  } catch (e) { store.toast(e.message) }
  finally { busy.value = false; arbeit.value = null }
}

function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(async () => {
  window.addEventListener('keydown', onKey)
  try { await store.poll(true) } catch {}   // Modell frisch: der zweite Lauf kennt die Attribute des ersten
  if (props.dateien.length) {
    hochladen.value = true
    try {
      const erg = await attachFiles(props.dateien, props.node.id, props.typen)
      for (const x of erg.fehler) hinweis.value = x
      medien.value = erg.medien.map(m => m.id); namen.value = Object.fromEntries(erg.medien.map(m => [m.id, m.name]))
    } catch (e) { hinweis.value = e.message }
    hochladen.value = false
    try { await store.poll(true) } catch {}   // die Knotenansicht zeigt das Medium
    if (!medien.value.length) { warten.value = false; return }
  }
  lade()
})
onUnmounted(() => { window.removeEventListener('keydown', onKey); if (timer) clearTimeout(timer) })
defineExpose({ rows, werte, bausteineZeilen, zeilenWerte, warten, hinweis, genommen, ki, kiHinweis, attributeHier, gruppe, gruppeName, ebene, zuordnen, neuLesen, kiFragen, ziel, schritte, medien, hochladen, bausteineSeiten, uebernehmen, arbeit })
</script>

<template>
  <!-- Kein Schliessen beim Klick daneben: hier stehen hundert Zeilen mit Haken, ein Fehlklick wirft die Arbeit weg -->
  <div class="dt-overlay">
    <div class="dt">
      <div class="toolbar">
        <h1 :title="$t('▦ aus Tabellen, ✦ von der KI im Text — gegen die Attribute, die hier gelten. Geschrieben wird erst mit ✓, je Wert mit Beleg.')">{{ $t("▦ Werte aus dem Dokument") + ' ' }}<span class="muted">· {{ anzahl }}<template v-if="mehrere">{{ ' ' + $t("· {0} Dokumente", [medien.length]) }}</template></span></h1>
        <span v-if="hochladen" class="lauf" :title="$t('Die Datei geht zum Server und wird an den Knoten gehängt')"><b class="unbestimmt"><i /></b><span class="muted">{{ $t("◌ wird hochgeladen …") }}</span></span>
        <span v-else-if="warten" class="lauf" :title="$t('Der Job „Dokumente lesen“ liest das Dokument gerade; die Zeilen erscheinen, sobald er fertig ist.')"><b class="unbestimmt"><i /></b><span class="muted">{{ $t("◌ wird gelesen …") }}</span></span>
        <span v-else-if="laeuft" class="lauf" :title="$t('{0} von {1} Abfragen — solange kommen Werte nach', [schritte.erledigt, schritte.gesamt])"><b><i :style="{ width: prozent + '%' }" /></b><span class="muted">{{ schritte.erledigt }}/{{ schritte.gesamt }}</span></span>
        <span v-if="ki === 'läuft'" class="ai" :title="$t('Der Text geht gegen die {0} Attribute, die hier gelten', [attributeHier.length])">{{ $t("✦ KI liest …") }}</span>
        <button v-else-if="ki !== 'aus'" class="x ai" :disabled="!kiBereit || busy" @click="kiFragen" :title="$t('Den Text gegen das Modell lesen lassen — einmal je Dokument, kostet Token')">{{ $t("✦ KI fragen") }}</button>
        <span v-else class="muted" :title="$t('Kein KI-Schlüssel am Team — es zählen Tabellen, Zeilen und Suche')">{{ $t("✦ aus") }}</span>
        <span v-if="kiHinweis" :class="kiHinweis.startsWith('✗') ? 'neg' : 'ai'">{{ kiHinweis }}</span>
        <span v-if="hinweis" class="neg">{{ hinweis }}</span>
        <span class="grow" />
        <button class="x" :disabled="busy" @click="neuLesen" :title="$t('Dokument noch einmal lesen — der Index kennt nur den Stand des Lesers von damals')">{{ $t("↻ neu lesen") }}</button>
        <button class="x" @click="emit('close')" :title="$t('schliessen (Esc)')">×</button>
      </div>
      <div class="dt-body scroll">
        <table class="grid" v-if="rows.length">
          <thead><tr>
            <th style="width:24px"></th>
            <th style="width:280px" :title="$t('die erste Spalte der Tabelle im Dokument — oder das Attribut, für das die KI eine Stelle fand')">{{ $t("Im Dokument") }}</th>
            <th :title="$t('▦ aus einer Tabelle, ✦ von der KI im Text — Seite und Sicherheit; die Stelle steht im Tooltip')">{{ $t("Quelle") }}</th>
            <th :title="$t('Attribut am Knoten — über Schlüssel, Bezeichnung oder Ähnlichkeit gefunden; „+ neu“ legt es an. Nach dieser Spalte sortiert.')">{{ $t("→ Attribut") + ' ↓' }}</th>
            <th :title="$t('Typ und Einheit eines neuen Attributs — aus dem Wert geraten, änderbar')">{{ $t("Typ") }}</th>
            <th :title="$t('der Wert, wie er geschrieben wird — Zahl ohne Einheit, Datum als JJJJ-MM-TT')">{{ $t("Wert") }}</th>
            <th></th>
          </tr></thead>
          <tbody>
            <tr v-for="(r, i) in werte" :key="r.quelle + i" class="row" :class="{ aus: !r.take, ki: r.quelle === 'ki' }">
              <td><input type="checkbox" v-model="r.take" :disabled="r.target === 'skip'" @change="haken(r)" /></td>
              <td :title="(r.heading ? r.heading + ' · ' : '') + (r.page ? $t('Seite {0}', [r.page]) : '') + '\n' + (r.quote || r.value)">{{ r.key }}<div class="muted roh">{{ r.quote || r.value }}</div></td>
              <td class="quelle" :class="r.quelle === 'ki' ? 'ai' : 'muted'" :title="quelleTitel(r)">{{ quelleText(r) }}</td>
              <td>
                <select v-if="!r.fest" :value="zielWert(r)" @change="ziel(r, $event.target.value)" style="width:260px">
                  <option value="">—</option>
                  <option value="+">{{ $t("+ neu: {0}", [r.newKey]) }}</option>
                  <option v-for="a in attrs" :key="a.key" :value="a.key">{{ $L(a.label) || a.key }}</option>
                </select>
                <span v-else :title="r.attribute">{{ $L(attrs.find(a => a.key === r.attribute)?.label) || r.attribute }}</span>
              </td>
              <td>
                <template v-if="r.target === 'new'">
                  <select v-model="r.newType" @change="typ(r)"><option v-for="ty in TYPEN" :key="ty" :value="ty">{{ ty }}</option></select>
                  <span v-if="r.newType === 'enum'" class="muted" :title="listeTitel(r)">{{ listeText(r) }}</span>
                  <select v-if="(units.length || r.unitNeu) && (r.newType === 'decimal' || r.newType === 'integer')" v-model="r.unit"><option :value="null">—</option><option v-if="r.unitNeu" :value="r.unit" :title="$t('neue Einheit — wird beim ✓ angelegt')">{{ r.unit }} +</option><option v-for="u in units" :key="u.key" :value="u.key">{{ u.key }}</option></select>
                </template>
                <span v-else-if="r.target === 'attr' && r.listValues" class="muted" :title="listeTitel(r)">{{ listeText(r) }}</span>
                <span v-else-if="r.target === 'attr'" class="muted">{{ attrs.find(a => a.key === r.attribute)?.type }}<template v-if="attrs.find(a => a.key === r.attribute)?.unit">{{ ' ' + attrs.find(a => a.key === r.attribute)?.unit }}</template></span>
              </td>
              <td><input type="text" v-model="r.converted" style="width:140px" /></td>
              <td class="muted" :class="{ neg: r.error || r.inaktiv, pos: r.gleich }" style="font-size:11px" :title="whyTitel(r)">{{ r.error || r.why }}</td>
            </tr>
          </tbody>
          <tbody v-if="bausteineZeilen.length" class="bausteine">
            <tr class="step"><td colspan="7" class="step-band" style="display:table-cell;height:24px" :title="$t('Abschnitte mit Überschrift, in der Reihenfolge des Dokuments — als html-Attribut an das Produkt, neu oder in ein bestehendes.')">{{ $t("▤ Textbausteine") + ' ' }}<span class="muted">· {{ bausteineZeilen.length }} · {{ $t("S. {0}–{1}", [bausteineSeiten[0], bausteineSeiten[1]]) }}</span></td></tr>
            <tr v-for="(r, i) in bausteineZeilen" :key="'b' + i" class="row" :class="{ aus: !r.take }">
              <td><input type="checkbox" v-model="r.take" :disabled="r.target === 'skip'" @change="haken(r)" /></td>
              <td :title="r.value">{{ r.key }}<div class="muted roh">{{ nurText(r.converted) }}</div></td>
              <td class="muted quelle" :title="mehrere ? name(r.doc) : ''">{{ r.page != null ? '▤ ' + $t('S. {0}', [r.page]) : '▤' }}</td>
              <td>
                <select :value="zielWert(r)" @change="ziel(r, $event.target.value)" style="width:260px">
                  <option value="">—</option>
                  <option value="+">{{ $t("+ neu: {0}", [r.newKey]) }}</option>
                  <option v-for="a in bausteinAttrs" :key="a.key" :value="a.key">{{ (a.type === 'html' ? '▤ ' : '≣ ') + ($L(a.label) || a.key) }}</option>
                </select>
              </td>
              <td>
                <select v-if="r.target === 'new'" v-model="r.newType" @change="typBaustein(r)" :title="$t('html: Absätze und Listen als Text · enum: die Sätze als Werteliste, am Produkt auswählbar')"><option value="html">html</option><option value="enum">enum</option></select>
                <span v-if="r.listValues" class="muted" :title="listeTitel(r)">{{ ' ' + listeText(r) }}</span>
                <span v-else-if="r.target === 'attr'" class="muted">html</span>
              </td>
              <td class="muted roh" :title="r.listValues ? listeTitel(r) : r.converted">{{ r.listValues ? r.listValues.map(v => v.label).join(' · ').slice(0, 60) : nurText(r.converted).slice(0, 60) }}</td>
              <td class="muted" :class="{ neg: r.inaktiv, pos: r.gleich }" style="font-size:11px" :title="whyTitel(r)">{{ r.why }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else-if="!warten && ki !== 'läuft'" class="empty">{{ $t("Kein Wert im Dokument gefunden") }}</div>
      </div>
      <div class="toolbar dt-foot">
        <template v-if="neueZeilen">
          <span class="muted nowrap" :title="$t('Die Gruppe, in die neue Attribute kommen — eine bestehende oder eine neue')">{{ $t("Neue Attribute →") }}</span>
          <select v-model="gruppe" style="width:200px"><option v-for="g in gruppen" :key="g.key" :value="g.key">▤ {{ $L(g.label) || g.key }}</option><option value="+">{{ $t("+ neue Gruppe") }}</option></select>
          <input v-if="gruppe === '+'" v-model="gruppeName" class="cell-input" style="width:140px" :placeholder="$t('Name der Gruppe')" />
          <template v-if="!gruppeGilt">
            <span class="muted">{{ $t("Ebene") }}</span>
            <select v-model="ebene" style="width:200px" :title="$t('Die Ebene, an die die Gruppe kommt — weiter oben gilt sie für alles darunter')"><option v-for="p in pfad" :key="p.id" :value="p.id">{{ icon(p.role) }} {{ p.label }}</option></select>
          </template>
        </template>
        <span class="grow" />
        <span v-if="arbeit" class="lauf" :title="$t('{0}: {1} von {2}', [arbeit.text, arbeit.erledigt, arbeit.gesamt])"><b><i :style="{ width: (arbeit.gesamt ? Math.round(arbeit.erledigt / arbeit.gesamt * 100) : 100) + '%' }" /></b><span class="muted">{{ arbeit.text }} {{ arbeit.erledigt }}/{{ arbeit.gesamt }}</span></span>
        <button @click="emit('close')">{{ $t("Abbrechen") }}</button>
        <button class="primary" :disabled="busy || !genommen.length" @click="uebernehmen">{{ $t("✓ {0} übernehmen", [genommen.length]) }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dt-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; z-index: 50; }
.dt { width: min(1500px, 96vw); max-height: min(820px, 92vh); background: var(--pane); border: 1px solid var(--line); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.nowrap { white-space: nowrap; }
.dt-body { flex: 1; min-height: 0; overflow: auto; padding: 8px; }
.dt-foot { border-top: 1px solid var(--line); gap: 8px; }
tr.aus td { opacity: .55; }
.roh { font-size: 11px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quelle { font-size: 11px; white-space: nowrap; }
.empty { padding: 24px; text-align: center; color: var(--muted); }
.lauf { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; white-space: nowrap; }
.lauf b { display: block; width: 120px; height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
.lauf b i { display: block; height: 100%; background: var(--accent); transition: width .3s; }
.lauf b.unbestimmt i { width: 35%; animation: lauf 1.2s linear infinite; }
@keyframes lauf { from { margin-left: -35%; } to { margin-left: 100%; } }
</style>
