// Konfigurator, Datenmodell und Satzbildung der Ansicht (plugins/configurator/src): die Definition, wie der Server sie liest, und die Regel als Satz.
import test from 'node:test'
import assert from 'node:assert/strict'
import { newCondition, newEffect, nextRuleId, cleanDefinition, cleanSelector, expectFrom, compareCase, violationKey, KEY_PATTERN, emptyDefinition, templateRule, templateOf, TEMPLATES } from '../../plugins/configurator/src/model.js'
import { describeRule, describeCondition, describeEffect, describeSelector } from '../../plugins/configurator/src/describe.js'

const t = (k, p = []) => k.replace(/\{(\d+)\}/g, (_, i) => p[i] ?? '')
const names = { k1: 'CPU-Kühler 1', gk2: 'Grafikkarten-Kühler 2', graka: 'Grafikkarten', netz: 'Netzteil' }
const ctx = { t, nodeName: id => names[id] ?? id, attributeName: k => ({ leistung: 'Leistung' })[k] ?? k }

test('eine neue Bedingung bringt die Felder ihrer Art mit', () => {
  assert.deepEqual(newCondition('has'), { kind: 'has', selector: {}, value: 1 })
  assert.deepEqual(newCondition('count'), { kind: 'count', selector: {}, comparison: '>=', value: 1 })
  assert.equal(newCondition('sum').attribute, '')
  assert.equal(newCondition('balance').resource, '')
  for (const k of ['and', 'or', 'not']) assert.equal(newCondition(k).parts.length, 1)
  assert.equal(newCondition('gibtsnicht').kind, 'has', 'eine unbekannte Art fällt auf has zurück')
  assert.deepEqual(newEffect('limits'), { kind: 'limits', selector: {}, max: 1 })
  assert.deepEqual(newEffect('requires'), { kind: 'requires', selector: {}, min: 1 })
  assert.equal(newEffect('x').kind, 'forbids')
})

test('die nächste Kennung ist die erste freie', () => {
  assert.equal(nextRuleId([]), 'r1')
  assert.equal(nextRuleId([{ id: 'r1' }, { id: 'r3' }]), 'r2')
  assert.equal(nextRuleId([{ id: 'a' }]), 'r1')
})

test('beim Speichern fallen leere Felder weg und Zahlen werden Zahlen', () => {
  const sauber = cleanDefinition({
    label: ' Server ', root: '', resources: '  ',
    rules: [{
      id: 'psu', text: '', if: { kind: 'count', selector: { node: 'graka', attribute: '', comparison: '>=', value: '' }, comparison: '>=', value: '2', attribute: '', resource: '' },
      then: { kind: 'requires', selector: { attribute: 'leistung', comparison: '>=', value: '850' }, min: '1', max: '' },
    }],
  })
  assert.deepEqual(sauber, {
    label: 'Server',
    rules: [{
      id: 'psu',
      if: { kind: 'count', selector: { node: 'graka' }, comparison: '>=', value: 2 },
      then: { kind: 'requires', selector: { attribute: 'leistung', comparison: '>=', value: '850' }, min: 1 },
    }],
  })
  assert.deepEqual(cleanSelector({ comparison: '>=', value: '5' }), {}, 'Vergleich und Wert ohne Attribut gelten nicht')
  assert.deepEqual(cleanDefinition(emptyDefinition('x')), { label: 'x', rules: [] })
})

test('verschachtelte Bedingungen werden mit ihren Teilen aufgeräumt', () => {
  const c = cleanDefinition({ rules: [{ id: 'a', if: { kind: 'and', parts: [{ kind: 'has', selector: { node: 'x' }, value: 1 }, { kind: 'not', parts: [{ kind: 'balance', resource: ' pci ', comparison: '<=', value: 0 }] }] }, then: { kind: 'forbids', selector: { node: 'y' } } }] })
  assert.deepEqual(c.rules[0].if.parts[1].parts[0], { kind: 'balance', resource: 'pci', comparison: '<=', value: 0 })
})

