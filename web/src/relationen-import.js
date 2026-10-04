// Das Blatt „Relationen“ einer Excel-Datei (30.09.2026): eine Zeile je Relation, geschrieben vom Tabellenexport
// (plugins/table/core.mjs, relationenTabelle). Reine Funktionen — die Ansicht und der Job rechnen damit denselben Plan.
//
// Spalten: journali_von, journali_typ, journali_nach (Kennungen der Datei), journali_von_name und journali_nach_name (nur zum Lesen),
// dazu je Relationsattribut eine Spalte, mit Sprache `<attribut>_<sprache>`; `<attribut>_einheit` ist nur zum Lesen.
// Kennungen gelten zuerst für die Knoten, die dieselbe Datei im Blatt Daten anlegt oder findet (auch in einem anderen System), sonst
// als Id im Baum. Was es nicht gibt, wird gemeldet und übergangen — der Rest der Datei bleibt.
import { convert, validate } from './mapper.js'
import { t as t_ } from './i18n.js'

export const VON = 'journali_von', TYP = 'journali_typ', NACH = 'journali_nach', VON_NAME = 'journali_von_name', NACH_NAME = 'journali_nach_name'
const EINHEIT = '_einheit'
const SYSTEM = new Set([VON, TYP, NACH, VON_NAME, NACH_NAME])
const T = '\u0001'

/// Ist dieses Blatt das Relationenblatt? Die drei Schlüsselspalten müssen da sein.
export const istRelationenBlatt = blatt => !!blatt?.columns && [VON, TYP, NACH].every(k => blatt.columns.includes(k))

/// Die Datei ohne ihr Relationenblatt und das Blatt selbst: { blatt, relationen }. Hat die Datei kein Blatt, ist `relationen` null.
export function trenne(source) {
  const alle = source?.sheets ?? []
  const relationen = alle.find(istRelationenBlatt) ?? null
  return { blaetter: alle.filter(b => b !== relationen), relationen }
}

/// Der Baum-Abbild-Knoten zu einer Kennung der Datei: Id aus dem Blatt Daten oder im Baum
const aufloesen = (id, ids, tree) => { id = String(id ?? '').trim(); return !id ? null : ids?.get(id) ?? (tree.byId.has(id) ? id : null) }

/// Die vorhandenen Relationen der Knoten, die die Datei nennt (Ausgang und Ziel — eine symmetrische Relation kann am Ziel stehen):
/// Map „Typ␁von␁nach“ → { id, werte: „attribut|sprache“ → Text }. `api.post` fragt den Server, je 5 000 Knoten einmal (04.10.2026 — vorher
/// die Relationen des ganzen Baums ab der Wurzel).
export async function bestandLaden(api, blatt, ids, tree) {
  const iVon = blatt.columns.indexOf(VON), iNach = blatt.columns.indexOf(NACH)
  const knoten = new Set()
  for (const r of blatt.rows) for (const i of [iVon, iNach]) { const id = aufloesen(r[i], ids, tree); if (id && !id.startsWith('@')) knoten.add(id) }
  const liste = [...knoten], bestand = new Map()
  for (let s = 0; s < liste.length; s += 5000) {
    let baum = {}
    try { baum = await api.post('/api/relations/out', { nodes: liste.slice(s, s + 5000) }) } catch { baum = {} }
    for (const [von, liste] of Object.entries(baum)) for (const r of liste) {
      if (r.direction !== 'out') continue
      const werte = {}
      for (const [a, x] of Object.entries(r.values ?? {})) for (const e of Array.isArray(x) ? x : [x]) werte[`${a}|${e.locale ?? ''}`] = Array.isArray(e.value) ? e.value.join(',') : String(e.value ?? '')
      bestand.set([r.type, von, r.other.id].join(T), { id: r.id, werte })
    }
  }
  return bestand
}

