// Der Kern des Beraters (docs/pflegestruktur.md 44, 09.10.2026): der Berater versteht, journali wählt aus. Der Kern macht aus einer Eingabe eine
// genaue Anfrage an journali (Vokabular, Auswahl, Unterlagen, KI — /api/advisor/{key}/…), führt das Gespräch und setzt die Antwort zusammen.
// Er läuft im Dienst an der Website und in journali als Kindprozess (Vorschau) — beide reichen ihm nur eine Funktion herein, die journali fragt.
//
// Das Gedächtnis eines Gesprächs liegt hier, im Arbeitsspeicher, 30 Minuten nach der letzten Eingabe weg: Wörter und Angaben (woher: gesagt,
// geklickt, KI, übernommen), Vorlieben über einen Themenwechsel, gesehene und abgelehnte Produkte, das Produkt im Blick, der Verlauf. Die Kennung
// eines Gesprächs ist zufällig und trägt keine Person; ohne Kennung (ein Agent über MCP) steht jede Frage für sich. Nichts davon geht ins Journal.
import { woerter, gleichesWort, korrektur, ganz, weg } from './woerter.mjs'
import { erkenne, fragt, namenWoerter, istArt, imNamen } from './verstehen.mjs'
import { texte, angabeText } from './texte.mjs'
import { stellen, genau } from './stellen.mjs'
import { grundwissen, fragtShop } from './wissen.mjs'
import { erstelleAssoziationen } from './assoziationen.mjs'

export const DAUER = 30 * 60_000
export const MAX_WOERTER = 12
export const MAX_VERLAUF = 6
export const MAX_GESPRAECHE = 20_000
export const MAX_ABGELEHNT = 50
const KENNUNG = /^[A-Za-z0-9_-]{8,64}$/

const fehler = r => Object.assign(new Error(r.json?.error ?? `journali: HTTP ${r.status}`), { status: r.status, json: r.json })
const gleich = (a, b) => a.attribute === b.attribute && a.op === b.op && String(a.value) === String(b.value)
const nurAngabe = ({ attribute, op, value }) => ({ attribute, op, value })
const gleicheMenge = (a, b) => a.length === b.length && a.every(x => b.includes(x))

// Eine Frage zu den gezeigten Produkten (09.10.2026): Wörter, die auf sie zeigen, suchen nichts; wer „gibt es …“ fragt, sucht
const BEZUG = new Set(['diese', 'dieser', 'dieses', 'diesen', 'beide', 'beiden', 'alle', 'allen', 'denn', 'davon', 'eigentlich', 'jeweils', 'genau',
  'wirklich', 'these', 'those', 'they', 'them', 'both', 'all', 'each', 'really', 'actually'])
const SUCHT = /^(gibt es|gibts|habt ihr|haben sie|hast du|führt ihr|fuehrt ihr|is there|are there|do you have|have you got)(?![\p{L}])/iu
// Verben, die nach einem Wert fragen, dessen Bezeichnung nicht in der Frage steht: „wie viel wiegen die?“ → Gewicht
const NACH_WERT = { wiegt: 'gewicht', wiegen: 'gewicht', weigh: 'weight', weighs: 'weight', kostet: 'preis', kosten: 'preis', teuer: 'preis', cost: 'price', costs: 'price' }
// Eine Frage nach dem Sortiment (09.10.2026): „was verkauft ihr?“, „welche Artikel habt ihr im Angebot?“ — besteht die Eingabe nur aus solchen
// Wörtern (nach den Füllwörtern), nennt der Berater die Gruppen des Publikationsbaums
const ALLGEMEIN = new Set(['verkauft', 'verkaufen', 'verkaufst', 'führt', 'fuehrt', 'führen', 'fuehren', 'bietet', 'bieten', 'anbieten', 'angebot', 'angeboten',
  'sortiment', 'artikel', 'produkte', 'produkt', 'waren', 'sachen', 'alles', 'alle', 'katalog', 'euch', 'eigentlich', 'denn', 'überhaupt', 'ueberhaupt',
  'gibts', 'shop', 'laden', 'sell', 'selling', 'offer', 'products', 'product', 'items', 'range', 'catalog', 'catalogue', 'stuff', 'everything', 'all',
  'carry', 'store'])

/**
 * @param {{ journali: (pfad: string, body?: any, kopf?: Record<string, string>) => Promise<{status: number, json: any}>, jetzt?: () => number,
 *           lernen?: { notiere: (art: string, daten: any) => void } | null, vokabularDauer?: number,
 *           assoziationen?: Record<string, Record<string, string[]>> }} o — assoziationen: je Sprache Stichwort → Wörter, sonst die Grundausstattung
 */
