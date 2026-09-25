// Struktur als Tabelle: den Baum in Excel entwerfen und einspielen (25.09.2026).
// Geprüft wird der Kern ohne Browser: Baum → Tabelle, Tabelle → Plan. Der Plan schreibt nichts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zuTabelle, plan, planText, befehle, IdSpalte } from '../../plugins/table/struktur.mjs'

// wurzel
//   Kleber            (g-1)
//     Schaum          (g-11)
//     Sealing         (g-12)
//   Verlegung         (g-2)
const baum = [
  { id: 'w', parent: null, label: 'Wurzel', role: 'group' },
  { id: 'g-1', parent: 'w', label: 'Kleber', role: 'group' },
  { id: 'g-11', parent: 'g-1', label: 'Schaum', role: 'group' },
  { id: 'g-12', parent: 'g-1', label: 'Sealing', role: 'group' },
  { id: 'g-2', parent: 'w', label: 'Verlegung', role: 'group' },
  { id: 'p-1', parent: 'g-11', label: 'Ein Produkt', role: 'product' },
]

test('der Baum wird zu Spalten je Ebene, eingerückt', () => {
  const t = zuTabelle(baum, 'w')
  assert.deepEqual(t.columns.map(c => c.key), [IdSpalte, 'Ebene 1', 'Ebene 2'])
  // Produkte gehören nicht in die Struktur — sie sind Inhalt
  assert.equal(t.rows.length, 4)
  // der Name steht in der Spalte seiner Ebene, links davon bleibt frei
  const kleber = t.rows.find(r => r[0] === 'g-1')
  assert.deepEqual(kleber, ['g-1', 'Kleber', ''])
  const schaum = t.rows.find(r => r[0] === 'g-11')
  assert.deepEqual(schaum, ['g-11', '', 'Schaum'])
})

test('die Id fährt mit, damit der Rückweg den Knoten wiederfindet', () => {
  const t = zuTabelle(baum, 'w')
  assert.equal(t.columns[0].key, IdSpalte)
  assert.ok(t.columns[0].hidden, 'die Id steht da, drängt sich aber nicht auf')
  assert.ok(t.rows.every(r => r[0].startsWith('g-')))
})

const kopf = [IdSpalte, 'Ebene 1', 'Ebene 2']

test('unveränderte Datei: nichts zu tun', () => {
  const t = zuTabelle(baum, 'w')
  const p = plan(kopf, t.rows, baum, 'w')
  assert.deepEqual(p.fehler, [])
  assert.deepEqual([p.anlegen.length, p.umbenennen.length, p.umhaengen.length], [0, 0, 0])
  assert.equal(p.gleich, 4)
  assert.equal(planText(p), '4 unverändert')
})

test('eine Zeile ohne Id legt an, und ihre Kinder finden sie', () => {
  const p = plan(kopf, [
    ['g-1', 'Kleber', ''],
    ['', '', 'Reaktiv'],          // neu unter Kleber
    ['', 'Zubehör', ''],          // neu unter der Wurzel
    ['', '', 'Rollen'],           // neu unter dem eben angelegten Zubehör
  ], baum, 'w')
  assert.deepEqual(p.fehler, [])
  assert.deepEqual(p.anlegen.map(a => [a.name, a.unter]), [
    ['Reaktiv', 'g-1'],
    ['Zubehör', 'w'],
    ['Rollen', p.anlegen[1]],     // das Elternteil ist der Eintrag, der vorher in derselben Datei entsteht
  ])
})

test('ein anderer Name bei gleicher Id ist eine Umbenennung, kein neuer Knoten', () => {
  const p = plan(kopf, [['g-1', 'Klebstoffe', '']], baum, 'w')
  assert.deepEqual(p.umbenennen, [{ id: 'g-1', von: 'Kleber', auf: 'Klebstoffe', zeile: 2 }])
  assert.equal(p.anlegen.length, 0)
})

test('eine Zeile unter einem anderen Pfad haengt um', () => {
  // Schaum wandert von Kleber unter Verlegung
  const p = plan(kopf, [['g-2', 'Verlegung', ''], ['g-11', '', 'Schaum']], baum, 'w')
  assert.deepEqual(p.umhaengen, [{ id: 'g-11', name: 'Schaum', unter: 'g-2', zeile: 3 }])
  assert.equal(p.umbenennen.length, 0)
})

