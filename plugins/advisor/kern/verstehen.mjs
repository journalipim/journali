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
  // Zeit (14.10.2026): „schnell aufgebaut“ ist wenig Aufbauzeit, „lange warm“ viel Zeit — welches Zeitattribut, sagt seine Bezeichnung im Text
  time: [['schnell', 'schnelle', 'schneller', 'kurz', 'kurze', 'quick', 'quickly', 'fast'], ['lange', 'lang', 'länger', 'laenger', 'long', 'longer']],
}

// Zahlwörter (14.10.2026): „für zwei Personen“ — ab zwei, „ein“ und „one“ sind meist Artikel
const ZAHLWOERTER = { zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12,
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }
// Geld: ein Betrag gilt dem Attribut, dessen Bezeichnung die Währung nennt („Preis (EUR)“) — ohne Vergleichswort als Obergrenze („Jacke für 200 €“)
const WAEHRUNG = { '€': 'eur', euro: 'eur', eur: 'eur', '$': 'usd', dollar: 'usd', usd: 'usd', '£': 'gbp', pfund: 'gbp', gbp: 'gbp', chf: 'chf', franken: 'chf' }
// unter null Grad (14.10.2026): „für Minusgrade“, „bei Frost“ — höchstens 0 am Temperaturattribut
const FROST = ['minusgraden', 'minusgrade', 'minustemperaturen', 'unter null', 'unter dem gefrierpunkt', 'frost', 'below freezing', 'sub-zero', 'subzero', 'freezing']
// andere Wörter für die Bezeichnung eines Attributs: „zwei Leute“, „for two people“
const AUCH = { leute: 'personen', person: 'personen', menschen: 'personen', people: 'persons', person_en: 'persons' }

// „leichter als 1.8 kg“ (09.10.2026): ein Vergleich mit Eigenschaftswort ist eine Grenze, kein Suchwort
const UNTER = ['bis zu', 'höchstens', 'hoechstens', 'maximal', 'max.', 'max', 'weniger als', 'kleiner als', 'leichter als', 'kürzer als', 'kuerzer als',
  'schmaler als', 'niedriger als', 'billiger als', 'günstiger als', 'guenstiger als', 'lighter than', 'shorter than', 'cheaper than', 'smaller than', 'unter', 'bis', 'up to', 'at most', 'less than', 'under', 'below', '<=', '<', '≤']
const UEBER = ['mindestens', 'mind.', 'mehr als', 'größer als', 'groesser als', 'schwerer als', 'länger als', 'laenger als', 'breiter als', 'höher als',
  'hoeher als', 'heavier than', 'longer than', 'wider than', 'larger than', 'über', 'ueber', 'ab', 'at least', 'more than', 'over', 'above', 'from', '>=', '>', '≥']
const NEIN = new Set(['nicht', 'ohne', 'kein', 'keine', 'not', 'no', 'without', 'non'])
const ZAHL_TYPEN = new Set(['integer', 'decimal'])

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// die Grundform eines Eigenschaftsworts (15.10.2026): „leichtes“ → „leicht“, „lightweight“ → „light“ — die Angabe heisst „Gewicht: leicht“
// (nicht bei der Zeit: „lange warm“ ist ein Umstandswort, „lang“ wäre falsch)
const grundform = (wort, liste) => liste.filter(x => wort.toLowerCase().startsWith(x)).sort((a, b) => a.length - b.length)[0] ?? wort.toLowerCase()
// eine Zahl, auch negativ („-10“, „minus 10“)
const ZAHL = '((?:-|−|minus\\s*)?\\d+(?:[.,]\\d+)?)'
const zahlWert = s => s.replace(/^(?:−|minus\s*)/i, '-').replace(',', '.').replace(/\s+/g, '')
// gebeugt: „Litern“, „Personen“ → Liter, Person; nur bei Wörtern ab drei Zeichen
const gebeugt = t => t.length >= 3 && /\p{L}$/u.test(t) ? `${esc(t)}(?:n|en|s|e|er)?` : esc(t)
const einheitMuster = l => [...new Set(l.filter(Boolean).map(x => x.toLowerCase()))].sort((a, b) => b.length - a.length).map(gebeugt).join('|')

