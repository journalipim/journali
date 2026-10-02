// Neue Attribute und Gruppen beim Import — die Regeln, die für jede Quelle gelten (Solr, IXP …), an einer Stelle.
//
// Ziel ist ein Modell, das sich pflegen lässt, nicht eine Kopie der Quelle:
//  · Vererbung: eine Gruppe enthält nur Attribute, deren Werte auf derselben Ebene stehen (Gruppe, Produkt, Variante). Ihr „aktiv ab“ ist diese Ebene —
//    nicht die höchste, auf der irgendeines ihrer Attribute vorkommt, sonst gälten alle schon am Produkt. Attribute, deren Wert an einer Gruppe oder einem
//    Produkt steht, sind vererbbar: die Varianten darunter bekommen ihn, ohne ihn zu wiederholen. Spannt ein Thema mehrere Ebenen, wird je Ebene
//    eine Gruppe daraus („Abmessung (Produkt)“, „Abmessung (Variante)“); sonst heisst sie nur „Abmessung“.
//  · Namen: eine Bezeichnung, die ein Anwender liest — aus dem Namen der Quelle, sonst aus dem Schlüssel (Unterstriche weg, Kennungen weg, Wörter getrennt).
//    Die Gruppe nennt das Thema; was kein Thema hat, kommt in „Weitere Merkmale“.

export const LEVELS = ['group', 'product', 'variant']
export const LEVEL_LABEL = { group: { de: 'Gruppe', en: 'Group' }, product: { de: 'Produkt', en: 'Product' }, variant: { de: 'Variante', en: 'Variant' } }
export const WEITERE = { group: 'weitere', label: { de: 'Weitere Merkmale', en: 'Other attributes' } }

/// Technische Anfänge von Schlüsseln, die kein Thema nennen — Steuerfelder, Verweise, Kennungen der Quelle
const TECHNISCH = new Set(['ctrl', 'control', 'info', 'meta', 'parent', 'sys', 'tmp', 'dp', 'wsc', 'id', 'ref', 'rel', 'prc'])

/// Wörter, die in Schlüsseln fast immer ohne Umlaut stehen (fuer, laenge), mit ihrer richtigen Schreibweise. Nur Wörter, bei denen die Umschrift nicht auch ein anderes
/// Wort sein kann — „masse“ fehlt, es wäre Masse oder Maße.
const UMLAUTE = {
  fuer: 'für', ueber: 'über', laenge: 'länge', hoehe: 'höhe', groesse: 'größe', schluessel: 'schlüssel', praezision: 'präzision', waerme: 'wärme', kuehlung: 'kühlung',
  fuehrung: 'führung', buegel: 'bügel', stuetze: 'stütze', traeger: 'träger', haerte: 'härte', oel: 'öl', oeffnung: 'öffnung', oberflaeche: 'oberfläche', zubehoer: 'zubehör',
  gehaeuse: 'gehäuse', staerke: 'stärke', aeusserer: 'äußerer', aeusseren: 'äußeren', gewaehrleistung: 'gewährleistung', verlaengerung: 'verlängerung', geraet: 'gerät',
  spaenne: 'späne', kraefte: 'kräfte', draehte: 'drähte', schaerfe: 'schärfe', abstuetzung: 'abstützung', fuehler: 'fühler', lueftung: 'lüftung',
}
const UMSCHRIFT = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }
const umschreiben = w => w.toLowerCase().replace(/[äöüß]/g, ch => UMSCHRIFT[ch])

/// Die Wörter der Quelle mit Umlaut als Nachschlagewerk: Umschrift → Wort. Ein Wort gilt nur, wenn es in den Texten öfter mit Umlaut steht als in der Umschrift
/// (bei „Maße“ und „Masse“ im selben Katalog entscheidet die Mehrheit). Dazu die Wörter oben.
export function lexicon(texts = []) {
  const mit = new Map(), ohne = new Map()
  for (const t of texts) for (const w of String(t ?? '').toLowerCase().split(/[^\p{L}]+/u)) {
    if (w.length < 3) continue
    if (/[äöüß]/.test(w)) { const k = umschreiben(w); mit.set(k, [...(mit.get(k) ?? []), w]) }
    else ohne.set(w, (ohne.get(w) ?? 0) + 1)
  }
  const lex = new Map(Object.entries(UMLAUTE))
  for (const [k, ws] of mit) {
    const best = [...new Set(ws)].sort((x, y) => ws.filter(v => v === y).length - ws.filter(v => v === x).length)[0]
    if (ws.length > (ohne.get(k) ?? 0)) lex.set(k, best)
  }
  return lex
}