test('ein Testfall erwartet zulässig, vollständig und die Schlüssel der Verstösse', () => {
  const r = {
    valid: false, complete: false,
    violations: [{ kind: 'rule', rule: 'k1-gk2' }, { kind: 'balance', group: 'kuehlmittel' }],
    missing: [{ kind: 'rule', rule: 'psu' }],
  }
  assert.deepEqual(expectFrom(r), { valid: false, complete: false, violations: ['balance:kuehlmittel', 'rule:k1-gk2'], missing: ['rule:psu'] })
  assert.equal(violationKey({ kind: 'balance', group: 'pci' }), 'balance:pci')
  assert.equal(violationKey({ kind: 'max', group: 'ram' }), 'max:ram')      // Vorgaben der Gruppen: Art und Gruppe
  assert.equal(violationKey({ kind: 'min', group: 'ram' }), 'min:ram')
})

test('der Vergleich eines Testfalls nennt, was abweicht', () => {
  const erwartet = { valid: true, complete: true, violations: [], missing: [] }
  assert.deepEqual(compareCase(erwartet, { valid: true, complete: true, violations: [], missing: [] }), { ok: true, differences: [] })
  const v = compareCase(erwartet, { valid: false, complete: true, violations: [{ kind: 'rule', rule: 'k1-gk2' }], missing: [] })
  assert.equal(v.ok, false)
  assert.deepEqual(v.differences, [{ what: 'valid', expected: true, actual: false }, { what: 'violations', expected: null, actual: 'rule:k1-gk2' }])
  const weg = compareCase({ valid: false, complete: true, violations: ['rule:a'], missing: [] }, { valid: false, complete: true, violations: [], missing: [] })
  assert.deepEqual(weg.differences, [{ what: 'violations', expected: 'rule:a', actual: null }])
})

test('der Schlüssel eines Konfigurators: a–z, 0–9, _ und -, mit einem Buchstaben vorn', () => {
  for (const k of ['server', 'a', 'pc-1', 'pc_2']) assert.ok(KEY_PATTERN.test(k), k)
  for (const k of ['', '1server', 'Server', 'ser ver', 'a/b', 'x'.repeat(41)]) assert.ok(!KEY_PATTERN.test(k), k)
})

test('eine Regel als Satz', () => {
  const k1 = { id: 'k', if: { kind: 'has', selector: { node: 'k1' }, value: 1 }, then: { kind: 'forbids', selector: { node: 'gk2' } } }
  assert.equal(describeRule(k1, ctx), 'Wenn CPU-Kühler 1 gewählt, dann Grafikkarten-Kühler 2 verboten')
  const psu = { id: 'p', if: { kind: 'count', selector: { node: 'graka' }, comparison: '>=', value: 2 }, then: { kind: 'requires', selector: { node: 'netz', attribute: 'leistung', comparison: '>=', value: '850' }, min: 1 } }
  assert.equal(describeRule(psu, ctx), 'Wenn Anzahl Grafikkarten ≥ 2, dann mindestens 1 von Netzteil (Leistung ≥ 850) verlangt')
  assert.equal(describeRule({ id: 'm', then: { kind: 'limits', selector: { node: 'graka' }, max: 4 } }, ctx), 'Immer: höchstens 4 von Grafikkarten')
})

test('Bedingungen als Satz: Menge, Summe, Bilanz, und, oder, nicht', () => {
  assert.equal(describeCondition({ kind: 'has', selector: { node: 'graka' }, value: 3 }, ctx), 'mindestens 3 × Grafikkarten gewählt')
  assert.equal(describeCondition({ kind: 'sum', selector: { node: 'graka' }, attribute: 'leistung', comparison: '>', value: 500 }, ctx), 'Summe Leistung von Grafikkarten > 500')
  assert.equal(describeCondition({ kind: 'balance', resource: 'pci_slot', comparison: '<=', value: 0 }, ctx), 'Bilanz pci_slot ≤ 0')
  assert.equal(describeCondition({ kind: 'and', parts: [{ kind: 'has', selector: { node: 'k1' } }, { kind: 'has', selector: { node: 'gk2' } }] }, ctx), 'CPU-Kühler 1 gewählt und Grafikkarten-Kühler 2 gewählt')
  assert.equal(describeCondition({ kind: 'or', parts: [{ kind: 'has', selector: { node: 'k1' } }, { kind: 'has', selector: { node: 'gk2' } }] }, ctx), 'CPU-Kühler 1 gewählt oder Grafikkarten-Kühler 2 gewählt')
  assert.equal(describeCondition({ kind: 'not', parts: [{ kind: 'has', selector: { node: 'netz' } }] }, ctx), 'nicht (Netzteil gewählt)')
  assert.equal(describeEffect({ kind: 'forbids', selector: {} }, ctx), 'jedes Teil verboten')
  assert.equal(describeSelector({ attribute: 'leistung', comparison: '<=', value: '300' }, ctx), 'Leistung ≤ 300')
})

