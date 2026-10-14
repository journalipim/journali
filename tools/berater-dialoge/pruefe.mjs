// Der Prüfstand des Produktberaters (docs/pflegestruktur.md 44): legt die Antwort des Kerns neben die Erwartung eines Dialogs und sagt, wo sie
// auseinandergehen. Ein Dialog ist eine Datei in tools/berater-dialoge/*.json; gespielt wird er mit spiele.mjs gegen eine Instanz.
//
// Ein Dialog: { "name", "locale"?, "schritte": [ { <eine Handlung>, "erwartet": { … }, "vorbild"?: "so würde ein Berater antworten" } ] }
// Handlungen: "eingabe": "zelt" · "klick": { art: "filter" | "weg" | "statt" | "neu", … } · "ablehnen": 1 (der n-te Treffer der letzten Antwort)
//             · "oeffne": 1 (der n-te Treffer — er ist danach im Blick)
// Erwartungen: siehe ERWARTUNGEN.

export const ERWARTUNGEN = {
  satz_enthaelt: 'der Satz der Antwort enthält diesen Text',
  frage_enthaelt: 'die Frage am Ende enthält diesen Text',
  hinweis_enthaelt: 'ein Hinweis (gelesen, nicht gefunden, übernommen …) enthält diesen Text',
  treffer_min: 'mindestens so viele Treffer',
  treffer_max: 'höchstens so viele Treffer',
  alle_treffer_enthalten: 'jeder gezeigte Treffer trägt diesen Text im Namen',
  erster_treffer_anders: 'der erste Treffer ist ein anderer als vor diesem Schritt',
  angaben: 'diese Angaben gelten (Attribut und Wert oder Vergleich)',
  keine_angaben: 'keine Angabe gilt',
  woerter: 'genau diese Wörter sind gesammelt',
  statt: 'der Berater fragt nach einem Themenwechsel (true) oder nicht (false)',
  ueber: 'die Antwort gilt dem Produkt im Blick',
  werte_enthalten: 'die Werte zum Produkt im Blick nennen diese Bezeichnungen (oder Schlüssel: „price“ gilt für „Preis (EUR)“ wie für „price“)',
  unterlagen_min: 'mindestens so viele Abschnitte aus den Unterlagen',
  unbekannt: 'diese Wörter stehen in keinem Produkt',
  korrigiert: 'diese Wörter hat der Berater anders gelesen ([von, zu])',
}

const text = x => String(x ?? '')
const enthaelt = (a, b) => text(a).toLowerCase().includes(text(b).toLowerCase())

/**
 * Vergleicht eine Antwort des Kerns mit einer Erwartung. `vorher`: die Antwort davor (für erster_treffer_anders).
 * @returns {string[]} die Abweichungen — leer, wenn alles passt
 */
