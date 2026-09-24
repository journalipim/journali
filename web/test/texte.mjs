// Hilfen für die Textprüfstände seit der Oberflächensprache (24.09.2026): feste Texte stehen in den Vorlagen als
// $t('…') — Schlüssel ist der deutsche Text. `entfalten` macht daraus wieder den nackten Text, so dass die Prüfungen
// für Länge, Satzzahl und Überschriften unverändert auf das schauen, was der Anwender liest.
const ATTRS = 'title|placeholder|alt|aria-label'

/// Zeichenkette aus einem $t-Aufruf: einfach oder doppelt angeführt, mit Maskierungen
const unquote = (q, s) => (q === "'" ? s.replace(/\\'/g, "'") : JSON.parse('"' + s + '"')).replace(/&quot;/g, '"')

/// Vorlage mit $t('…') → Vorlage mit dem Text an derselben Stelle
export function entfalten(tpl) {
  return tpl
    .replace(new RegExp(`:(${ATTRS})="\\$t\\('((?:\\\\.|[^'])*)'\\)"`, 'g'), (_, a, s) => `${a}="${unquote("'", s)}"`)
    .replace(/\{\{\s*(?:' ' \+ )?\$t\((['"])((?:\\.|(?!\1).)*)\1(?:,\s*\[[^\]]*\])?\)(?: \+ ' ')?\s*\}\}/g, (_, q, s) => unquote(q, s))
}

/// Alle Schlüssel einer Quelldatei (.vue oder .js): $t('…'), $t("…"), t('…') — was übersetzt wird
export function schluessel(src) {
  const out = []
  for (const m of src.matchAll(/(?:\$t|\bt)\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) out.push(unquote(m[1], m[2]))
  return out
}
