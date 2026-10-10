// Verstehen (docs/pflegestruktur.md 44): aus einer Eingabe eine genaue Anfrage — Angaben, die Art, Wörter zum Ordnen. Ohne KI und gegen das
// Vokabular des Beraters (GET /api/advisor/{key}/vocabulary): seine Attribute mit Bezeichnungen, Einheiten und Listenwerten, die Wörter der
// Produktnamen. Vorher stand das im Server (AdvisorApi.Erkenne); journali wählt jetzt nur noch aus.
import { FUELLWOERTER, formen, ganz, weg, woerter } from './woerter.mjs'

/// Eigenschaftswörter je Grösse einer Einheit: „leicht“ ist wenig Masse, „gross“ viel Volumen, „hell“ viel Lichtstrom. Gebunden an die Grösse der
/// Einheit im Modell, nicht an ein Attribut. „wenig“ heisst die Hälfte der Treffer mit den kleineren Werten (op low), „viel“ die mit den grösseren (high)
export const EIGENSCHAFTEN = {
  mass: [['leicht', 'leichte', 'leichter', 'leichtes', 'leichten', 'leichteste', 'light', 'lightweight', 'lighter'], ['schwer', 'schwere', 'schwerer', 'schweres', 'heavy', 'heavier']],
  volume: [['klein', 'kleine', 'kleiner', 'kleines', 'small', 'smaller'], ['groß', 'große', 'großer', 'großes', 'gross', 'grosse', 'grosser', 'grosses', 'geräumig', 'large', 'big', 'bigger', 'roomy']],
  power: [['schwach', 'schwache', 'weak'], ['stark', 'starke', 'starker', 'leistungsstark', 'powerful', 'strong']],
  'luminous flux': [['dunkel'], ['hell', 'helle', 'heller', 'hellste', 'bright', 'brighter']],
}

// „leichter als 1.8 kg“ (09.10.2026): ein Vergleich mit Eigenschaftswort ist eine Grenze, kein Suchwort
const UNTER = ['bis zu', 'höchstens', 'hoechstens', 'maximal', 'max.', 'max', 'weniger als', 'kleiner als', 'leichter als', 'kürzer als', 'kuerzer als',
  'schmaler als', 'niedriger als', 'billiger als', 'günstiger als', 'guenstiger als', 'lighter than', 'shorter than', 'cheaper than', 'smaller than', 'unter', 'bis', 'up to', 'at most', 'less than', 'under', 'below', '<=', '<', '≤']
const UEBER = ['mindestens', 'mind.', 'mehr als', 'größer als', 'groesser als', 'schwerer als', 'länger als', 'laenger als', 'breiter als', 'höher als',
  'hoeher als', 'heavier than', 'longer than', 'wider than', 'larger than', 'über', 'ueber', 'ab', 'at least', 'more than', 'over', 'above', 'from', '>=', '>', '≥']
const NEIN = new Set(['nicht', 'ohne', 'kein', 'keine', 'not', 'no', 'without', 'non'])
const ZAHL_TYPEN = new Set(['integer', 'decimal'])

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const muster = l => [...new Set(l.filter(Boolean).map(x => x.toLowerCase()))].sort((a, b) => b.length - a.length).map(esc).join('|')
const istZahl = a => ZAHL_TYPEN.has(a.type)

/// Die Namen eines Attributs oder Werts: in der Sprache der Anfrage, deutsch, englisch
export function namen(x) {
  const l = x?.labels ?? {}
  return [...new Set([x?.label, l.de, l.en, ...Object.values(l)].filter(s => typeof s === 'string' && s.length > 0))]
}

/**
 * Angaben in einer Eingabe erkennen — ohne KI: eine Zahl mit Einheit nach „unter, bis, ab, über …“ wird ein Filter auf das Zahlenattribut mit dieser
 * Einheit (gibt es mehrere, entscheidet die Bezeichnung im Text, sonst keiner); ein Eigenschaftswort („leicht“) die Hälfte der Treffer an der
 * Grösse der Einheit; der Name eines Listenwerts ein Filter auf seine Liste (nur, wenn er genau ein Attribut trifft und dort genau einen Wert); die
 * Bezeichnung eines Ja/Nein-Attributs „ja“, mit „nicht, ohne, kein“ davor „nein“. Was erkannt ist, fällt aus dem Text; der Rest bleibt Suchwort.
 * @returns {{ angaben: {attribute: string, op: string, value: string}[], rest: string }}
 */