/// Zwei Wörter teilen einen Stamm: gleich nach den Endungen, oder eines beginnt das andere (ab fünf Zeichen); „aufgebaut“ trifft „Aufbauzeit“
/// (das „ge“ nach der Vorsilbe fällt weg)
export function stamm(a, b) {
  const s = w => { w = w.toLowerCase(); for (const e of ['ern', 'en', 'er', 'es', 'em', 'e', 'n', 's']) if (w.endsWith(e) && w.length - e.length >= 4) return w.slice(0, -e.length); return w }
  const ohneGe = w => w.replace(/^(auf|an|ab|aus|ein|mit|vor|zu|nach|um|durch)ge(?=\p{L}{3})/u, '$1').replace(/^ge(?=\p{L}{4})/u, '')
  const x = ohneGe(s(a)), y = ohneGe(s(b))
  if (x === y) return true
  const [k, l] = x.length <= y.length ? [x, y] : [y, x]
  if (k.length >= 5 && l.startsWith(k)) return true
  // ein gemeinsamer Anfang, der das kürzere Wort fast ganz ist („aufbaut“ – „aufbauzeit“)
  let i = 0; while (i < k.length && k[i] === l[i]) i++
  return i >= 5 && i >= k.length - 1
}

/// Steht die Bezeichnung (alle ihre Wörter) in der Eingabe — gebeugt, als Wortanfang („trinksystem“ in „Trinksystemvorbereitet“) oder
/// zusammengesetzt („helmkapuze“ für „Helmtaugliche Kapuze“)? Liefert die Stellen der getroffenen Wörter, sonst null.
export function bezeichnungIn(text, bezeichnung) {
  const ws = [...String(text).matchAll(/\p{L}[\p{L}\p{N}]*/gu)].map(m => ({ w: m[0].toLowerCase(), i: m.index, n: m[0].length }))
  const teile = String(bezeichnung).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 2 && !FUELLWOERTER.has(t))
  if (!teile.length) return null
  // ein Wort für zwei Teile: der Anfang des ersten und das ganze zweite („helm“ + „kapuze“)
  if (teile.length === 2)
    for (const x of ws) {
      const zweites = teile[1]
      if (x.w.length > zweites.length + 2 && x.w.endsWith(zweites) && teile[0].startsWith(x.w.slice(0, -zweites.length))) return [x]
    }
  const aus = []
  for (const t of teile) {
    const x = ws.find(y => !aus.includes(y) && (stamm(y.w, t) || (y.w.length >= 6 && t.startsWith(y.w))))
    if (!x) return null
    aus.push(x)
  }
  return aus
}
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
/// `vorhanden`: die Attribute der zuletzt gezeigten Produkte; `gesetzt`: die Attribute, die schon als Angabe gelten. Was mehrere Attribute meinen
/// kann und keines davon nennt („bis minus 10 grad“ bei Komfort-, Grenz- und Extremtemperatur), steht in `offen` — der Berater fragt nach.
export function erkenne(vok, q, { vorhanden = null, gesetzt = null } = {}) {
  const attr = (vok?.attributes ?? []).filter(a => a.facet)
  // Zahlwörter als Ziffern: „zwei Personen“ wie „2 Personen“
  q = String(q ?? '').replace(new RegExp(`(?<![\\p{L}])(${Object.keys(ZAHLWOERTER).join('|')})(?![\\p{L}])`, 'giu'), m => String(ZAHLWOERTER[m.toLowerCase()]))
  let rest = q
  const aus = [], offen = []
  const frei = a => aus.every(x => x.attribute !== a.key)
  const benannt = d => namen(d).some(n => ganz(q, n) >= 0 || bezeichnungIn(q, n))
  // Welches von mehreren Attributen? Das mit der Bezeichnung im Text; sonst das einzige, das die zuletzt gezeigten Produkte haben (14.10.2026)
  const eines = defs => {
    // gilt eines davon schon, meint die neue Zahl dieses („bis minus 10 grad“ nach „Komforttemperatur bis 0 °C“)
    const schon = gesetzt ? defs.filter(d => gesetzt.includes(d.key) && frei(d)) : []
    if (schon.length === 1) return schon[0]
    defs = defs.filter(frei)
    if (defs.length > 1) { const b = defs.filter(benannt); if (b.length) defs = b }
    if (defs.length > 1 && vorhanden) { const v = defs.filter(d => vorhanden.includes(d.key)); if (v.length) defs = v }
    return defs.length === 1 ? defs[0] : null
  }
  // mehrere passen, keines ist genannt: die Zahl merken, der Berater fragt, welches gemeint ist (höchstens vier zur Wahl)
  const mehrdeutig = (defs, op, value) => {
    let kandidaten = defs.filter(frei)
    if (vorhanden) { const v = kandidaten.filter(d => vorhanden.includes(d.key)); if (v.length) kandidaten = v }
    if (kandidaten.length < 2 || kandidaten.length > 4) return false
    offen.push({ op, value, attribute: kandidaten.map(d => d.key) })
    return true
  }

  // Zahlen mit Einheit
  const nachEinheit = new Map()
  for (const a of attr.filter(a => istZahl(a) && a.unit)) {
    const k = a.unit.toLowerCase()
    if (!nachEinheit.has(k)) nachEinheit.set(k, [])
    nachEinheit.get(k).push(a)
  }
  for (const gruppe of nachEinheit.values()) {
    // das Symbol und die Namen der Einheit, von einem Namen aus mehreren Wörtern auch das erste („Grad“ aus „Grad Celsius“)
    const einheit = [gruppe[0].unit, ...(gruppe[0].unitLabels ?? []).flatMap(l => [l, l.split(/\s+/)[0]])]
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${muster([...UNTER, ...UEBER])})\\s*${ZAHL}\\s*(${einheitMuster(einheit)})(?![\\p{L}\\p{N}])`, 'giu')
    for (const m of [...rest.matchAll(re)].sort((x, y) => y.index - x.index)) {
      const def = eines(gruppe)
      const op = UNTER.includes(m[1].toLowerCase()) ? 'le' : 'ge'
      if (!def) { if (mehrdeutig(gruppe, op, zahlWert(m[2]))) rest = weg(rest, m.index, m[0].length); continue }
      aus.push({ attribute: def.key, op, value: zahlWert(m[2]) })
      rest = weg(rest, m.index, m[0].length)
    }
    // ohne Vergleichswort (14.10.2026): eine ganze Zahl mit Einheit ist der Wert selbst („mit 30 Litern“) — Kommazahlen nicht („900 W“ ist ungefähr)
    const ganzzahlig = gruppe.filter(a => a.type === 'integer')
    if (!ganzzahlig.length) continue
    const ohne = new RegExp(`(?<![\\p{L}\\p{N}.,])${ZAHL}\\s*(${einheitMuster(einheit)})(?![\\p{L}\\p{N}])`, 'giu')
    for (const m of [...rest.matchAll(ohne)].sort((x, y) => y.index - x.index)) {
      if (/[.,]/.test(m[1])) continue
      const def = eines(ganzzahlig)
      if (!def) { if (mehrdeutig(ganzzahlig, 'eq', zahlWert(m[1]))) rest = weg(rest, m.index, m[0].length); continue }
      aus.push({ attribute: def.key, op: 'eq', value: zahlWert(m[1]) })
      rest = weg(rest, m.index, m[0].length)
    }
  }

  // Geld (14.10.2026): ein Betrag mit Währung gilt dem Zahlenattribut, dessen Bezeichnung die Währung nennt („Preis (EUR)“)
  // nennt keines eine Währung, das Zahlenattribut, das Preis heisst („price“ aus einem Import)
  const mitWaehrung = attr.filter(a => istZahl(a) && frei(a) && namen(a).some(n => /(\beur\b|€|\busd\b|\$|\bgbp\b|£|\bchf\b)/i.test(n)))
  const geld = mitWaehrung.length ? mitWaehrung
    : attr.filter(a => istZahl(a) && frei(a) && [a.key, ...namen(a)].some(n => /^(preis|price|kosten|cost|verkaufspreis|vk)\b/i.test(String(n).trim())))
  if (geld.length) {
    const reG = new RegExp(`(?<![\\p{L}\\p{N}])(?:(${muster([...UNTER, ...UEBER])})\\s*)?(?:(${muster(['€', '$', '£'])})\\s*)?${ZAHL}\\s*(${muster(Object.keys(WAEHRUNG))})?(?![\\p{L}\\p{N}])`, 'giu')
    for (const m of [...rest.matchAll(reG)].sort((x, y) => y.index - x.index)) {
      const waehrung = WAEHRUNG[(m[4] ?? m[2] ?? '').toLowerCase()]
      if (!waehrung) continue
      const def = eines(mitWaehrung.length ? geld.filter(a => namen(a).some(n => n.toLowerCase().includes(waehrung) || (waehrung === 'eur' && n.includes('€')))) : geld)
      if (!def) continue
      aus.push({ attribute: def.key, op: m[1] && UEBER.includes(m[1].toLowerCase()) ? 'ge' : 'le', value: zahlWert(m[3]) })
      rest = weg(rest, m.index, m[0].length)
    }
  }

  // eine Zahl vor der Bezeichnung eines Zahlenattributs ohne Einheit (14.10.2026): „für 2 Personen“, „mit 4 Taschen“, „ab 3 Personen“
  for (const def of attr.filter(a => a.type === 'integer' && !a.unit && frei(a))) {
    const bez = [...new Set(namen(def).flatMap(n => { const w = n.split(/[^\p{L}]+/u).filter(x => x.length >= 3); return w.length ? [w[w.length - 1]] : [] }))]
    const auch = Object.entries(AUCH).filter(([, ziel]) => bez.some(b => b.toLowerCase() === ziel)).map(([wort]) => wort.replace(/_en$/, ''))
    const alle = [...bez, ...auch]
    if (!alle.length) continue
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:(${muster([...UNTER, ...UEBER])})\\s*)?(\\d+)\\s*(${einheitMuster(alle)})(?![\\p{L}\\p{N}])`, 'giu')
    const m = re.exec(rest)
    if (!m || !frei(def)) continue
    aus.push({ attribute: def.key, op: !m[1] ? 'eq' : UNTER.includes(m[1].toLowerCase()) ? 'le' : 'ge', value: m[2] })
    rest = weg(rest, m.index, m[0].length)
  }

  // „Zelt für zwei“ ohne „Personen“ (15.10.2026): „für“ und eine Zahl bis zwölf, danach nichts, ein Satzzeichen oder „und, mit, in“ — gilt
  // dem Zahlenattribut ohne Einheit, das Personen zählt. „für 2 Tage“ bleibt, wie es ist.
  const personen = attr.filter(a => a.type === 'integer' && !a.unit && frei(a) && namen(a).some(n => /^(personen|persons|people|leute)$/i.test(n.trim())))
  if (personen.length === 1) {
    const m = /(?<![\p{L}\p{N}])(?:für|fuer|for)\s+(\d{1,2})(?=\s*(?:$|[,.;!?)]|(?:und|mit|in|and|with)(?![\p{L}])))/iu.exec(rest)
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) {
      aus.push({ attribute: personen[0].key, op: 'eq', value: m[1] })
      rest = weg(rest, m.index, m[0].length)
    }
  }

  // unter null Grad: höchstens 0 am Attribut, dessen Einheit Temperatur misst
  const kalt = attr.filter(a => istZahl(a) && frei(a) && ((a.quantity ?? '').toLowerCase() === 'temperature' || /°c|°f|grad|degree/i.test([a.unit, ...(a.unitLabels ?? [])].join(' '))))
  const frost = FROST.find(w => ganz(rest, w) >= 0)
  if (kalt.length && frost) {
    const def = eines(kalt)
    if (def) aus.push({ attribute: def.key, op: 'le', value: '0' })
    if (def || mehrdeutig(kalt, 'le', '0')) rest = weg(rest, ganz(rest, frost), frost.length)
  }

  // Eigenschaftswörter: am ersten Zahlenattribut, dessen Einheit diese Grösse misst
  for (const [groesse, [wenig, viel]] of Object.entries(EIGENSCHAFTEN)) {
    const kandidaten = attr.filter(a => istZahl(a) && frei(a) && (a.quantity ?? '').toLowerCase() === groesse)
    // mehrere (Zeit: Aufbauzeit, Hält warm, Leuchtdauer): das mit der Bezeichnung im Text, sonst das der gezeigten Produkte; bei Masse, Volumen,
    // Leistung, Licht wie bisher das erste
    // sonst das, das die Produkte der genannten Art haben („leichtes Zelt“: Gewicht, nicht die Zuladung eines Rucksacks), sonst das erste
    const def = groesse === 'time' ? eines(kandidaten)
      : (kandidaten.find(benannt) ?? (vorhanden ? kandidaten.find(d => vorhanden.includes(d.key)) : null) ?? kandidaten[0])
    if (!def) continue
    for (const [liste, op] of [[wenig, 'low'], [viel, 'high']]) {
      const wort = [...liste].sort((a, b) => b.length - a.length).find(x => ganz(rest, x) >= 0)
      if (wort) { aus.push({ attribute: def.key, op, value: groesse === 'time' ? wort.toLowerCase() : grundform(wort, liste) }); rest = weg(rest, ganz(rest, wort), wort.length); break }
    }
  }

  // Werte von Listen: nur, was genau ein Attribut trifft und dort genau einen Wert
  const funde = []
  for (const def of attr.filter(a => a.type === 'enum' && Array.isArray(a.values) && frei(a))) {
    // ein Wert aus einem Zeichen (Grösse „M“) nur, wenn die Bezeichnung des Attributs im Text steht — sonst wäre jedes „a“ ein Filter
    const mitBezeichnung = namen(def).some(n => ganz(q, n) >= 0)
    for (const v of def.values) {
      const texte = [...namen(v), v.value].filter(x => (x.length >= 2 || (x.length === 1 && mitBezeichnung && /\p{L}/u.test(x))) && !/^\d+$/.test(x) && !FUELLWOERTER.has(x.toLowerCase()))
      // die Zahl in einer Bezeichnung (14.10.2026): „in 43“ trifft „EU 43“ — ab zwei Ziffern, damit „2 Personen“ keine Grösse wird
      const zahlen = namen(v).flatMap(x => x.match(/\d+(?:[.,]\d+)?/g) ?? []).filter(z => z.replace(/\D/g, '').length >= 2)
      const t = texte.find(x => ganz(rest, x) >= 0) ?? [...new Set(zahlen)].find(z => ganz(rest, z) >= 0)
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

  // Ja/Nein: die Bezeichnung des Attributs, mit einer Verneinung davor „nein“. Seit 14.10.2026 auch gebeugt („wasserdichter Membran“), als
  // Wortanfang („mit Trinksystem“ → „Trinksystemvorbereitet“) und zusammengesetzt („helmkapuze“ → „Helmtaugliche Kapuze“)
  for (const def of attr.filter(a => a.type === 'boolean' && frei(a)))
    for (const n of namen(def).filter(x => x.length >= 4)) {
      let i = ganz(rest, n), laenge = n.length
      if (i < 0) {
        const stellen = bezeichnungIn(rest, n)
        if (!stellen) continue
        stellen.sort((a, b) => a.i - b.i)
        for (const s of stellen.slice(1).reverse()) rest = weg(rest, s.i, s.n)
        i = stellen[0].i; laenge = stellen[0].n
      }
      const davor = /([\p{L}]+)\s*$/u.exec(rest.slice(0, i))
      const nein = !!davor && NEIN.has(davor[1].toLowerCase())
      aus.push({ attribute: def.key, op: 'eq', value: nein ? 'false' : 'true' })
      const start = nein ? davor.index : i
      rest = weg(rest, start, i + laenge - start)
      break
    }

  // die Bezeichnung eines erkannten Attributs („Grösse M“, „Breite bis 50 cm“) ist kein Suchwort — auch gebeugt („aufgebaut“ für „Aufbauzeit“,
  // „warm hält“ für „Hält warm“, 14.10.2026)
  for (const a of aus) {
    const def = attr.find(x => x.key === a.attribute)
    for (const n of namen(def)) {
      for (let i = ganz(rest, n); i >= 0; i = ganz(rest, n)) rest = weg(rest, i, n.length)
      const stellen = bezeichnungIn(rest, n)
      if (stellen) for (const s of [...stellen].sort((x, y) => y.i - x.i)) rest = weg(rest, s.i, s.n)
    }
  }
  return { angaben: aus, rest: rest.replace(/\s+/g, ' ').trim(), offen }
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
