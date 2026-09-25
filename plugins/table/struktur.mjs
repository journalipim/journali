// Struktur als Tabelle: den Baum in Excel entwerfen, besprechen und in einem Zug einspielen — ohne Inhalte.
//
// Warum getrennt von den Daten: oberhalb eines Produkts stehen die Attribute vieler Zweige nebeneinander, von denen
// jeder nur wenige füllt — die Tabelle wird breit und leer. Struktur hat dieses Problem nicht: sie kennt nur Namen
// und ihre Verschachtelung. Dazu kostet sie kein Kontingent (`Kinds.Structure` zählt nicht, `ProductCreated` schon),
// weshalb auch ein Baum mit tausenden Gruppen frei eingespielt werden kann.
//
// Form: eine Spalte je Ebene, eine Zeile je Knoten. Der Name steht in der Spalte seiner Ebene, links davon bleibt
// frei — so liest sich die Datei wie ein eingerückter Baum und lässt sich in einer Besprechung durchgehen.
// Beim Lesen wird nach unten aufgefüllt: eine leere Zelle heisst „wie in der Zeile darüber“. Wer lieber den vollen
// Pfad in jede Zeile schreibt, bekommt dasselbe Ergebnis.

/// Die Spalte mit der Id — beim Export gefüllt, bei einer neuen Zeile leer. Daran erkennt der Import, was es schon
/// gibt: so überleben Umbenennungen, ohne dass ein zweiter Knoten entsteht.
export const IdSpalte = 'journali_id'
/// So heissen die Ebenenspalten.
export const ebeneSpalte = (n) => `Ebene ${n}`

/// <summary>Der Pfad eines Knotens von der Wurzel aus (die Wurzel selbst nicht enthalten).</summary>
function pfadVon(byId, id, wurzel) {
  const pfad = []
  for (let n = byId.get(id); n && n.id !== wurzel; n = n.parent ? byId.get(n.parent) : null) pfad.unshift(n)
  return pfad
}

/// Der Baum unter einer Wurzel als Tabelle. `knoten` ist eine flache Liste ({ id, parent, label, role }).
/// Nur Gruppen: Produkte und Varianten sind Inhalt und gehören in den Datenexport.
export function zuTabelle(knoten, wurzel) {
  const byId = new Map(knoten.map(k => [k.id, k]))
  const drunter = knoten.filter(k => k.role === 'group' && k.id !== wurzel && pfadVon(byId, k.id, wurzel).length > 0
    && istUnter(byId, k.id, wurzel))
  // Tiefe zuerst bestimmen — die Zahl der Spalten steht damit fest
  const pfade = new Map(drunter.map(k => [k.id, pfadVon(byId, k.id, wurzel)]))
  const tiefe = Math.max(0, ...[...pfade.values()].map(p => p.length))
  const columns = [{ key: IdSpalte, sys: 'id', hidden: true, note: 'journali-Id — nicht ändern. Leer lassen, dann entsteht ein neuer Knoten' },
    ...Array.from({ length: tiefe }, (_, i) => ({ key: ebeneSpalte(i + 1), ebene: i + 1 }))]
  // Die Reihenfolge ist die des Baums: Eltern vor Kindern, Geschwister wie im Baum
  const sortiert = [...drunter].sort((a, b) => {
    const pa = pfade.get(a.id).map(n => n.label ?? ''), pb = pfade.get(b.id).map(n => n.label ?? '')
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] ?? '').localeCompare(pb[i] ?? '', 'de')
      if (d) return d
    }
    return 0
  })
  const rows = sortiert.map(k => {
    const p = pfade.get(k.id)
    const zeile = [k.id, ...Array.from({ length: tiefe }, () => '')]
    zeile[p.length] = k.label ?? ''   // +1 wegen der Id-Spalte, -1 wegen des Index: gleicht sich aus
    return zeile
  })
  return { columns, rows, count: rows.length }
}

function istUnter(byId, id, wurzel) {
  for (let n = byId.get(id); n; n = n.parent ? byId.get(n.parent) : null) if (n.parent === wurzel || n.id === wurzel) return true
  return false
}

