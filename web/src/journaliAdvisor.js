// journali advisor (18.10.2026, docs/todo-journali-advisor.md): beantwortet Fragen zur Bedienung — zuerst „Wie mache ich …?“ aus der Hilfe.
// Die Kapitel kommen als fertiges HTML aus /help/<code>/ wie im Hilfefenster; hier werden sie in Abschnitte (h2, h3) zerlegt und mit einer
// Wortsuche befragt. Mit der KI des Teams schreibt er aus den gefundenen Abschnitten eine kurze Antwort mit Verweisen [H1]. Er läuft ganz in
// der Oberfläche, ohne eigenen Dienst; die KI fragt er wie „✦ KI“ im Editor über den Server.
import { i18n, DEFAULT_LANG, t } from './i18n.js'
import { store } from './store.js'
import { ai } from './ai.js'

const ENTITAETEN = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }
/// HTML als lesbarer Text: ohne Tags, die üblichen Entitäten aufgelöst, Leerraum zusammengefasst
export const klartext = h => String(h ?? '').replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENTITAETEN[e]).replace(/\s+/g, ' ').trim()

/// Ein Kapitel in Abschnitte: die Einleitung bis zur ersten Überschrift, dann je h2 und h3 einer — { slug, kapitel, titel, text, ebene }.
/// Was nur mit Lizenz gilt, fällt in der Startphase weg, was nur in der Startphase gilt, sonst (wie im Hilfefenster)
export function abschnitte(slug, kapitel, html, startphase = false) {
  const h = String(html ?? '').replace(startphase ? /<div class="nur-lizenz">[\s\S]*?<\/div>\n?/g : /<div class="nur-startphase">[\s\S]*?<\/div>\n?/g, ' ')
  const aus = []
  for (const teil of h.split(/(?=<h[23][\s>])/i)) {
    const m = /^<h([23])[^>]*>([\s\S]*?)<\/h\1>/i.exec(teil)
    const text = klartext(m ? teil.slice(m[0].length) : teil.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, ''))
    if (text) aus.push({ slug, kapitel, titel: m ? klartext(m[2]) : kapitel, text, ebene: m ? Number(m[1]) : 1 })
  }
  return aus
}

// Wörter, die eine Frage stellen, aber nichts suchen
const FUELL = new Set(('wie mache macht machen mach tue tun ich du man wir sie es er kann kannst koennen können muss soll sollte will möchte moechte geht ' +
  'wo finde findet finden warum wieso weshalb wann was wer welche welcher welches ist sind wird werden wurde war hat habe haben gibt ' +
  'der die das den dem des ein eine einen einem einer eines und oder mit für fuer von zu zum zur im in auf aus bei nach über ueber unter vom ' +
  'mir mich mein meine meinen dir dich sich nicht kein keine noch schon bitte hier da dann so auch nur als wenn dass denn mal etwas alle jetzt ' +
  'how do does i you we where why when what which who is are can the a an to of in on for with my it this that').split(' '))
// abtrennbare Vorsilben: „lege … an“ sucht „anlegen“
const PARTIKEL = new Set(['an', 'ab', 'auf', 'aus', 'ein', 'zu', 'um', 'vor', 'nach', 'zurück', 'zurueck', 'weg', 'hin', 'her', 'fest', 'frei', 'mit', 'dazu', 'hinzu',
  'hoch', 'herunter', 'runter', 'raus', 'rein'])
// Wörter, die Anwender sagen, und die, mit denen die Hilfe es beschreibt (Schlüssel und Werte als Stamm) — journali löscht nicht, es zieht zurück
const NACHBARN = {
  export: ['ausleit', 'publikation', 'ausgabe'], freigeb: ['freigabe'], übersetz: ['sprache', 'xliff'], bild: ['medien', 'medium', 'asset'],
  foto: ['bild', 'medien', 'medium'], passwort: ['kennwort', 'anmeld'], kost: ['preis', 'tarif', 'lizenz'], preis: ['tarif', 'lizenz'],
  tastenkürzel: ['tastatur', 'taste'], shortcut: ['tastatur', 'taste'], lösch: ['zurückzieh', 'zurückgezogen'], entfern: ['zurückzieh'],
  backup: ['sicherung'], recht: ['rolle'], benutzer: ['anwender'], user: ['anwender'], nutzer: ['anwender'], feld: ['attribut'],
  merkmal: ['attribut'], eigenschaft: ['attribut'], kategorie: ['gruppe', 'klassifikation'], artikel: ['produkt'], sku: ['variante'],
  rückgängig: ['stapel', 'zurück'], historie: ['journal', 'version'], verlauf: ['journal'], suche: ['such'], filter: ['sicht'],
}