/// Ein Wort in der Umschrift mit Umlaut schreiben, wenn das Nachschlagewerk es kennt: das ganze Wort, sein Anfang oder sein Ende (Zusammensetzungen:
/// schluesselweite → schlüsselweite, gesamtlaenge → gesamtlänge). Was nicht belegt ist, bleibt, wie es ist.
export function restoreUmlauts(word, lex) {
  const w = String(word ?? '').toLowerCase()
  if (!lex?.size || !w || /[äöüß]/.test(w)) return w
  if (lex.has(w)) return lex.get(w)
  let best = null
  for (const [k, v] of lex) {
    if (k.length < 4 || k.length >= w.length) continue
    if (w.startsWith(k) && (!best || k.length > best.k.length)) best = { k, v, front: true }
    else if (w.endsWith(k) && (!best || k.length > best.k.length)) best = { k, v, front: false }
  }
  return best ? (best.front ? best.v + w.slice(best.k.length) : w.slice(0, w.length - best.k.length) + best.v) : w
}

/// Eine Bezeichnung aus einem Schlüssel: `abmessung_a_max` → „Abmessung a max“, `ctrl_isSubNode` → „Ctrl is sub node“, mit Nachschlagewerk
/// `schluesselweite` → „Schlüsselweite“. Kennungen (Wörter mit Ziffern und Buchstaben ab sechs Zeichen, etwa `d28e55178`) fallen weg.
export function humanize(raw, lex = null) {
  const tokens = String(raw ?? '').replace(/([a-zäöüß0-9])([A-ZÄÖÜ])/g, '$1_$2').split(/[^A-Za-z0-9ÄÖÜäöüß]+/).filter(Boolean)
  const keep = tokens.filter(t => !(t.length >= 6 && /\d/.test(t) && /[a-z]/i.test(t)))
  const words = (keep.length ? keep : tokens).map(w => restoreUmlauts(w, lex))
  return words.join(' ').replace(/^./, c => c.toUpperCase())
}

/// Der Anfang eines Schlüssels als Thema: ein Wort ab vier Buchstaben, das kein technischer Anfang ist
export const themeOf = key => { const m = /^[a-zäöü]{4,}/.exec(String(key ?? '').toLowerCase()); return m && !TECHNISCH.has(m[0]) ? m[0] : '' }

/// Themen aus den Anfängen der Schlüssel: ein Anfang, den mindestens `min` Schlüssel teilen, ist ein Thema; der Rest kommt in „Weitere Merkmale“.
/// Liefert key → { group, label: { de, en } }.
export function themesByPrefix(keys, min = 5, lex = null) {
  const count = new Map()
  for (const k of keys) { const a = themeOf(k); if (a) count.set(a, (count.get(a) ?? 0) + 1) }
  const out = new Map()
  for (const k of keys) {
    const a = themeOf(k)
    const wort = a ? restoreUmlauts(a, lex) : ''
    const word = wort ? wort[0].toUpperCase() + wort.slice(1) : ''
    out.set(k, a && count.get(a) >= min ? { group: a, label: { de: word, en: word } } : WEITERE)
  }
  return out
}

/// Aus Thema und Ebene je Attribut die Gruppe: `entries` ist [{ key, theme: { group, label: { de, en } }, level }] (level 0 = Gruppe, 1 = Produkt, 2 = Variante;
/// die oberste Ebene, auf der ein Wert des Attributs vorkommt). Liefert key → { group, label: { de, en }, activeFrom, inheritable }.
/// Ein Thema auf einer Ebene behält seinen Namen; auf mehreren bekommt jede Gruppe die Ebene dazu.
export function groupsByLevel(entries) {
  const levels = new Map()   // Thema → Ebenen
  for (const e of entries) { if (!levels.has(e.theme.group)) levels.set(e.theme.group, new Set()); levels.get(e.theme.group).add(e.level) }
  const out = new Map()
  for (const e of entries) {
    const split = levels.get(e.theme.group).size > 1
    const role = LEVELS[e.level] ?? 'variant'
    out.set(e.key, {
      group: split ? `${e.theme.group}_${role}` : e.theme.group,
      label: split ? { de: `${e.theme.label.de} (${LEVEL_LABEL[role].de})`, en: `${e.theme.label.en} (${LEVEL_LABEL[role].en})` } : e.theme.label,
      activeFrom: e.level > 0 ? role : null,
      inheritable: e.level < 2,
    })
  }
  return out
}

/// Die Wörter, die eine Ebene im Namen einer Gruppe bezeichnet
export const LEVEL_WORD = {
  group: { de: 'Gruppenmerkmale', en: 'Group attributes' },
  product: { de: 'Produktmerkmale', en: 'Product attributes' },
  variant: { de: 'Variantenmerkmale', en: 'Variant attributes' },
}