test('leere Zellen heissen „wie oben“ — der volle Pfad je Zeile ergibt dasselbe', () => {
  const eingerueckt = plan(kopf, [['g-1', 'Kleber', ''], ['g-11', '', 'Schaum'], ['g-12', '', 'Sealing']], baum, 'w')
  const voll = plan(kopf, [['g-1', 'Kleber', ''], ['g-11', 'Kleber', 'Schaum'], ['g-12', 'Kleber', 'Sealing']], baum, 'w')
  assert.equal(eingerueckt.gleich, 3)
  assert.equal(voll.gleich, 3)
  assert.deepEqual(voll.fehler, [])
})

test('was in der Datei fehlt, wird nicht geloescht', () => {
  // nur eine einzige Zeile — die drei anderen Gruppen kommen in keinem Plan vor
  const p = plan(kopf, [['g-1', 'Kleber', '']], baum, 'w')
  assert.deepEqual(p.fehler, [])
  assert.equal(p.gleich, 1)
  assert.ok(!('loeschen' in p), 'der Plan kennt kein Löschen')
})

test('eine unbekannte Id und ein fehlendes Elternteil werden benannt, nicht verschluckt', () => {
  const p = plan(kopf, [['g-999', 'Irgendwas', '']], baum, 'w')
  assert.equal(p.fehler.length, 1)
  assert.match(p.fehler[0], /Zeile 2.*g-999/)

  const q = plan([IdSpalte, 'Ebene 1', 'Ebene 2', 'Ebene 3'], [['', '', '', 'Tief']], baum, 'w')
  assert.equal(q.fehler.length, 1)
  assert.match(q.fehler[0], /gibt es nicht/)
})

test('ein Produkt in der Strukturdatei wird abgewiesen', () => {
  const p = plan(kopf, [['p-1', 'Ein Produkt', '']], baum, 'w')
  assert.equal(p.fehler.length, 1)
  assert.match(p.fehler[0], /keine Gruppe/)
})

test('ohne Ebenenspalte sagt der Plan, was fehlt', () => {
  const p = plan([IdSpalte, 'Name'], [['g-1', 'Kleber']], baum, 'w')
  assert.equal(p.anlegen.length, 0)
  assert.match(p.fehler[0], /Ebene 1/)
})

test('die Befehle bilden einen Stapel: neue Eltern stehen als Verweis da', () => {
  const p = plan(kopf, [['', 'Zubehör', ''], ['', '', 'Rollen'], ['g-1', 'Klebstoffe', '']], baum, 'w')
  const cmds = befehle(p, 'de')
  assert.deepEqual(cmds[0], { op: 'group.create', ref: 'n1', args: { parent: 'w', label: { de: 'Zubehör' } } })
  // das Elternteil entsteht im selben Stapel — der Server setzt die echte Id für @n1 ein
  assert.deepEqual(cmds[1], { op: 'group.create', ref: 'n2', args: { parent: '@n1', label: { de: 'Rollen' } } })
  // Umbenennen: group.rename setzt die Bezeichnung. node.rename waere NodeNamed und wuerde Kontingent kosten
  assert.equal(cmds[2].op, 'group.rename')
  assert.deepEqual(cmds[2].args, { node: 'g-1', label: { de: 'Klebstoffe' } })
})

test('ein Umhaengen wird zu node.move', () => {
  const p = plan(kopf, [['g-2', 'Verlegung', ''], ['g-11', '', 'Schaum']], baum, 'w')
  assert.deepEqual(befehle(p, 'de'), [{ op: 'node.move', args: { node: 'g-11', parent: 'g-2' } }])
})

test('kein Befehl loescht etwas', () => {
  const p = plan(kopf, [['g-1', 'Kleber', '']], baum, 'w')
  for (const c of befehle(p, 'de')) assert.ok(!/retire|remove|delete/i.test(c.op), c.op)
})

test('leere Zeilen in der Datei stoeren nicht', () => {
  const p = plan(kopf, [['g-1', 'Kleber', ''], ['', '', ''], ['g-11', '', 'Schaum']], baum, 'w')
  assert.deepEqual(p.fehler, [])
  assert.equal(p.gleich, 2)
})
