// Zeilenoperationen der Tabellenbearbeitung (Taloan, 21.09.2026: „vorne ganze Zeilen markieren, Strg/Shift, Rechtsklick:
// löschen, kopieren, einfügen, verschieben“) — rein, ohne Vue, damit sie sich prüfen lassen.
// Zeilen sind { row: { id }, isNew?, retired?, moved? }; alles hier ändert nur die Liste, geschrieben wird beim Speichern.

/// Verschiebt die Zeilen mit den Ids vor den Platz `to` (Index in der alten Liste; rows.length = ans Ende).
/// Die Reihenfolge der verschobenen Zeilen bleibt; jede bekommt `moved`. Gibt die neue Liste zurück.
export function moveRows(rows, ids, to) {
  const set = ids instanceof Set ? ids : new Set(ids)
  const picked = rows.filter(r => set.has(r.row.id))
  if (!picked.length) return rows
  const before = rows.slice(0, to).filter(r => !set.has(r.row.id))
  const after = rows.slice(to).filter(r => !set.has(r.row.id))
  for (const r of picked) r.moved = true
  return [...before, ...picked, ...after]
}

/// Ziel für „nach oben/unten/an den Anfang/ans Ende“ als Index in der alten Liste
export function moveTarget(rows, ids, where) {
  const set = ids instanceof Set ? ids : new Set(ids)
  const idx = rows.map((r, i) => set.has(r.row.id) ? i : -1).filter(i => i >= 0)
  if (!idx.length) return null
  const lo = idx[0], hi = idx[idx.length - 1]
  if (where === 'top') return 0
  if (where === 'bottom') return rows.length
  if (where === 'up') return Math.max(0, lo - 1)
  if (where === 'down') return Math.min(rows.length, hi + 2)
  return null
}

/// Befehle node.order für die verschobenen Zeilen: von unten nach oben, jede vor ihre Nachfolgerin in der Endreihenfolge —
/// so steht die Nachfolgerin schon richtig, wenn die Zeile eingereiht wird (nicht verschobene Zeilen behalten ihre
/// Reihenfolge untereinander ohnehin). Gelöschte Zeilen zählen nicht; neue Zeilen heissen im Stapel @<ref>.
export function orderCommands(rows, parent) {
  const live = rows.filter(r => !r.retired)
  const nodeOf = r => r.isNew ? '@' + r.row.id : r.row.id
  const out = []
  for (let i = live.length - 1; i >= 0; i--) {
    const r = live[i]; if (!r.moved) continue
    out.push({ op: 'node.order', args: { node: nodeOf(r), parent, before: live[i + 1] ? nodeOf(live[i + 1]) : null }, _key: 'order|' + r.row.id })
  }
  return out
}

/// Zeilen-Auswahl wie in Excel: Klick = nur diese, Strg = dazu/weg, Shift = vom Anker bis hier. Gibt { sel: Set, anchor } zurück.
export function pickRows(rows, sel, anchor, ri, { ctrl = false, shift = false } = {}) {
  const id = rows[ri]?.row.id; if (id == null) return { sel, anchor }
  if (shift && anchor != null) {
    const lo = Math.min(anchor, ri), hi = Math.max(anchor, ri)
    const next = ctrl ? new Set(sel) : new Set()
    for (let i = lo; i <= hi; i++) next.add(rows[i].row.id)
    return { sel: next, anchor }
  }
  if (ctrl) { const next = new Set(sel); next.has(id) ? next.delete(id) : next.add(id); return { sel: next, anchor: ri } }
  return { sel: new Set([id]), anchor: ri }
}