test('Vorlagen: jede erzeugt eine Regel, die als dieselbe Form erkannt wird', () => {
  assert.deepEqual(TEMPLATES, ['excludes', 'needs', 'max', 'min'])
  for (const k of TEMPLATES) assert.equal(templateOf(templateRule('r', k)), k, k)
  assert.equal(templateOf(templateRule('r', 'eigene')), null, 'eine eigene Regel hat keine einfache Form')
})

test('templateOf: nur „hat A, dann …“ ohne Menge und ohne Verknüpfung ist einfach', () => {
  const has = { kind: 'has', selector: { node: 'a' } }
  const sel = { node: 'b' }
  assert.equal(templateOf({ if: has, then: { kind: 'forbids', selector: sel } }), 'excludes')
  assert.equal(templateOf({ if: { ...has, value: 1 }, then: { kind: 'requires', selector: sel, min: 2 } }), 'needs')
  assert.equal(templateOf({ then: { kind: 'limits', selector: sel, max: 2 } }), 'max')
  assert.equal(templateOf({ then: { kind: 'requires', selector: sel } }), 'min')
  assert.equal(templateOf({ if: { ...has, value: 3 }, then: { kind: 'forbids', selector: sel } }), null, 'mindestens 3 × A')
  assert.equal(templateOf({ if: { kind: 'count', selector: sel, comparison: '>=', value: 2 }, then: { kind: 'forbids', selector: sel } }), null)
  assert.equal(templateOf({ if: { kind: 'and', parts: [has, has] }, then: { kind: 'forbids', selector: sel } }), null)
  assert.equal(templateOf({ then: { kind: 'forbids', selector: sel } }), null, 'ohne Bedingung verbieten ist keine Vorlage')
  assert.equal(templateOf({ if: has, then: { kind: 'limits', selector: sel, max: 1 } }), null)
})

// ---- Konfiguratorgruppen: Zeilen an Teilen und Grenzen am Konfigurator

import { cleanRow, cleanRows, cleanLimit, cleanLimits, valuesOf, valuesText, rowKind, newRow } from '../../plugins/configurator/src/model.js'
import { describeRow } from '../../plugins/configurator/src/describe.js'

const gnames = { pci: 'PCI-Steckplätze', ram: 'RAM' }
const gctx = { ...ctx, nodeName: id => ({ board: 'Mainboard XYZ', geh: 'Gehäuse ABC' })[id] ?? id, groupName: k => gnames[k] ?? k }

test('eine Zeile als Mitglied: nur ihre Felder, Zahlen als Zahlen, leere Felder fallen weg', () => {
  assert.deepEqual(cleanRow({ group: ' pci ', provides: '2', consumes: '', value: ' ' }), { group: 'pci', provides: 2 })
  assert.deepEqual(cleanRow({ group: 'pci', art: 'member', provides: 2, min: 3, values: ['x'] }), { group: 'pci', provides: 2 }, 'die gewählte Art zählt, Felder der anderen fallen weg')
  assert.deepEqual(cleanRow({ group: 'ram', value: ' 8 ' }), { group: 'ram', value: '8' })
  assert.deepEqual(cleanRow(newRow('member', 'pci')), { group: 'pci' }, 'ein Mitglied ohne Zahlen zählt nur')
  assert.deepEqual(cleanRow({ group: 'pci', provides: 2, when: { kind: 'has', selector: { node: 'board' }, value: 1 } }), { group: 'pci', provides: 2, when: { kind: 'has', selector: { node: 'board' }, value: 1 } })
})

