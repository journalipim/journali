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

/// Eine Bezeichnung aus einem Schlüssel: `abmessung_a_max` → „Abmessung a max“, `ctrl_isSubNode` → „Ctrl is sub node“.
/// Kennungen (Wörter mit Ziffern und Buchstaben ab sechs Zeichen, etwa `d28e55178`) fallen weg.
export function humanize(raw) {
  const tokens = String(raw ?? '').replace(/([a-zäöüß0-9])([A-ZÄÖÜ])/g, '$1_$2').split(/[^A-Za-z0-9ÄÖÜäöüß]+/).filter(Boolean)
  const keep = tokens.filter(t => !(t.length >= 6 && /\d/.test(t) && /[a-z]/i.test(t)))
  const words = (keep.length ? keep : tokens).map(w => w.toLowerCase())
  return words.join(' ').replace(/^./, c => c.toUpperCase())
}

/// Der Anfang eines Schlüssels als Thema: ein Wort ab vier Buchstaben, das kein technischer Anfang ist
export const themeOf = key => { const m = /^[a-zäöü]{4,}/.exec(String(key ?? '').toLowerCase()); return m && !TECHNISCH.has(m[0]) ? m[0] : '' }

/// Themen aus den Anfängen der Schlüssel: ein Anfang, den mindestens `min` Schlüssel teilen, ist ein Thema; der Rest kommt in „Weitere Merkmale“.
/// Liefert key → { group, label: { de, en } }.
export function themesByPrefix(keys, min = 5) {
  const count = new Map()
  for (const k of keys) { const a = themeOf(k); if (a) count.set(a, (count.get(a) ?? 0) + 1) }
  const out = new Map()
  for (const k of keys) {
    const a = themeOf(k)
    const word = a ? a[0].toUpperCase() + a.slice(1) : ''
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