export function pruefe(antwort, erwartet = {}, vorher = null) {
  const a = antwort ?? {}, t = a.texte ?? {}, hits = a.hits ?? [], aus = []
  const fehlt = (was, ist) => aus.push(`${was} — ist: ${ist}`)
  for (const k of Object.keys(erwartet)) if (!(k in ERWARTUNGEN)) aus.push(`unbekannte Erwartung „${k}“`)
  const e = erwartet
  if (e.satz_enthaelt !== undefined && !enthaelt(a.answer ?? t.satz, e.satz_enthaelt)) fehlt(`Satz mit „${e.satz_enthaelt}“`, `„${text(a.answer ?? t.satz)}“`)
  if (e.frage_enthaelt !== undefined && !enthaelt(t.frage, e.frage_enthaelt)) fehlt(`Frage mit „${e.frage_enthaelt}“`, `„${text(t.frage)}“`)
  if (e.hinweis_enthaelt !== undefined && !(t.hinweise ?? []).some(h => enthaelt(h, e.hinweis_enthaelt))) fehlt(`Hinweis mit „${e.hinweis_enthaelt}“`, JSON.stringify(t.hinweise ?? []))
  if (e.treffer_min !== undefined && (a.total ?? 0) < e.treffer_min) fehlt(`mindestens ${e.treffer_min} Treffer`, a.total ?? 0)
  if (e.treffer_max !== undefined && (a.total ?? 0) > e.treffer_max) fehlt(`höchstens ${e.treffer_max} Treffer`, a.total ?? 0)
  if (e.alle_treffer_enthalten !== undefined) {
    const falsch = hits.filter(h => !enthaelt(h.name, e.alle_treffer_enthalten)).map(h => h.name)
    if (!hits.length || falsch.length) fehlt(`jeder Treffer mit „${e.alle_treffer_enthalten}“ im Namen`, hits.length ? falsch.join(', ') : 'keine Treffer')
  }
  if (e.erster_treffer_anders && hits[0]?.id === vorher?.hits?.[0]?.id) fehlt('ein anderer erster Treffer', hits[0]?.name ?? 'keiner')
  for (const [attr, wert] of e.angaben ?? []) {
    const da = (a.filter ?? []).some(f => f.attribute === attr && (f.value === wert || f.op === wert || enthaelt(f.valueLabel, wert)))
    if (!da) fehlt(`Angabe ${attr} = ${wert}`, JSON.stringify((a.filter ?? []).map(f => [f.attribute, f.op, f.value])))
  }
  if (e.keine_angaben && (a.filter ?? []).length) fehlt('keine Angabe', JSON.stringify((a.filter ?? []).map(f => [f.attribute, f.value])))
  if (e.woerter !== undefined && JSON.stringify([...(a.words ?? [])].sort()) !== JSON.stringify([...e.woerter].sort())) fehlt(`Wörter ${JSON.stringify(e.woerter)}`, JSON.stringify(a.words ?? []))
  if (e.statt !== undefined && !!a.instead !== e.statt) fehlt(e.statt ? 'die Frage nach einem Themenwechsel' : 'keine Frage nach einem Themenwechsel', JSON.stringify(a.instead ?? null))
  if (e.ueber !== undefined && !!a.about !== e.ueber) fehlt(e.ueber ? 'eine Antwort zum Produkt im Blick' : 'keine Antwort zum Produkt im Blick', a.about ? a.about.name : 'eine Suche')
  for (const l of e.werte_enthalten ?? []) if (!(a.about?.values ?? []).some(v => enthaelt(v.label, l) || v.key === l)) fehlt(`Wert „${l}“`, JSON.stringify((a.about?.values ?? []).map(v => v.label)))
  if (e.unterlagen_min !== undefined && (a.docs ?? []).length < e.unterlagen_min) fehlt(`mindestens ${e.unterlagen_min} Abschnitte aus den Unterlagen`, (a.docs ?? []).length)
  if (e.unbekannt !== undefined && JSON.stringify([...(a.unknown ?? [])].sort()) !== JSON.stringify([...e.unbekannt].sort())) fehlt(`unbekannt ${JSON.stringify(e.unbekannt)}`, JSON.stringify(a.unknown ?? []))
  for (const [von, zu] of e.korrigiert ?? []) if (!(a.corrected ?? []).some(k => k.from === von && k.to === zu)) fehlt(`„${von}“ als „${zu}“ gelesen`, JSON.stringify(a.corrected ?? []))
  return aus
}

/// Was ein Schritt tut, als eine Zeile — für den Bericht
export function handlung(s) {
  if (s.eingabe !== undefined) return `„${s.eingabe}“`
  if (s.klick) return `Klick ${s.klick.art}${s.klick.attribute ? ` ${s.klick.attribute}=${s.klick.value}` : s.klick.word ? ` ${s.klick.word}` : ''}`
  if (s.ablehnen) return `Nicht das: Treffer ${s.ablehnen}`
  if (s.oeffne) return `Öffnen: Treffer ${s.oeffne}`
  return '?'
}

/// Der Satz, den der Berater gesagt hat — die Antwort der KI, sonst der Satz des Kerns, mit Hinweisen und Frage
export function gesagt(a) {
  const t = a?.texte ?? {}
  return [...(t.hinweise ?? []), t.ueber, a?.answer ?? t.satz, t.statt, t.frage].filter(Boolean).join(' ')
}