/// <summary>
/// Liest eine Tabelle und sagt, was zu tun wäre — ohne etwas zu schreiben. `kopf` sind die Spaltennamen, `zeilen` die
/// Werte, `knoten` der heutige Baum, `wurzel` der Knoten, unter dem eingespielt wird.
/// <para>Gelöscht wird nie: was in der Datei fehlt, bleibt stehen. Ein Baum darf nicht verschwinden, weil eine Datei
/// halb leer war — im Journal gibt es ohnehin nur Zurückziehen.</para>
/// </summary>
export function plan(kopf, zeilen, knoten, wurzel) {
  const byId = new Map(knoten.map(k => [k.id, k]))
  const idIdx = kopf.findIndex(k => String(k).trim().toLowerCase().startsWith(IdSpalte))
  const ebenen = kopf.map((k, i) => ({ i, m: /^\s*ebene\s*(\d+)\s*$/i.exec(String(k)) })).filter(x => x.m)
    .map(x => ({ i: x.i, ebene: Number(x.m[1]) })).sort((a, b) => a.ebene - b.ebene)
  if (!ebenen.length) return { fehler: ['Keine Spalte „Ebene 1“ — die Struktur steht in Spalten je Ebene.'], anlegen: [], umbenennen: [], umhaengen: [], gleich: 0 }

  const anlegen = [], umbenennen = [], umhaengen = [], fehler = []
  let gleich = 0
  const offen = []        // der Pfad, der von oben aufgefüllt wird
  // Pfad (als Namen) → Id; beim Anlegen wächst sie mit, damit Kinder ihre neuen Eltern finden
  const nachPfad = new Map()
  for (const k of knoten) {
    if (k.role !== 'group') continue
    const p = []
    for (let n = k; n && n.id !== wurzel; n = n.parent ? byId.get(n.parent) : null) p.unshift(n.label ?? '')
    if (p.length) nachPfad.set(p.join('\u0000'), k.id)
  }

  zeilen.forEach((z, nr) => {
    const zeile = nr + 2   // wie in Excel: Kopf ist Zeile 1
    // auffüllen: eine leere Zelle heisst „wie oben“
    let tiefste = -1
    for (const { i, ebene } of ebenen) {
      const v = String(z[i] ?? '').trim()
      if (v) { offen[ebene - 1] = v; offen.length = ebene; tiefste = ebene - 1 }
    }
    if (tiefste < 0) return   // eine ganz leere Zeile ist kein Fehler, sondern Luft in der Datei
    const name = offen[tiefste]
    const pfad = offen.slice(0, tiefste + 1)
    const elternPfad = pfad.slice(0, -1)
    const eltern = elternPfad.length ? nachPfad.get(elternPfad.join('\u0000')) : wurzel
    if (!eltern) { fehler.push(`Zeile ${zeile}: „${elternPfad.join(' / ')}“ gibt es nicht.`); return }

    const id = idIdx >= 0 ? String(z[idIdx] ?? '').trim() : ''
    if (id) {
      const da = byId.get(id)
      if (!da) { fehler.push(`Zeile ${zeile}: Id ${id} gibt es hier nicht.`); return }
      if (da.role !== 'group') { fehler.push(`Zeile ${zeile}: ${da.label ?? id} ist keine Gruppe.`); return }
      let angefasst = false
      if ((da.label ?? '') !== name) { umbenennen.push({ id, von: da.label ?? '', auf: name, zeile }); angefasst = true }
      if ((da.parent ?? '') !== eltern) { umhaengen.push({ id, name, unter: eltern, zeile }); angefasst = true }
      if (!angefasst) gleich++
      nachPfad.set(pfad.join('\u0000'), id)
    } else {
      const schon = nachPfad.get(pfad.join('\u0000'))
      if (schon) { gleich++; return }   // gibt es unter diesem Namen schon — nichts zu tun
      const neu = { name, unter: eltern, pfad: pfad.join(' / '), zeile, ref: 'n' + (anlegen.length + 1) }
      anlegen.push(neu)
      // die neue Gruppe bekommt ihre Id erst beim Schreiben; bis dahin steht sie unter ihrem Pfad
      nachPfad.set(pfad.join('\u0000'), neu)
    }
  })
  return { anlegen, umbenennen, umhaengen, gleich, fehler }
}

/// <summary>
/// Der Plan als Befehle für einen Stapel (POST /api/batch). Ein Elternteil, das in derselben Datei erst entsteht,
/// steht als Verweis (@ref) da — der Server setzt die echte Id ein. Ein Stapel lässt sich als Ganzes zurücknehmen.
/// </summary>
export function befehle(p, masterLocale = 'de') {
  const eltern = (u) => typeof u === 'string' ? u : '@' + u.ref
  return [
    ...p.anlegen.map(a => ({ op: 'group.create', ref: a.ref, args: { parent: eltern(a.unter), label: { [masterLocale]: a.name } } })),
    // group.rename setzt die Bezeichnung (GroupRenamed = Struktur, zaehlt nicht). node.rename waere NodeNamed
    // und damit Datenpflege, die Kontingent kostet — fuer ein Geruest waere das falsch
    ...p.umbenennen.map(u => ({ op: 'group.rename', args: { node: u.id, label: { [masterLocale]: u.auf } } })),
    ...p.umhaengen.map(h => ({ op: 'node.move', args: { node: h.id, parent: eltern(h.unter) } })),
  ]
}

/// Ein Satz, der sagt, was der Plan tut — für die Vorschau.
export function planText(p, t = (s) => s) {
  const teile = []
  if (p.anlegen.length) teile.push(`${p.anlegen.length} neu`)
  if (p.umbenennen.length) teile.push(`${p.umbenennen.length} umbenannt`)
  if (p.umhaengen.length) teile.push(`${p.umhaengen.length} umgehängt`)
  if (p.gleich) teile.push(`${p.gleich} unverändert`)
  if (!teile.length) teile.push(t('nichts zu tun'))
  return teile.join(' · ')
}