test('eine Zeile als Vorgabe: Mindest-, Höchstmenge und die Werte als Liste', () => {
  assert.deepEqual(cleanRow({ group: 'ram', min: '2', max: 2, valuesText: ' 8, 32 ,, ', provides: 5 }), { group: 'ram', min: 2, max: 2, values: ['8', '32'] })
  assert.equal(rowKind({ group: 'ram', min: 2 }), 'limit'); assert.equal(rowKind({ group: 'ram', values: ['8'] }), 'limit')
  assert.equal(rowKind({ group: 'ram', provides: 1 }), 'member'); assert.equal(rowKind({ group: 'ram' }), 'member')
  assert.equal(rowKind({ group: 'ram', art: 'limit' }), 'limit', 'was der Anwender gewählt hat, geht vor — auch ohne Angaben')
  assert.deepEqual(cleanRows([{ group: 'a', art: 'limit', max: 1 }, { group: 'b' }]), [{ group: 'a', max: 1 }, { group: 'b' }])
})

test('erlaubte Werte: aus Text oder Liste, getrimmt, ohne Leeres; die Eingabe geht vor, solange sie getippt wird', () => {
  assert.deepEqual(valuesOf('8, 32'), ['8', '32']); assert.deepEqual(valuesOf([' 8 ', '', 32]), ['8', '32']); assert.deepEqual(valuesOf(undefined), [])
  assert.equal(valuesText({ values: ['8', '32'] }), '8, 32'); assert.equal(valuesText({ values: ['8'], valuesText: '8, ' }), '8, ')
  assert.equal(valuesText({}), '')
})

test('eine Grenze am Konfigurator, und die Definition nimmt sie nur mit Angaben auf', () => {
  assert.deepEqual(cleanLimit({ group: ' ram ', min: '1', max: '', valuesText: '8,16' }), { group: 'ram', min: 1, values: ['8', '16'] })
  assert.deepEqual(cleanLimits(undefined), [])
  assert.equal('limits' in cleanDefinition({ rules: [], limits: [] }), false, 'keine Grenzen: kein Feld, die Definition bleibt, wie sie war')
  assert.deepEqual(cleanDefinition({ rules: [], limits: [{ group: 'ram', max: 2 }] }).limits, [{ group: 'ram', max: 2 }])
})

test('Zeilen als Satz: Mitglied, Vorgabe, mit Bedingung', () => {
  assert.equal(describeRow({ group: 'pci', provides: 2, when: { kind: 'has', selector: { node: 'board' }, value: 1 } }, gctx), 'PCI-Steckplätze: stellt 2 bereit, wenn Mainboard XYZ gewählt')
  assert.equal(describeRow({ group: 'pci', consumes: 1, provides: 2 }, gctx), 'PCI-Steckplätze: stellt 2 bereit, verbraucht 1')
  assert.equal(describeRow({ group: 'ram', value: '8' }, gctx), 'RAM: Wert 8')
  assert.equal(describeRow({ group: 'ram' }, gctx), 'RAM: Mitglied')
  assert.equal(describeRow({ group: 'ram', min: 2, max: 2, values: ['8', '32'] }, gctx), 'RAM: genau 2 Teile, Werte 8, 32')
  assert.equal(describeRow({ group: 'ram', min: 1, max: 4 }, gctx), 'RAM: 1 bis 4 Teile')
  assert.equal(describeRow({ group: 'ram', min: 2 }, gctx), 'RAM: mindestens 2 Teile')
  assert.equal(describeRow({ group: 'ram', max: 2, when: { kind: 'has', selector: { node: 'geh' }, value: 1 } }, gctx), 'RAM: höchstens 2 Teile, wenn Gehäuse ABC gewählt')
  assert.equal(describeRow({ group: 'x', provides: 0 }, gctx), 'x: stellt 0 bereit', 'null ist eine Angabe')
  assert.equal(describeRow({ group: 'ram', values: ['8'], valuesText: '8, 16' }, gctx), 'RAM: Werte 8, 16', 'die getippten Werte gehen vor')
})