const keyOf = s => { const k = String(s ?? '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); return /^[a-z]/.test(k) ? k : 'g_' + k }

/// Die sinnvollste Position für Attributgruppen: jedes Attribut gehört an den Knoten, unter dem alle seine Werte stehen — den untersten gemeinsamen Vorfahren der Knoten, die es
/// benutzen. Dort hängt die Gruppe; wer darunter arbeitet, sieht genau die Attribute, die dort vorkommen, und nichts von den Zweigen daneben. Was ein Zweig gemeinsam hat,
/// wandert nach oben, was nur ihm gehört, bleibt unten. Dazu die Ebene (Gruppe, Produkt, Variante: aktiv ab, vererbbar) und die Grösse: eine Gruppe mit weniger als `min`
/// Attributen geht zum Knoten darüber (sonst entstünden Gruppen mit einem Attribut), eine mit mehr als `max` wird nach Thema geteilt.
///
/// `entries`: [{ key, level, positions: Set<id> }] (positions: die Knoten, die das Attribut benutzen). `tree`: { parentOf(id) → id | null, name(id) }.
/// Liefert { byKey: key → { group, label, activeFrom, inheritable, position }, groups: group → { label, activeFrom, position } }.
export function placeByPosition(entries, tree, { min = 3, max = 60, themeMin = 5, lex = null } = {}) {
  const pathOf = id => { const p = []; for (let n = id; n != null; n = tree.parentOf(n)) p.unshift(n); return p }
  const commonOf = ids => {
    const paths = [...ids].map(pathOf)
    if (!paths.length) return null
    let i = 0
    while (paths.every(p => i < p.length && p[i] === paths[0][i])) i++
    return i ? paths[0][i - 1] : paths[0][0]
  }
  const depth = id => pathOf(id).length

  // Eimer je Knoten und Ebene
  const buckets = new Map()   // `${position}|${level}` → { position, level, keys }
  const put = (position, level, key) => { const k = position + '|' + level; if (!buckets.has(k)) buckets.set(k, { position, level, keys: [] }); buckets.get(k).keys.push(key) }
  const top = commonOf(entries.flatMap(e => [...e.positions]))
  for (const e of entries) put(commonOf(e.positions) ?? top, e.level, e.key)

  // zu kleine Eimer gehen zum Knoten darüber — Tiefe für Tiefe von unten nach oben: was oben ankommt, wird dort noch einmal geprüft
  const tiefen = new Map()
  const tiefeVon = id => { if (!tiefen.has(id)) tiefen.set(id, depth(id)); return tiefen.get(id) }
  for (let d = Math.max(0, ...[...buckets.values()].map(b => tiefeVon(b.position))); d >= 1; d--) {
    for (const b of [...buckets.values()].filter(x => tiefeVon(x.position) === d)) {
      const parent = tree.parentOf(b.position)
      if (b.keys.length >= min || parent == null) continue
      buckets.delete(b.position + '|' + b.level)
      for (const key of b.keys) put(parent, b.level, key)
    }
  }

  // Namen: die Ebene steht nur dabei, wo ein Knoten mehrere hat; zu grosse Eimer teilt das Thema
  const levelsAt = new Map()
  for (const b of buckets.values()) { if (!levelsAt.has(b.position)) levelsAt.set(b.position, new Set()); levelsAt.get(b.position).add(b.level) }
  const used = new Set()
  const unique = k => { let c = k, n = 2; while (used.has(c)) c = `${k}_${n++}`; used.add(c); return c }
  const byKey = new Map(), groups = new Map()
  for (const b of [...buckets.values()].sort((x, y) => depth(x.position) - depth(y.position) || x.level - y.level)) {
    const role = LEVELS[b.level] ?? 'variant'
    const name = tree.name(b.position)
    const mitEbene = levelsAt.get(b.position).size > 1
    const parts = b.keys.length > max ? [...groupBy(b.keys, themesByPrefix(b.keys, themeMin, lex))] : [[null, b.keys]]
    for (const [theme, keys] of parts) {
      const word = theme ? theme.label : null
      const de = [name, word ? `${word.de}${mitEbene ? ` (${LEVEL_LABEL[role].de})` : ''}` : mitEbene ? LEVEL_WORD[role].de : null].filter(Boolean).join(' · ')
      const en = [name, word ? `${word.en}${mitEbene ? ` (${LEVEL_LABEL[role].en})` : ''}` : mitEbene ? LEVEL_WORD[role].en : null].filter(Boolean).join(' · ')
      const group = unique([keyOf(name), mitEbene && !word ? role : null, word ? keyOf(theme.group) + (mitEbene ? '_' + role : '') : null].filter(Boolean).join('_'))
      groups.set(group, { label: { de, en }, activeFrom: b.level > 0 ? role : null, position: b.position })
      for (const key of keys) byKey.set(key, { group, label: { de, en }, activeFrom: b.level > 0 ? role : null, inheritable: b.level < 2, position: b.position })
    }
  }
  return { byKey, groups }
}

function groupBy(keys, themes) {
  const out = new Map()
  for (const k of keys) { const t = themes.get(k); const g = out.get(t.group) ?? [t, []]; g[1].push(k); out.set(t.group, g) }
  return [...out.values()]
}
