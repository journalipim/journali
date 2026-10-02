// EmpCo, Befunde ohne Oberfläche (plugins/empco/src/befunde.js): aus den Tabellen die Befunde bilden, Geerbtes zusammenfassen, nach Begriff gruppieren,
// den Ausschnitt mit dem Begriff zeigen, ersetzen und eine Ausnahme erkennen, solange der Text derselbe ist.
import test from 'node:test'
import assert from 'node:assert/strict'

const B = await import('../../plugins/empco/src/befunde.js')

const col = { key: 'beschreibung', type: 'text' }
const zeile = (id, label, role, value, from = null) => ({ row: { id, label, role }, values: { beschreibung: { value, own: !from, from } }, inactive: [] })
const tabelle = rows => ({ columns: [col], rows })

test('collect: ein Befund je Regel, Begriff und Feld — mit Knoten, Wert und Schwere', () => {
  const f = B.collect([tabelle([zeile('p1', 'Kleber', 'product', 'Ein umweltfreundliches Produkt'), zeile('p2', 'Anderer', 'product', 'Mit 30 % Rezyklat')])], ['de'])
  assert.equal(f.length, 1)
  assert.equal(f[0].node.id, 'p1'); assert.equal(f[0].rule, 'generic'); assert.equal(f[0].severity, 'error')
  assert.equal(f[0].term.toLowerCase(), 'umweltfreundliches'); assert.equal(f[0].locale, 'de'); assert.equal(f[0].raw, 'Ein umweltfreundliches Produkt')
  assert.deepEqual(f[0].heirs, [])
})

test('collect: ein geerbter Wert ist beim Knoten, von dem er kommt — die Erben stehen dort, nicht noch einmal', () => {
  const wert = 'Ein umweltfreundliches Produkt'
  const f = B.collect([tabelle([zeile('p1', 'Produkt', 'product', wert), zeile('v1', 'Variante 1', 'variant', wert, 'p1'), zeile('v2', 'Variante 2', 'variant', wert, 'p1')])], ['de'])
  assert.equal(f.length, 1, 'ein Befund statt drei')
  assert.deepEqual(f[0].heirs.map(h => h.id), ['v1', 'v2'])
  assert.equal(B.targetId(f[0]), 'p1')
})

test('collect: kommt der Wert von einem Knoten ausserhalb der Prüfung, bleibt der Befund beim Erben und wird dort geändert, wo der Wert steht', () => {
  const f = B.collect([tabelle([zeile('v1', 'Variante', 'variant', 'Ein umweltfreundliches Produkt', 'p9')])], ['de'])
  assert.equal(f.length, 1); assert.equal(f[0].node.id, 'v1'); assert.equal(B.targetId(f[0]), 'p9')
})

test('collect: je Sprache ein Befund, auch bei demselben Knoten', () => {
  const de = tabelle([zeile('p1', 'Kleber', 'product', 'umweltfreundlich')]), en = tabelle([zeile('p1', 'Kleber', 'product', 'eco-friendly')])
  assert.deepEqual(B.collect([de, en], ['de', 'en']).map(f => f.locale), ['de', 'en'])
})

test('snippet: der Begriff mit ein paar Zeichen davor und danach, die Ränder gekürzt', () => {
  const lang = 'Anfang '.repeat(10) + 'ist umweltfreundlich bei ' + 'Ende '.repeat(10)
  const s = B.snippet(lang, 'umweltfreundlich', 20)
  assert.equal(s.term, 'umweltfreundlich')
  assert.ok(s.before.startsWith('…') && s.after.endsWith('…'))
  assert.ok(s.before.length <= 21 && s.after.length <= 21)
  const ohne = B.snippet('<p>Nichts zu sehen</p>', 'grün', 40)
  assert.deepEqual([ohne.before, ohne.term, ohne.after], ['Nichts zu sehen', '', ''])
})

test('snippet liest den Text ohne Markup, wie die Regel ihn sieht', () => {
  const s = B.snippet('<p>Ein <b>grünes</b> Produkt</p>', 'grünes', 40)
  assert.equal(s.term, 'grünes'); assert.equal(s.before.trim(), 'Ein'); assert.equal(s.after.trim(), 'Produkt')
})

