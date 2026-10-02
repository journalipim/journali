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