export function erstelleKern(o) {
  const journali = o.journali
  const jetzt = o.jetzt ?? Date.now
  const lernen = o.lernen ?? null
  const assoz = erstelleAssoziationen(o.assoziationen ?? null)
  const MAX_ASSOZ = 6
  const gespraeche = new Map()
  const vokabeln = new Map()
  let aufrufe = 0

  /// Das Vokabular je Sprache, gemerkt; nach vokabularDauer fragt der Kern mit dem ETag nach (304: unverändert)
  async function vokabular(locale) {
    const k = locale || ''
    const alt = vokabeln.get(k)
    if (alt && jetzt() - alt.am < (o.vokabularDauer ?? 30_000)) return alt
    const r = await journali('vocabulary' + (locale ? '?locale=' + encodeURIComponent(locale) : ''), undefined, alt ? { 'if-none-match': alt.vok.etag } : {})
    if (r.status === 304 && alt) { alt.am = jetzt(); return alt }
    if (r.status !== 200) throw fehler(r)
    const neu = { vok: r.json, am: jetzt(), namen: namenWoerter(r.json) }
    neu.namen4 = new Set([...neu.namen].filter(w => w.length >= 4 && !/^\d+$/.test(w)))
    vokabeln.set(k, neu)
    return neu
  }

  function neuerZustand() {
    return { woerter: [], angaben: [], verlauf: [], fokus: null, fokusName: null, statt: null, vorlieben: {}, abgelehnt: [], gesehen: [], art: [], zuletzt: [], gruppe: null, assoz: {}, am: jetzt() }
  }

  /// Das Gespräch zu einer Kennung — ohne gültige Kennung eines, das nicht gemerkt wird
  function hole(id) {
    if (++aufrufe % 100 === 0) for (const [k, z] of gespraeche) if (jetzt() - z.am > DAUER) gespraeche.delete(k)
    if (typeof id !== 'string' || !KENNUNG.test(id)) return { z: neuerZustand(), id: null }
    let z = gespraeche.get(id)
    if (!z || jetzt() - z.am > DAUER) {
      z = neuerZustand()
      if (gespraeche.size >= MAX_GESPRAECHE) gespraeche.delete(gespraeche.keys().next().value)
      gespraeche.set(id, z)
    }
    z.am = jetzt()
    return { z, id }
  }

  /// Eine Angabe setzen: eine neue ersetzt die alte zum selben Attribut (gleicher Vergleich, oder die neue ist ein Wert). Gesagtes und Geklicktes wird
  /// eine Vorliebe — ausser „leicht“, das gilt nur unter den Treffern einer Art
  function setze(z, a) {
    z.angaben = z.angaben.filter(y => !(y.attribute === a.attribute && (y.op === a.op || a.op === 'eq')))
    z.angaben.push(a)
    if (a.op !== 'low' && a.op !== 'high' && a.quelle !== 'vorliebe') z.vorlieben[a.attribute] = { ...a }
  }

  const teile = (ws, namen) => ({ art: ws.filter(w => istArt(w, namen)), weich: ws.filter(w => !istArt(w, namen)) })

  async function waehle(z, loc, a) {
    const r = await journali('select', {
      // ein gesammeltes Wort mit Assoziationen ordnet über deren Wörter („winter“ → kalt, frost)
      art: a.art ?? [], ordnen: [...new Set((a.ordnen ?? []).flatMap(w => z.assoz?.[w] ?? [w]))], angaben: (a.angaben ?? z.angaben).map(nurAngabe), satz: a.satz ?? '', locale: loc,
      take: a.take ?? 6, lockern: a.lockern ?? false, probe: a.probe ?? false, hinten: z.abgelehnt, ...(a.fokus ? { fokus: a.fokus } : {}),
      // die Gruppe des Sortiments, die der Besucher gewählt hat — eine Probe für einen Themenwechsel fragt ohne sie (gruppe: null)
      ...((a.gruppe !== undefined ? a.gruppe : z.gruppe?.key) ? { gruppe: a.gruppe !== undefined ? a.gruppe : z.gruppe.key } : {}),
    })
    if (r.status !== 200) throw fehler(r)
    return r.json
  }

  async function unterlagen(loc, a) {
    const r = await journali('docs', { satz: a.satz ?? '', art: a.art ?? [], locale: loc, ...(a.fokus ? { fokus: a.fokus } : {}) })
    return r.status === 200 ? r.json : { docs: [], warning: r.json?.error ?? null }
  }

  async function kiText(loc, a) {
    const r = await journali('ki', { auftrag: 'antwort', locale: loc, ...a })
    return r.status === 200 ? r.json : { text: null, warning: r.json?.error ?? null }
  }

  const quellen = docs => (docs ?? []).map(u => ({ quelle: [u.name, u.heading, u.node?.label].filter(Boolean).join(' · '), text: u.text }))

  /// Ein Produkt, wie es der Besucher öffnet — mit allen Werten und Texten; null, wenn journali es nicht liefert
  async function produkt(pid, loc) {
    const r = await journali('product/' + encodeURIComponent(pid) + '?locale=' + encodeURIComponent(loc))
    return r.status === 200 ? r.json : null
  }

  /// Was eine Frage sucht: ihre Wörter ohne die, die auf Produkte zeigen, und die Attribute, die sie nennt („schwer“ → Gewicht)
  function wonach(vok, namen, eingabe) {
    const ws = woerter(eingabe).filter(w => !BEZUG.has(w))
    const art = ws.filter(w => istArt(w, namen))
    const frage = ws.filter(w => !art.includes(w))
    const suchwoerter = frage.map(w => NACH_WERT[w] ?? w)
    const verwandt = [...new Set(suchwoerter.flatMap(w => assoz.zu(w, vok.locale)))].filter(x => !suchwoerter.includes(x))
    return { art, frage, suchwoerter, verwandt, attribute: erkenne(vok, eingabe).angaben.map(a => a.attribute) }
  }

  /// Eine Frage zu den Produkten der letzten Antwort: „sind die wasserdicht?“, „wie schwer ist das Skare?“ — je Produkt, was in seinen Werten
  /// und Texten dazu steht; mit KI ein Text daraus. Die gesammelten Angaben bleiben, wie sie sind.
  async function zuDenTreffern(z, id, loc, T, eingabe, ki, vok, liste, w) {
    const produkte = await Promise.all(liste.map(p => produkt(p.id, loc)))
    const antworten = liste.map((p, i) => ({ id: p.id, name: produkte[i]?.name ?? p.name, values: produkte[i] ? stellen(produkte[i], { woerter: w.suchwoerter, attribute: w.attribute, verwandt: w.verwandt }) : [] }))
    const gefunden = antworten.filter(a => a.values.length)
    // nichts bei den gezeigten, und das Gefragte steht in keinem Produkt des Sortiments („wer ist bundeskanzler?“): keine Frage zu ihnen
    if (!gefunden.length && !w.attribute.length) {
      const probe = await waehle(z, loc, { art: [], ordnen: [...w.suchwoerter, ...w.verwandt], angaben: [], probe: true, take: 1, gruppe: null })
      if ((probe.words ?? []).every(x => x.n === 0)) return null
    }
    let answer = null, warning = null
    if (vok.ki && ki && gefunden.length) {
      const k = await kiText(loc, { satz: eingabe, treffer: liste.map(p => p.id), verlauf: z.verlauf.slice(-MAX_VERLAUF),
        unterlagen: gefunden.map(a => ({ quelle: a.name, text: a.values.map(v => `${v.label}: ${v.value}`).join('\n') })) })
      answer = k.text ?? null; warning = k.warning ?? null
    }
    z.verlauf = [...z.verlauf, eingabe].slice(-MAX_VERLAUF)
    const wort = w.frage.join(' ')
    return {
      gespraech: id, locale: loc, total: 0, hits: [], facets: [], antworten, docs: [], answer, warning, corrected: [],
      // nennt keine Stelle das Gefragte selbst, sagt der Satz, dass es Hinweise sind (09.10.2026)
      texte: { satz: !gefunden.length ? T.zuDenNichts(wort) : genau(gefunden.flatMap(a => a.values)) ? T.zuDen(wort, liste.length) : T.zuDenHinweise(wort), nichts: T.ueberNichts, hinweise: [] },
    }
  }

  /// Bezeichnungen aus dem, was journali geprüft hat: was es nicht gibt, fällt weg; woher die Angabe kam, bleibt
  function uebernimmBezeichnungen(z, echo) {
    z.angaben = (echo ?? []).map(f => ({ ...f, quelle: z.angaben.find(a => gleich(a, f))?.quelle ?? 'gesagt' }))
    for (const a of z.angaben) if (z.vorlieben[a.attribute] && gleich(z.vorlieben[a.attribute], a)) z.vorlieben[a.attribute] = { ...a }
  }

  /// Eine Frage zum Produkt im Blick: seine Werte, seine Unterlagen und — mit KI — ein Text dazu. Die gesammelten Angaben bleiben, wie sie sind.
  async function zumFokus(z, id, loc, T, eingabe, ki, vok, namen) {
    const sel = await waehle(z, loc, { fokus: z.fokus, satz: eingabe, take: 1 })
    const d = await unterlagen(loc, { satz: eingabe, fokus: z.fokus })
    // nennen die Bezeichnungen der Werte nichts dazu, stehen die Stellen vielleicht in einem Wert oder in der Beschreibung
    let hinweisWort = null
    if (!(sel.focus?.values ?? []).length) {
      const p = await produkt(z.fokus, loc)
      if (p) {
        const w = wonach(vok, namen, eingabe)
        const values = stellen(p, { woerter: w.suchwoerter, attribute: w.attribute, verwandt: w.verwandt })
        sel.focus = { id: z.fokus, name: p.name ?? z.fokusName, values }
        if (values.length && !genau(values) && w.frage.length) hinweisWort = w.frage.join(' ')
      }
    }
    let answer = null, warning = sel.warning ?? d.warning ?? null
    if (vok.ki && ki) {
      const k = await kiText(loc, { satz: eingabe, fokus: z.fokus, verlauf: z.verlauf.slice(-MAX_VERLAUF), unterlagen: quellen(d.docs) })
      answer = k.text ?? null; warning = warning ?? k.warning ?? null
    }
    z.verlauf = [...z.verlauf, eingabe].slice(-MAX_VERLAUF)
    const about = sel.focus ?? { id: z.fokus, name: z.fokusName, values: [] }
    return {
      gespraech: id, locale: loc, total: 0, hits: [], facets: [], about, docs: d.docs ?? [], answer, warning, corrected: [],
      texte: { ueber: hinweisWort ? T.ueberHinweise(hinweisWort, about.name) : T.ueber(about.name), satz: about.values.length || answer ? null : T.ueberNichts, frage: T.alleAngaben, hinweise: [] },
    }
  }

  /**
   * Eine Eingabe oder ein Klick. `schritt`: { art: 'neu' } · { art: 'filter', attribute, op, value } · { art: 'weg', kind: 'word', word } ·
   * { art: 'weg', kind: 'filter', attribute, op, value } · { art: 'weg', kind: 'gruppe' } · { art: 'statt' } · { art: 'ablehnen', id, name } ·
   * { art: 'gruppe', key, label } (eine Gruppe des Sortiments)
   */
  async function antworte({ gespraech = null, q = '', schritt = null, locale = null, ki = true, take = 6 } = {}) {
    const { z, id } = hole(gespraech)
    const { vok, namen, namen4 } = await vokabular(locale)
    const loc = vok.locale
    const T = texte(loc)
    let eingabe = String(q ?? '').trim().slice(0, 300)
    const hinweise = [], corrected = [], unknown = [], uebernommen = []
    let warning = null

    // ---- Klicks: ändern die gesammelten Angaben, eine Suche folgt
    if (schritt?.art === 'neu') {
      Object.assign(z, { woerter: [], angaben: [], verlauf: [], fokus: null, fokusName: null, statt: null, art: [], zuletzt: [], gruppe: null, assoz: {} })   // Vorlieben, Gesehenes und Abgelehntes bleiben
      if (!eingabe) return { gespraech: id, locale: loc, reset: true, texte: { satz: T.neu, hinweise: [] } }
    } else if (schritt?.art === 'filter' && schritt.attribute) {
      setze(z, { attribute: String(schritt.attribute), op: ['le', 'ge', 'low', 'high'].includes(schritt.op) ? schritt.op : 'eq', value: String(schritt.value ?? ''), quelle: 'geklickt' })
    } else if (schritt?.art === 'gruppe' && typeof schritt.key === 'string') {
      // eine Gruppe des Sortiments: ein neues Thema in dieser Gruppe — Vorlieben, Gesehenes und Abgelehntes bleiben
      Object.assign(z, { woerter: [], angaben: [], fokus: null, fokusName: null, statt: null, art: [], gruppe: { key: schritt.key.slice(0, 80), label: String(schritt.label ?? '').slice(0, 120) } })
    } else if (schritt?.art === 'weg' && schritt.kind === 'gruppe') {
      z.gruppe = null
    } else if (schritt?.art === 'weg') {
      if (schritt.kind === 'word') z.woerter = z.woerter.filter(w => w !== schritt.word)
      else { z.angaben = z.angaben.filter(a => !gleich(a, schritt)); if (z.vorlieben[schritt.attribute] && gleich(z.vorlieben[schritt.attribute], schritt)) delete z.vorlieben[schritt.attribute] }
    } else if (schritt?.art === 'statt' && z.statt) {
      z.woerter = [...z.statt.words]
      z.angaben = z.statt.filter.map(a => ({ ...a, quelle: 'gesagt' }))
      z.verlauf = z.verlauf.slice(-1)   // nur die Eingabe, die das neue Thema gebracht hat
      z.statt = null
      z.gruppe = null   // die Probe für den Wechsel fragte ohne Gruppe
    } else if (schritt?.art === 'ablehnen' && typeof schritt.id === 'string') {
      if (!z.abgelehnt.includes(schritt.id)) z.abgelehnt = [...z.abgelehnt, schritt.id].slice(-MAX_ABGELEHNT)
      if (schritt.name) hinweise.push(T.abgelehnt(String(schritt.name).slice(0, 120)))
      lernen?.notiere('abgelehnt', { woerter: z.woerter, id: schritt.id })
    }

    // ---- eine Frage zum Produkt im Blick: „ist das zelt wasserdicht?“ — nur, wenn die Eingabe eine Frage ist und keine andere Art nennt
    if (eingabe && z.fokus && fragt(eingabe) && woerter(eingabe).filter(w => istArt(w, namen)).every(w => imNamen(w, z.fokusName ?? '')))
      return await zumFokus(z, id, loc, T, eingabe, ki, vok, namen)

    // ---- das Grundwissen (kern/wissen.mjs): Gruss, Dank, wer der Berater ist, was er kann — und Fragen zum Shop statt zu Produkten
    const sortiment = (satz, hinweise = [], nachsatz = null) => ({ gespraech: id, locale: loc, total: vok.products ?? 0, hits: [], facets: [], sortiment: vok.groups ?? [],
      texte: { satz, hinweise, nachsatz } })
    if (eingabe && !schritt) {
      const g = grundwissen(eingabe)
      if (g?.sortiment) return sortiment(T[g.key], [], (vok.groups ?? []).length ? T.nachsatzGruppen : null)
      if (g) return { gespraech: id, locale: loc, kurz: true, texte: { satz: T[g.key], hinweise: [] } }
      if (fragtShop(woerter(eingabe), w => istArt(w, namen))) return sortiment(T.helfen((vok.groups ?? []).length > 0), [T.service])
    }

    // ---- eine Frage nach dem Sortiment: die Gruppen des Publikationsbaums, ein Klick grenzt auf eine ein
    if (eingabe && !schritt) {
      const ws = woerter(eingabe)
      if (ws.length && ws.every(w => ALLGEMEIN.has(w)))
        return sortiment((vok.groups ?? []).length ? T.sortiment(vok.products ?? 0, vok.groups.length) : T.sortimentOhne(vok.products ?? 0))
    }

    // ---- eine Frage zu den Produkten der letzten Antwort: „sind die wasserdicht?“ — keine andere Art, und sie fragt nach etwas
    if (eingabe && !schritt && z.zuletzt.length && fragt(eingabe) && !SUCHT.test(eingabe)) {
      const w = wonach(vok, namen, eingabe)
      const liste = z.zuletzt.filter(p => w.art.every(a => imNamen(a, p.name)))
      if (liste.length && (w.frage.length || w.attribute.length)) {
        const r = await zuDenTreffern(z, id, loc, T, eingabe, ki, vok, liste, w)
        if (r) return r
        return { ...sortiment(T.helfen((vok.groups ?? []).length > 0), [], T.andereFragen), total: 0 }
      }
    }

    // ---- die Eingabe ergänzt die gesammelten Angaben: erkannte Angaben werden Filter, der Rest Wörter
    const hatteVorher = z.woerter.length > 0 || z.angaben.length > 0
    const neueAngaben = []
    let neueWoerter = []
    if (eingabe) {
      const e = erkenne(vok, eingabe)
      let rest = e.rest
      for (const a of e.angaben) { setze(z, { ...a, quelle: 'gesagt' }); neueAngaben.push(a) }
      // mit KI: was die Regeln nicht erkannt haben, übersetzt sie in Angaben — nur aus dem Vokabular, von journali geprüft
      if (vok.ki && ki && woerter(rest).length) {
        const r = await journali('ki', { auftrag: 'angaben', satz: rest, verlauf: z.verlauf.slice(-MAX_VERLAUF), locale: loc })
        if (r.status === 200) {
          for (const a of r.json.angaben ?? []) if (!z.angaben.some(y => y.attribute === a.attribute)) { setze(z, { ...a, quelle: 'ki' }); neueAngaben.push(a) }
          for (const n of r.json.names ?? []) for (let i = ganz(rest, n); i >= 0; i = ganz(rest, n)) rest = weg(rest, i, n.length)
          warning = r.json.warning ?? null
        }
      }
      neueWoerter = woerter(rest).filter(w => !z.woerter.some(x => gleichesWort(x, w)))   // gebeugte Formen zählen einmal
      z.woerter = [...z.woerter, ...neueWoerter].slice(-MAX_WOERTER)
    }

    // ---- auswählen: die Art grenzt ein, die übrigen Wörter ordnen, der Satz ordnet mit
    const sinnSatz = () => [...z.woerter.filter(w => !eingabe.toLowerCase().includes(w)), eingabe].join(' ').trim()
    let { art, weich } = teile(z.woerter, namen)
    let sel = await waehle(z, loc, { art, ordnen: weich, satz: sinnSatz(), lockern: true, take })

    // Wörter, die in keinem Produkt stehen: ein Tippfehler wird zum nächsten Wort eines Namens; sonst ordnet ein Wort mit Assoziationen über
    // deren Wörter, die im Sortiment stehen, und bleibt als Angabe stehen („winter“ → kalt, frost); sonst wird das Wort genannt und nicht
    // gesammelt. Der Tippfehler geht vor: „zeit“ ist ein Wort der Sprache, in einem Shop mit Zelten aber meist „zelt“.
    const zahl = new Map((sel.words ?? []).map(x => [x.word, x.n]))
    const fremd = z.woerter.filter(w => zahl.get(w) === 0)
    if (fremd.length) {
      for (const u of fremd) {
        z.woerter = z.woerter.filter(x => x !== u)
        const k = korrektur(u, namen4)
        const liste = k ? [] : assoz.zu(u, loc)
        const probe = liste.length ? await waehle(z, loc, { art: [], ordnen: liste, angaben: [], probe: true, take: 1, gruppe: null }) : null
        // in der Reihenfolge der Liste (die bedeutendsten zuerst) — nach Häufigkeit gewönnen allgemeine Wörter („atmungsaktiv“ für „tennis“)
        const im = new Set((probe?.words ?? []).filter(x => x.n > 0).map(x => x.word))
        const drin = liste.filter(x => im.has(x)).slice(0, MAX_ASSOZ)
        if (k) {
          corrected.push({ from: u, to: k })
          if (!z.woerter.some(x => gleichesWort(x, k))) z.woerter.push(k)
          eingabe = eingabe.replace(new RegExp(`(?<![\\p{L}\\p{N}])${u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'giu'), k)
          neueWoerter = neueWoerter.map(x => x === u ? k : x)
        } else if (drin.length) {
          z.assoz = { ...z.assoz, [u]: drin }; z.woerter.push(u); hinweise.push(T.assoziiert(u, drin))
        } else { unknown.push(u); neueWoerter = neueWoerter.filter(x => x !== u) }
      }
      ;({ art, weich } = teile(z.woerter, namen))
      // nur Unbekanntes: der Sinn entscheidet — journali nennt das ähnliche Produkte
      sel = await waehle(z, loc, { art, ordnen: art.length || weich.length ? weich : unknown, satz: sinnSatz(), lockern: true, take, probe: true })
    }
    // mit allem zusammen nichts: liegt es an einem Tippfehler dieser Eingabe?
    if (sel.total === 0 && z.woerter.length && eingabe)
      for (const w of woerter(eingabe).filter(x => z.woerter.includes(x))) {
        const k = korrektur(w, namen4)
        if (!k) continue
        const probe = [...new Set(z.woerter.map(x => x === w ? k : x))]
        const t = teile(probe, namen)
        const p = await waehle(z, loc, { art: t.art, ordnen: t.weich, satz: sinnSatz(), lockern: true, take, probe: true })
        if (p.total > 0) { z.woerter = probe; corrected.push({ from: w, to: k }); neueWoerter = neueWoerter.map(x => x === w ? k : x); sel = p; ({ art, weich } = t); break }
      }

    // ---- Vorlieben: wechselt die Art, gelten die Angaben weiter, deren Attribut es bei der neuen Art gibt — und der Berater sagt es
    if (art.length && z.art.length && !gleicheMenge(art, z.art) && sel.total > 0) {
      const ruhend = Object.values(z.vorlieben).filter(v => !z.angaben.some(a => a.attribute === v.attribute) && (sel.present ?? []).includes(v.attribute))
      if (ruhend.length) {
        const mit = [...z.angaben, ...ruhend.map(v => ({ ...v, quelle: 'vorliebe' }))]
        const p = await waehle(z, loc, { art, ordnen: weich, angaben: mit, satz: sinnSatz(), lockern: true, take, probe: true })
        if (p.total > 0) { z.angaben = mit; sel = p; uebernommen.push(...ruhend.map(v => angabeText(v, loc))) }
      }
    }
    if (art.length) z.art = art
    uebernimmBezeichnungen(z, sel.filter)
    if (z.gruppe) z.gruppe = sel.group ? { key: sel.group.key, label: sel.group.label } : null   // was journali nicht kennt, fällt weg

    // ---- Themenwechsel: zusammen nichts, die neue Eingabe allein schon, und sie bringt ein neues Wort — dann fragt der Berater
    let statt = null
    if (sel.total === 0 && hatteVorher && neueWoerter.length) {
      const t = teile(neueWoerter, namen)
      const p = await waehle(z, loc, { art: t.art, ordnen: t.weich, angaben: neueAngaben, satz: eingabe, probe: true, take: 1, gruppe: null })
      if (p.total > 0) statt = { words: neueWoerter, filter: (p.filter ?? []).map(f => ({ ...f })), n: p.total }
    }
    z.statt = statt
    // was der Themenwechsel wäre, steht nicht noch einmal unter „mit weniger Angaben“
    const relax = (sel.relax ?? []).filter(l => {
      if (!statt) return true
      const ws = l.kind === 'word' ? z.woerter.filter(w => w !== l.word) : z.woerter
      const fs = l.kind === 'word' ? z.angaben : z.angaben.filter(a => !gleich(a, l))
      return !(gleicheMenge(ws, statt.words) && fs.length === statt.filter.length && fs.every(a => statt.filter.some(b => gleich(a, b))))
    })

    // ---- Unterlagen und der Text der KI
    let docs = []
    if (eingabe) { const d = await unterlagen(loc, { satz: eingabe, art }); docs = d.docs ?? []; warning = warning ?? d.warning ?? null }
    // Gibt es Treffer, steht ihre Beschreibung auf den Karten (10.10.2026): ein Dokument an einem einzelnen Produkt oder einer Variante (ein
    // Datenblatt) erscheint dann nicht als eigene Unterlage — es zeigte sonst andere Produkte als die Karten. Unterlagen von Gruppen bleiben.
    if ((sel.hits ?? []).length) docs = docs.filter(u => !/^[pv]-/.test(u.node?.id ?? '')).map((u, i) => ({ ...u, n: i + 1 }))
    warning = warning ?? sel.warning ?? null
    let answer = null
    if (vok.ki && ki && (eingabe || z.verlauf.length) && ((sel.hits ?? []).length || docs.length)) {
      const k = await kiText(loc, { satz: eingabe || z.woerter.join(' '), treffer: (sel.hits ?? []).slice(0, 5).map(h => h.id), merkmale: (sel.facets ?? []).map(f => f.label),
        verlauf: z.verlauf.slice(-MAX_VERLAUF), unterlagen: quellen(docs) })
      answer = k.text ?? null; warning = warning ?? k.warning ?? null
    }
    if (eingabe) z.verlauf = [...z.verlauf, String(q).trim().slice(0, 300)].slice(-MAX_VERLAUF)

    // ---- das Produkt im Blick: das einzige der Antwort
    const hits = (sel.hits ?? []).map(h => ({ ...h, seen: z.gesehen.includes(h.id) }))
    if (sel.total === 1 && hits.length === 1) { z.fokus = hits[0].id; z.fokusName = hits[0].name } else if (sel.total !== 1) { z.fokus = null; z.fokusName = null }
    z.zuletzt = hits.map(h => ({ id: h.id, name: h.name }))   // worauf sich „sind die …?“ bezieht

    // ---- Lernen: Wörter ohne Treffer, gelesene Tippfehler
    if (lernen) {
      for (const u of unknown) lernen.notiere('ohneTreffer', { wort: u })
      for (const k of corrected) lernen.notiere('korrektur', k)
      if (sel.total === 0 && z.woerter.length) lernen.notiere('nichts', { woerter: z.woerter })
    }

    // ---- nichts erkannt (09.10.2026): kein Wort steht in einem Produkt, nichts ist eine Angabe — und journali findet nichts, oder es ist eine
    // Frage und journali nennt nur nach dem Sinn ähnliche Produkte („wie wird das wetter?“). Dann nennt der Berater, wobei er hilft.
    if (eingabe && !schritt && !neueAngaben.length && !neueWoerter.length && !corrected.length && unknown.length && (sel.total === 0 || (sel.similar && fragt(eingabe))))
      return { ...sortiment(T.helfen((vok.groups ?? []).length > 0), fragt(eingabe) ? [] : [T.unbekannt(unknown)], T.andereFragen),
        total: 0, similar: false, unknown, words: z.woerter, filter: z.angaben }

    // ---- die Sätze
    const ranked = weich.filter(w => z.woerter.includes(w))
    const wort = z.woerter.join(' ')
    const satz = sel.total
      ? (sel.similar ? T.aehnlich(sel.total) : ranked.length ? T.trefferVorn(sel.total, art.join(' '), ranked.join(' ')) : wort ? T.trefferZu(sel.total, wort)
        : z.gruppe ? T.trefferIn(sel.total, z.gruppe.label) : T.treffer(sel.total))
      : T.keine
    for (const k of corrected) hinweise.unshift(T.gelesen(k.from, k.to))
    if (unknown.length) hinweise.push(T.unbekannt(unknown))
    if (uebernommen.length) hinweise.push(T.uebernommen(uebernommen))
    return {
      gespraech: id, locale: loc, total: sel.total, hits, facets: sel.facets ?? [], filter: z.angaben, words: z.woerter, group: z.gruppe, ranked, unknown, corrected,
      similar: !!sel.similar, relax, instead: statt, docs, answer, warning, uebernommen,
      texte: {
        satz, hinweise,
        frage: hits.length ? T.abschluss((sel.facets ?? []).slice(0, 3).map(f => f.label)) : null,
        statt: statt ? T.statt([...statt.words, ...statt.filter.map(f => angabeText(f, loc))].join(', ')) : null,
      },
    }
  }

  /// Ein Produkt wurde geöffnet oder gemerkt: es ist im Blick und gesehen; das Lernen notiert, nach welchen Wörtern
  function merke(gespraech, { id, name = null, art = 'geoeffnet' } = {}) {
    if (typeof gespraech !== 'string' || !KENNUNG.test(gespraech) || typeof id !== 'string') return
    const { z } = hole(gespraech)
    if (art === 'geoeffnet') { z.fokus = id; z.fokusName = name ?? z.fokusName }
    if (!z.gesehen.includes(id)) z.gesehen = [...z.gesehen, id].slice(-200)
    lernen?.notiere(art, { woerter: z.woerter, id, name })
  }

  /**
   * Eine Frage ohne Gespräch (ein KI-Agent über MCP bringt sein Gedächtnis selbst mit): verstehen, auswählen, Unterlagen.
   */
  async function suche({ q = '', filter = [], locale = null, limit = 6 } = {}) {
    const { vok, namen, namen4 } = await vokabular(locale)
    const loc = vok.locale
    const z = neuerZustand()
    const e = erkenne(vok, String(q).slice(0, 300))
    for (const f of Array.isArray(filter) ? filter.slice(0, 10) : []) if (f?.attribute && f?.value != null) setze(z, { attribute: String(f.attribute), op: ['le', 'ge', 'low', 'high'].includes(f.op) ? f.op : 'eq', value: String(f.value) })
    for (const a of e.angaben) setze(z, a)
    let ws = woerter(e.rest)
    let { art, weich } = teile(ws, namen)
    const take = Math.min(Math.max(Number(limit) || 6, 1), 20)
    let sel = await waehle(z, loc, { art, ordnen: weich, satz: q, take })
    const zahl = new Map((sel.words ?? []).map(x => [x.word, x.n]))
    const corrected = [], unknown = []
    if (ws.some(w => zahl.get(w) === 0)) {
      ws = ws.flatMap(w => { if (zahl.get(w) !== 0) return [w]; const k = korrektur(w, namen4); if (k) { corrected.push({ from: w, to: k }); return [k] } unknown.push(w); return [] })
      ;({ art, weich } = teile(ws, namen))
      sel = await waehle(z, loc, { art, ordnen: art.length || weich.length ? weich : unknown, satz: q, take, probe: true })
    }
    const d = String(q).trim() ? await unterlagen(loc, { satz: String(q).slice(0, 300), art }) : { docs: [] }
    return { locale: loc, total: sel.total, hits: sel.hits ?? [], facets: sel.facets ?? [], filter: sel.filter ?? [], words: ws, unknown, corrected, similar: !!sel.similar, docs: d.docs ?? [], warning: sel.warning ?? d.warning ?? null }
  }

  return { antworte, merke, suche, vokabular, gespraeche }
}