test('replace: ersetzt die Grundform, die Endung bleibt, ohne Beachtung der Schreibweise, in jeder Fundstelle — auch mit Markup', () => {
  assert.equal(B.replace('Ein umweltfreundliches Produkt', 'generic', 'umweltfreundliches', 'ressourcenschonend'), 'Ein ressourcenschonendes Produkt', 'die Endung bleibt')
  assert.equal(B.replace('<p>Umweltfreundlich und umweltfreundliche Sache</p>', 'generic', 'umweltfreundlich', 'robust'), '<p>robust und robuste Sache</p>', 'beide Fundstellen, jede mit ihrer Endung')
  assert.equal(B.replace('nichts', 'generic', 'x', 'y'), 'nichts')
  assert.equal(B.replace(undefined, 'generic', 'x', 'y'), '')
})

test('byTerm: gleiche Begriffe (ohne Beachtung der Schreibweise und der Endung) je Regel zusammen, die häufigsten zuerst', () => {
  const f = B.collect([tabelle([
    zeile('a', 'A', 'product', 'umweltfreundlich'), zeile('b', 'B', 'product', 'Umweltfreundliches'), zeile('c', 'C', 'product', 'klimaneutral'), zeile('d', 'D', 'product', 'umweltfreundlich'),
  ])], ['de'])
  const g = B.byTerm(f)
  assert.deepEqual(g.map(x => [x.term.toLowerCase(), x.findings.length]), [['umweltfreundlich', 3], ['klimaneutral', 1]])
  assert.equal(g[0].rule, 'generic')
})

test('Ausnahme: gilt, solange der Text derselbe ist, und nur für diesen Befund', () => {
  const [f] = B.collect([tabelle([zeile('p1', 'Kleber', 'product', 'Ein umweltfreundliches Produkt')])], ['de'])
  const name = B.ignoreName(f)
  assert.match(name, /^ignore:p1:beschreibung:de:generic:[a-z0-9]+$/, 'ein Name ohne Zeichen, die in den Plugin-Daten nicht gehen')
  const map = { [name]: { hash: B.textHash(f.raw), reason: 'Fachbegriff' } }
  assert.equal(B.ignored(f, map), true)
  assert.equal(B.ignored({ ...f, raw: 'Ein umweltfreundliches Produkt aus Holz' }, map), false, 'der Text hat sich geändert: der Befund gilt wieder')
  assert.equal(B.ignored(f, {}), false)
  assert.equal(B.textHash('<b>Ein</b>  Text'), B.textHash('Ein Text'), 'Markup und Leerraum zählen nicht')
})

test('filter: Regel, Schwere, Text und Ausnahmen; die Zahlen je Regel', () => {
  const f = B.collect([tabelle([zeile('a', 'Alpha', 'product', 'umweltfreundlich'), zeile('b', 'Beta', 'product', 'Der Spezialist für langlebige Teile'), zeile('c', 'Gamma', 'product', 'klimaneutral')])], ['de'])
  assert.equal(f.length, 3)
  assert.equal(B.filter(f, { rule: 'generic' }).length, 1)
  assert.deepEqual(B.filter(f, { sev: ['error'] }).map(x => x.node.id).sort(), ['a', 'c'])
  assert.equal(B.filter(f, { text: 'beta' }).length, 1); assert.equal(B.filter(f, { text: 'umwelt' }).length, 1, 'der Begriff zählt mit')
  const map = { [B.ignoreName(f[0])]: { hash: B.textHash(f[0].raw) } }
  assert.equal(B.filter(f, {}, map).length, 2, 'Ausnahmen sind aus der Liste')
  assert.equal(B.filter(f, { showIgnored: true }, map).length, 3)
  const z = B.countsByRule(f)
  assert.equal(z.generic, 1); assert.equal(z.neutral, 1); assert.equal(Object.values(z).reduce((x, y) => x + y, 0), 3)
})

test('Wortgrenzen mit Umlauten: „grün“, „ökologisch“ und „öko“ werden gefunden — \b kennt ö und ü nicht', () => {
  const f = B.collect([tabelle([zeile('a', 'A', 'product', 'Ein ökologisches Produkt'), zeile('b', 'B', 'product', 'Das ist grün'), zeile('c', 'C', 'product', 'Öko pur'), zeile('d', 'D', 'product', 'Die grüne Welle'), zeile('e', 'E', 'product', 'Ökonomisch und grünlich')])], ['de'])
  assert.deepEqual(f.map(x => x.node.id + ':' + x.base.toLowerCase()).sort(), ['a:ökologisch', 'b:grün', 'c:öko', 'd:grün'], 'ökonomisch und grünlich sind andere Wörter')
})