export function erkenne(vok, q) {
  const attr = (vok?.attributes ?? []).filter(a => a.facet)
  let rest = String(q ?? '')
  const aus = []
  const frei = a => aus.every(x => x.attribute !== a.key)

  // Zahlen mit Einheit
  const nachEinheit = new Map()
  for (const a of attr.filter(a => istZahl(a) && a.unit)) {
    const k = a.unit.toLowerCase()
    if (!nachEinheit.has(k)) nachEinheit.set(k, [])
    nachEinheit.get(k).push(a)
  }
  for (const gruppe of nachEinheit.values()) {
    const einheit = [gruppe[0].unit, ...(gruppe[0].unitLabels ?? [])]
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${muster([...UNTER, ...UEBER])})\\s*(\\d+(?:[.,]\\d+)?)\\s*(${muster(einheit)})(?![\\p{L}\\p{N}])`, 'giu')
    for (const m of [...rest.matchAll(re)].sort((x, y) => y.index - x.index)) {
      let defs = gruppe.filter(frei)
      if (defs.length > 1) defs = defs.filter(d => namen(d).some(n => ganz(q, n) >= 0))
      if (defs.length !== 1) continue
      const op = UNTER.includes(m[1].toLowerCase()) ? 'le' : 'ge'
      aus.push({ attribute: defs[0].key, op, value: m[2].replace(',', '.') })
      rest = weg(rest, m.index, m[0].length)
    }
  }

  // Eigenschaftswörter: am ersten Zahlenattribut, dessen Einheit diese Grösse misst
  for (const [groesse, [wenig, viel]] of Object.entries(EIGENSCHAFTEN)) {
    const def = attr.find(a => istZahl(a) && frei(a) && (a.quantity ?? '').toLowerCase() === groesse)
    if (!def) continue
    for (const [liste, op] of [[wenig, 'low'], [viel, 'high']]) {
      const wort = [...liste].sort((a, b) => b.length - a.length).find(x => ganz(rest, x) >= 0)
      if (wort) { aus.push({ attribute: def.key, op, value: wort.toLowerCase() }); rest = weg(rest, ganz(rest, wort), wort.length); break }
    }
  }

  // Werte von Listen: nur, was genau ein Attribut trifft und dort genau einen Wert
  const funde = []
  for (const def of attr.filter(a => a.type === 'enum' && Array.isArray(a.values) && frei(a))) {
    // ein Wert aus einem Zeichen (Grösse „M“) nur, wenn die Bezeichnung des Attributs im Text steht — sonst wäre jedes „a“ ein Filter
    const mitBezeichnung = namen(def).some(n => ganz(q, n) >= 0)
    for (const v of def.values) {
      const texte = [...namen(v), v.value].filter(x => (x.length >= 2 || (x.length === 1 && mitBezeichnung && /\p{L}/u.test(x))) && !/^\d+$/.test(x) && !FUELLWOERTER.has(x.toLowerCase()))
      const t = texte.find(x => ganz(rest, x) >= 0)
      if (t) funde.push({ def, wert: v.value, text: t })
    }
  }
  const jeAttribut = new Map()
  for (const f of funde) { if (!jeAttribut.has(f.def.key)) jeAttribut.set(f.def.key, []); jeAttribut.get(f.def.key).push(f) }
  for (const liste of jeAttribut.values()) {
    if (new Set(liste.map(x => x.wert)).size !== 1) continue
    const f = liste[0]
    if (funde.some(x => x.text.toLowerCase() === f.text.toLowerCase() && x.def.key !== f.def.key)) continue   // derselbe Name in zwei Listen
    aus.push({ attribute: f.def.key, op: 'eq', value: f.wert })
    const i = ganz(rest, f.text); if (i >= 0) rest = weg(rest, i, f.text.length)
  }

  // Ja/Nein: die Bezeichnung des Attributs, mit einer Verneinung davor „nein“
  for (const def of attr.filter(a => a.type === 'boolean' && frei(a)))
    for (const n of namen(def).filter(x => x.length >= 4)) {
      const i = ganz(rest, n); if (i < 0) continue
      const davor = /([\p{L}]+)\s*$/u.exec(rest.slice(0, i))
      const nein = !!davor && NEIN.has(davor[1].toLowerCase())
      aus.push({ attribute: def.key, op: 'eq', value: nein ? 'false' : 'true' })
      const start = nein ? davor.index : i
      rest = weg(rest, start, i + n.length - start)
      break
    }

  // die Bezeichnung eines erkannten Attributs („Grösse M“, „Breite bis 50 cm“) ist kein Suchwort
  for (const a of aus) {
    const def = attr.find(x => x.key === a.attribute)
    for (const n of namen(def)) for (let i = ganz(rest, n); i >= 0; i = ganz(rest, n)) rest = weg(rest, i, n.length)
  }
  return { angaben: aus, rest: rest.replace(/\s+/g, ' ').trim() }
}

/// Fragt die Eingabe nach einem Problem oder nach Pflege und Reparatur (10.10.2026)? „meine hose hat ein loch“, „reißverschluss klemmt“, „zelt
/// wird innen nass“, „wie wasche ich …“ — das ist keine Produktsuche, die Antwort steht in den Unterlagen. „für nasses Wetter“ ist kein Problem:
/// „nass“ zählt nur nach „ist“, „wird“, „sind“, „werden“.
const PROBLEM = new RegExp('(^|[^\\p{L}])(' + [
  'kaputt', 'defekt', 'loch', 'löcher', 'riss', 'risse', 'gerissen', 'reißt', 'reisst', 'zerrissen', 'undicht', 'leck', 'tropft', 'klemmt', 'hakt',
  'schimmel\\p{L}*', 'stockflecken', 'stinkt', 'riecht', 'abgebrochen', 'gebrochen', 'löst sich', 'loest sich', 'quietscht', 'scheuert', 'verfärbt',
  'eingelaufen', 'ausgeleiert', 'repar\\p{L}*', 'flick\\p{L}*', 'wasch\\p{L}*', 'wäsch\\p{L}*', 'imprägnier\\p{L}*', 'impraegnier\\p{L}*',
  'reinig\\p{L}*', 'nicht mehr', 'geht nicht', 'geht auf', 'geht ab', 'ist ab', 'funktioniert nicht', 'zündet nicht', 'verliert luft',
  '(ist|sind|wird|werden)( \\p{L}+){0,3} (nass|feucht)',
  'broken', 'hole', 'torn', 'ripped', 'leak\\p{L}*', 'stuck', 'repair\\p{L}*', 'fix', 'wash\\p{L}*', 'clean\\p{L}*', 'not working', 'gets wet', 'is wet',
].join('|') + ')(?=$|[^\\p{L}])', 'iu')
export function istProblem(q) { return PROBLEM.test(String(q ?? '').toLowerCase()) }

/// Ist die Eingabe eine Frage? Ein Fragezeichen oder ein Fragewort am Anfang („ist“, „hat“, „wie“, „welche“ …)
export function fragt(q) {
  const t = String(q ?? '').trim().toLowerCase()
  return t.endsWith('?') || /^(ist|sind|hat|haben|hält|haelt|wie|was|welche|welcher|welches|wieviel|kann|passt|gibt|taugt|eignet|is|are|does|do|has|how|what|which|can)\b/.test(t)
}

/// Die Wörter der Produktnamen, auch die Teile zusammengesetzter („multi-tool“ → „multi“, „tool“)
export function namenWoerter(vok) {
  const aus = new Set()
  for (const { word } of vok?.words ?? []) { aus.add(word); for (const t of word.split('-')) if (t.length >= 2) aus.add(t) }
  return aus
}

/// Steht ein Wort im Namen eines Produkts (am Anfang eines Worts, auch gebeugt)? Dann ist es die Art: „zelt“, „hose“, „akku“ (Akkuschrauber)
export function istArt(w, namenSet) {
  const f = formen(w)
  for (const n of namenSet) if (f.some(x => n.startsWith(x))) return true
  return false
}

/// Steht ein Wort im Namen dieses einen Produkts?
export function imNamen(w, name) {
  const teile = woerter(name).flatMap(t => [t, ...t.split('-')])
  return formen(w).some(f => teile.some(t => t.startsWith(f)))
}