const norm = s => String(s ?? '').toLowerCase().replace(/ß/g, 'ss')
export const woerter = s => norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
/// Der Stamm ohne die häufigsten Endungen — nur, wenn mindestens drei Zeichen bleiben
export function stamm(w) {
  for (const e of ['ierungen', 'ierung', 'ieren', 'ierte', 'iert', 'iere', 'ungen', 'ung', 'en', 'er', 'es', 'st', 'e', 'n', 's', 't'])
    if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length)
  return w
}

/// Die Begriffe einer Frage: Wort, Stamm, die Nachbarwörter und — mit einer Vorsilbe im Satz — die Verbindung („an“ + „leg“)
export function begriffe(q) {
  const ws = woerter(q), vorsilben = ws.filter(w => PARTIKEL.has(w)), aus = []
  for (const w of ws) {
    if (FUELL.has(w) || PARTIKEL.has(w) || w.length < 2) continue
    const s = stamm(w)
    if (aus.some(b => b.s === s)) continue
    const verbunden = vorsilben.map(p => p + s)
    const nachbar = x => Object.entries(NACHBARN).filter(([k]) => x.startsWith(k)).flatMap(([, v]) => v)
    // die Nachbarn des Worts zählen wie das Wort, die der Verbindung („freigeb“ → „freigabe“) wie die Verbindung
    aus.push({ w, s, nachbarn: [...nachbar(s), ...nachbar(w)], mit: [...verbunden, ...verbunden.flatMap(nachbar)] })
  }
  return aus
}
/// Trifft das Wort selbst (oder ein Nachbar)?
const trifftWort = (b, tok) => tok === b.w || tok === b.s || (b.s.length >= 4 && tok.startsWith(b.s)) || (b.s.length >= 5 && tok.includes(b.s))
  || b.nachbarn.some(x => tok.startsWith(x))
/// … oder nur die Verbindung mit einer Vorsilbe („lege … an“ → „anlegen“)?
const trifftVerbunden = (b, tok) => b.mit.some(x => x.length >= 3 && tok.startsWith(x))
const trifft = (b, tok) => trifftWort(b, tok) || trifftVerbunden(b, tok)
/// Wie stark ein Wort trifft: gleich oder gebeugt 1, als Teil eines längeren Worts („produkt“ in „produktberatung“) 0,5
const staerke = (b, tok) => !trifft(b, tok) ? 0 : (tok === b.w || tok === b.s || tok.length - b.s.length <= 3 || b.mit.some(x => tok.startsWith(x) && tok.length - x.length <= 3)) ? 1 : 0.5

const TOKEN = new WeakMap()
const tokens = a => { let t = TOKEN.get(a); if (!t) { t = { titel: woerter(a.titel), kapitel: woerter(a.kapitel), text: woerter(a.text) }; TOKEN.set(a, t) } return t }

/// Ein Auszug um die erste Fundstelle — höchstens etwa 240 Zeichen
export function auszug(text, bs, laenge = 240) {
  const tief = norm(text)
  const pos = Math.min(...bs.map(b => tief.indexOf(b.s.length >= 3 ? b.s : b.w)).filter(i => i >= 0), Infinity)
  if (!Number.isFinite(pos) || pos < 80) return text.length > laenge ? text.slice(0, text.lastIndexOf(' ', laenge) > 0 ? text.lastIndexOf(' ', laenge) : laenge) + ' …' : text
  const von = text.lastIndexOf(' ', pos - 60) + 1
  const stueck = text.slice(von, von + laenge)
  return '… ' + (von + laenge < text.length ? stueck.slice(0, stueck.lastIndexOf(' ') > 0 ? stueck.lastIndexOf(' ') : stueck.length) + ' …' : stueck)
}

/**
 * Die Abschnitte zu einer Frage, die besten zuerst: je Begriff zählt ein Treffer in der Überschrift 3, im Kapitelnamen 1,5, im Text 1 (mehrfach
 * etwas mehr) — gewichtet mit der Seltenheit des Begriffs in der Hilfe: „Attribut“ sagt mehr als „anlegen“, das in vielen Abschnitten steht.
 * Das Kapitel der Ansicht, in der man steht, bekommt einen kleinen Vorsprung. Liefert höchstens `n`, jeden mit Auszug; was weniger als 40 %
 * des besten erreicht, fällt weg.
 */
