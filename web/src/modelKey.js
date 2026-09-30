// Der Schlüssel eines Modellbestandteils (Gruppe, Attribut, Liste, Sicht, Relationstyp …): nur a-z, 0-9 und _, und er
// beginnt mit einem Buchstaben — der Server nimmt nichts anderes. Aus einem Namen wird er so gebildet: klein, Umlaute
// aufgelöst, alles andere ein Unterstrich, führende Ziffern und Unterstriche entfallen.
export const schluessel = s => String(s ?? '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '_').replace(/^[_0-9]+/, '').replace(/_+$/, '')

export const istSchluessel = s => /^[a-z][a-z0-9_]*$/.test(String(s ?? ''))