/// Der Plan für das Relationenblatt: Befehle für /api/batch (hinter denen der Knoten) und Zahlen für die Vorschau.
/// ids: Kennung der Datei → Id oder @ref (plan().ids); bestand: bestandLaden().
export function planRelationen({ blatt, model, tree, ids, bestand = new Map() }) {
  const col = k => blatt.columns.indexOf(k)
  const iVon = col(VON), iTyp = col(TYP), iNach = col(NACH)
  const stats = { rows: blatt.rows.length, create: 0, update: 0, unchanged: 0, values: 0, skipped: 0, problems: [], invalid: [] }
  const commands = []
  const typen = new Map((model.relationTypes ?? []).map(t => [t.key, t]))
  const attribute = new Map((model.attributes ?? []).map(a => [a.key, a]))
  const sprachen = new Set((model.locales ?? []).map(l => l.code))
  // Wertspalten: Attribut (und Sprache); `<attribut>_einheit` und die Namen lesen wir nicht
  const wert = []
  blatt.columns.forEach((c, i) => {
    if (SYSTEM.has(c)) return
    const a = attribute.get(c)
    if (a) { wert.push({ i, def: a, locale: null }); return }
    const m = /^(.+)_([^_]+)$/.exec(c)
    if (m && sprachen.has(m[2]) && attribute.get(m[1])) { wert.push({ i, def: attribute.get(m[1]), locale: m[2] }); return }
    if (m && m[0].endsWith(EINHEIT) && attribute.get(m[1])) return
    stats.problems.push(t_('Spalte {0}: kein Attribut im Modell — übergangen', [c]))
  })
  const gesehen = new Set()
  blatt.rows.forEach((r, ri) => {
    const zeile = ri + 2, text = v => String(v ?? '').trim()
    const typ = text(r[iTyp])
    const von = aufloesen(r[iVon], ids, tree), nach = aufloesen(r[iNach], ids, tree)
    const uebergehen = grund => { stats.problems.push(t_('Zeile {0}: {1}', [zeile, grund])); stats.skipped++ }
    if (!typen.has(typ)) return uebergehen(t_('Relationstyp {0} gibt es nicht', [typ || '?']))
    if (!von) return uebergehen(t_('der Ausgangsknoten {0} gibt es hier nicht', [text(r[iVon]) || '?']))
    if (!nach) return uebergehen(t_('das Ziel {0} gibt es hier nicht', [text(r[iNach]) || '?']))
    if (von === nach) return uebergehen(t_('eine Relation auf sich selbst'))
    const schluessel = [typ, von, nach].join(T)
    const umgekehrt = [typ, nach, von].join(T)
    if (gesehen.has(schluessel) || (typen.get(typ).symmetric && gesehen.has(umgekehrt))) return uebergehen(t_('die Relation steht schon in der Datei'))
    gesehen.add(schluessel)
    const vorhanden = bestand.get(schluessel) ?? (typen.get(typ).symmetric ? bestand.get(umgekehrt) : null) ?? null
    let aenderungen = 0
    const sets = []
    for (const w of wert) {
      const v = convert(r[w.i], w.def, model)
      if (v == null) continue
      const fehler = validate(v, w.def, model)
      if (fehler) { stats.invalid.push({ row: ri, column: w.i, key: w.def.key, value: r[w.i], message: fehler }); continue }
      const k = `${w.def.key}|${w.locale ?? ''}`
      if (vorhanden && vorhanden.werte[k] === v) continue
      sets.push({ attribute: w.def.key, locale: w.locale, v, multiple: !!w.def.multiple })
    }
    const ref = vorhanden ? null : 'rel' + ri
    if (!vorhanden) commands.push({ op: 'relation.create', ref, args: { type: typ, from: von, to: nach } })
    for (const s of sets) {
      commands.push({ op: 'relation.attribute.set', args: { relation: vorhanden ? vorhanden.id : '@' + ref, attribute: s.attribute, locale: s.locale, ...(s.multiple ? { values: s.v.split(',') } : { value: s.v }) } })
      aenderungen++
    }
    if (!vorhanden) stats.create++
    else if (aenderungen) stats.update++
    else stats.unchanged++
    stats.values += aenderungen
  })
  return { commands, stats }
}