export function suche(q, liste, { kapitel = '', n = 4 } = {}) {
  const bs = begriffe(q)
  if (!bs.length || !liste.length) return []
  const treffer = liste.map(a => {
    const tk = tokens(a)
    const best = l => l.reduce((m, x) => Math.max(m, x), 0)
    return bs.map(b => ({ titel: best(tk.titel.map(x => staerke(b, x))), kapitel: best(tk.kapitel.map(x => staerke(b, x))), text: tk.text.reduce((n, x) => n + staerke(b, x), 0) }))
  })
  // Seltenheit je Begriff: in wie vielen Abschnitten er vorkommt. Trifft ein Begriff nur über die Vorsilbe, ist er ein Verb („lege … an“) — er
  // zählt halb: bei „Wie lege ich ein Attribut an?“ geht es um das Attribut, nicht um das Anlegen irgendeines Dings
  const gewicht = bs.map((b, i) => {
    const df = treffer.filter(t => t[i].titel || t[i].kapitel || t[i].text).length
    const verb = b.mit.length && !liste.some(a => { const tk = tokens(a); return tk.titel.some(x => trifftWort(b, x)) || tk.text.some(x => trifftWort(b, x)) })
    return (Math.log((liste.length + 1) / (df + 1)) + 0.1) * (verb ? 0.5 : 1)
  })
  const bewertet = []
  liste.forEach((a, j) => {
    let punkte = 0
    treffer[j].forEach((t, i) => { punkte += gewicht[i] * (t.titel * 3 + t.kapitel * 1.5 + (t.text ? Math.min(t.text, 1) + Math.min(Math.max(t.text - 1, 0), 4) * 0.25 : 0)) })
    if (punkte <= 0) return
    if (kapitel && a.slug === kapitel) punkte += 0.5
    bewertet.push({ a, punkte })
  })
  if (!bewertet.length) return []
  bewertet.sort((x, y) => y.punkte - x.punkte)
  return bewertet.filter(x => x.punkte >= bewertet[0].punkte * 0.4).slice(0, n).map(x => ({ ...x.a, auszug: auszug(x.a.text, bs) }))
}

// ---- die Kapitel laden — einmal je Sprache und Startphase

let vorrat = { schluessel: '', liste: [] }
/// Alle Abschnitte der Hilfe in der Sprache der Oberfläche, sonst deutsch; was nur mit Lizenz gilt, fällt in der Startphase weg
export async function ladeHilfe(holen = (...a) => fetch(...a)) {
  for (const code of [...new Set([i18n.global.locale.value, DEFAULT_LANG])]) {
    try {
      const r = await holen(`/help/${code}/index.json`)
      if (!r.ok) continue
      const schluessel = code + '|' + !!store.startphase
      if (vorrat.schluessel === schluessel && vorrat.liste.length) return vorrat.liste
      const index = (await r.json()).filter(k => !(store.startphase && k.lizenz))
      const teile = await Promise.all(index.map(async k => {
        try { const h = await holen(`/help/${code}/${encodeURIComponent(k.slug)}.html`); return h.ok ? abschnitte(k.slug, k.title, await h.text(), !!store.startphase) : [] }
        catch { return [] }
      }))
      vorrat = { schluessel, liste: teile.flat() }
      return vorrat.liste
    } catch { /* nächste Sprache */ }
  }
  return []
}
export const vorratLeeren = () => { vorrat = { schluessel: '', liste: [] } }

// ---- die Antwort der KI

/// Die Bitte an die KI: nur aus den Abschnitten, mit Verweisen — erfundene Menüs und Knöpfe wären schlimmer als keine Antwort
export const KI_SYSTEM = 'Du bist der journali advisor, der Assistent für die Bedienung von journali, einem PIM-System. Beantworte die Frage ' +
  'ausschliesslich aus den nummerierten Abschnitten der Hilfe. Fragt jemand nach einem Vorgehen, antworte mit kurzen nummerierten Schritten. ' +
  'Nenne die Abschnitte, aus denen du antwortest, mit ihrer Nummer, etwa [H1]. Steht die Antwort nicht in den Abschnitten, sag das in einem Satz. ' +
  'Erfinde keine Menüs, Knöpfe oder Funktionen. Antworte in der Sprache der Frage, knapp, ohne Einleitung.'

export async function kiAntwort(q, treffer) {
  const user = `Frage: ${q}\n\nAbschnitte der Hilfe:\n` + treffer.map((a, i) => `[H${i + 1}] ${a.kapitel}${a.ebene > 1 ? ' › ' + a.titel : ''}\n${a.text.slice(0, 1500)}`).join('\n\n')
  return String(await ai.ask({ system: KI_SYSTEM, user, maxTokens: 1500, purpose: t('Hilfe') }) ?? '').trim()
}

/// Eine Frage: die Abschnitte und — mit KI — die Antwort daraus. `kapitel`: das Kapitel der Ansicht, in der man steht
export async function frage(q, { kapitel = '', holen } = {}) {
  const treffer = suche(q, await ladeHilfe(holen), { kapitel })
  let antwort = null, warnung = null
  if (treffer.length && ai.available()) {
    try { antwort = await kiAntwort(q, treffer) || null } catch (e) { warnung = e.message }
  }
  return { treffer, antwort, warnung }
}
