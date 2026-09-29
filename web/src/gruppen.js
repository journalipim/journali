// Gruppen eines Attributs (n:m, 29.09.2026, pflegestruktur 36): Eine Gruppe ist eine Auswahl von Attributen, kein
// Besitz — dasselbe Attribut gehört beliebig vielen Gruppen an. Der Server liefert die Menge am Attribut als `groups`
// (Zuordnung und Mitgliedschaften zusammen); `group` bleibt die Heimatgruppe und ist die erste daraus.
//
// Wer im Browser prüft, ob ein Attribut zu einer Gruppe gehört, fragt hier — sonst sähe er nur die Heimatgruppe und
// liesse alles weg, was über eine Mitgliedschaft dazugehört.

/// Die Gruppen eines Attributs, immer als Liste — auch bei einem Modell aus älterer Zeit, das nur `group` kennt.
export const gruppenVon = a => a?.groups ?? (a?.group ? [a.group] : [])

/// Gehört das Attribut zu dieser Gruppe?
export const inGruppe = (a, key) => !!key && gruppenVon(a).includes(key)

/// Die Attribute einer Gruppe, in der Reihenfolge des Modells.
export const attributeVon = (attrs, key) => (attrs ?? []).filter(a => inGruppe(a, key))

/// Welche der geltenden Gruppen ein Attribut hierher bringt — die erste am Pfad. Sie trägt es in der Ansicht;
/// die weiteren stehen im Tooltip.
export const ersteGeltende = (a, geltende) => gruppenVon(a).find(g => geltende.includes(g)) ?? null
