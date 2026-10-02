// ⚙ Konfigurator → Gruppen (docs/pflegestruktur.md 40): Gruppen anlegen und bearbeiten, Zeilen an Teilen pflegen (Mitglied und Vorgabe, mit Bedingung),
// Grenzen am Konfigurator, und die Prüfung zeigt die Gruppen und welches Teil eine Gruppe im Minus anhebt. Bedient wie vom Anwender; der Server ist ein
// Stellvertreter, der sich merkt, was in die Plugin-Daten geschrieben wird.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'
import { tree } from '../src/tree.js'

const View = (await import('../../plugins/configurator/src/View.vue')).default

tree.byId = new Map([['board', { id: 'board', label: 'Mainboard XYZ' }], ['cpu1', { id: 'cpu1', label: 'CPU 1' }], ['ram8', { id: 'ram8', label: 'RAM 8 GB' }]])
store.model = { attributes: [{ key: 'leistung', label: { de: 'Leistung' } }] }

const OK = { valid: true, complete: true, selection: [], violations: [], missing: [], balance: {}, groups: {}, selectable: [] }
const STUB = { global: { stubs: { TreePicker: { emits: ['pick'], methods: { gewaehlt: () => ({ id: globalThis.__gewaehlt }) }, template: `<div class="tp-stub" @click="$emit('pick', gewaehlt())">Baum</div>` } } } }
const warte = (ms = 260) => new Promise(r => setTimeout(r, ms)).then(flushPromises)
const sauber = o => JSON.parse(JSON.stringify(o))

const PCI = { key: 'pci', label: 'PCI-Steckplätze', equal: false, defined: true, members: 1 }
const STECK = { key: 'cpustecklatz', label: null, equal: false, defined: false, members: 1 }
const RAM = { key: 'ram', label: 'RAM', equal: false, defined: true, members: 0 }
const CPU1 = { node: 'cpu1', rows: [{ group: 'cpustecklatz', consumes: 1 }, { group: 'pci', provides: 2, when: { kind: 'has', selector: { node: 'board' }, value: 1 } }] }
const BOARD = { node: 'board', rows: [{ group: 'ram', min: 2, max: 2, values: ['8', '32'] }] }

function welt({ groups = [PCI, STECK, RAM], parts = [CPU1, BOARD], errors = [], defs = { server: { label: 'Server', rules: [] } }, check = () => OK } = {}) {
  groups = sauber(groups); parts = sauber(parts)
  const gesendet = [], toasts = []
  const orig = { get: api.get, post: api.post, del: api.del, toast: store.toast, confirm: dialog.confirm }
  api.get = async p => {
    if (p === '/api/configurator') return Object.entries(defs).map(([key, d]) => ({ key, label: d.label, root: d.root, rules: (d.rules ?? []).length, errors: 0 }))
    if (p === '/api/configurator-groups') return sauber({ groups, parts, errors })   // wie vom Netz: jedes Mal neu
    const m = /^\/api\/configurator\/([^/?]+)$/.exec(p)
    if (m) return { key: m[1], definition: defs[m[1]], errors: [] }
    if (p.startsWith('/api/plugins/configurator/data?prefix=')) return []
    throw new Error('GET ' + p)
  }
  api.post = async (p, body, method = 'POST') => {
    const pfad = decodeURIComponent(p)
    gesendet.push({ p: pfad, body: sauber(body), method })
    const name = /\/data\/(.+)$/.exec(pfad)?.[1]
    if (method === 'PUT' && name?.startsWith('def:')) defs[name.slice(4)] = body
    if (method === 'PUT' && name?.startsWith('group:')) {
      const key = name.slice(6), g = groups.find(x => x.key === key)
      if (g) Object.assign(g, { label: body.label ?? null, equal: !!body.equal }); else groups.push({ key, label: body.label ?? null, equal: !!body.equal, defined: true, members: 0 })
    }
    if (method === 'PUT' && name?.startsWith('member:')) {
      const node = name.slice(7), i = parts.findIndex(x => x.node === node), eintrag = { node, rows: sauber(body.rows) }
      if (i >= 0) parts[i] = eintrag; else parts.push(eintrag)
    }
    return /\/check$/.test(pfad) ? check(body, pfad) : {}
  }
  api.del = async p => {
    const pfad = decodeURIComponent(p); gesendet.push({ p: pfad, method: 'DELETE' })
    const name = /\/data\/(.+)$/.exec(pfad)?.[1]
    if (name?.startsWith('group:')) groups.splice(groups.findIndex(x => x.key === name.slice(6)), 1)
    if (name?.startsWith('member:')) parts.splice(parts.findIndex(x => x.node === name.slice(7)), 1)
    return {}
  }
  dialog.confirm = async () => true
  store.toast = (...a) => toasts.push(a)
  return { gesendet, toasts, groups, parts, defs, ende: () => { Object.assign(api, { get: orig.get, post: orig.post, del: orig.del }); store.toast = orig.toast; dialog.confirm = orig.confirm } }
}

/// Die Ansicht mit offenem Konfigurator „server“ und dem Reiter Gruppen
async function oeffnen(s, extra = {}) {
  const w = mount(View, { ...STUB, ...extra }); await flushPromises()
  await w.findAll('tbody tr').find(r => r.text().includes('server')).trigger('click'); await flushPromises()
  await w.find('.reiter-gruppen').trigger('click'); await flushPromises()
  return w
}
const zeilenText = w => w.findAll('.gruppen .liste tbody tr').map(r => r.text().replace(/\s+/g, ' ').trim())
const teile = w => w.findAll('.teile tbody tr').map(r => r.text().replace(/\s+/g, ' ').trim())
/// Die Zeile eines Teils in der Liste, nach dem Namen in der ersten Spalte (die Sätze in der zweiten nennen auch andere Teile)
const teil = (w, name) => w.findAll('.teile tbody tr').find(r => r.find('td').text() === name)
const gruppe = (w, key) => w.findAll('.gruppen .liste tbody tr').find(r => r.text().includes(key))
const knopf = (w, titel) => w.findAll('button').find(b => b.attributes('title') === titel)

test('der Reiter Gruppen listet die Gruppen mit der Zahl ihrer Mitglieder und die Teile mit ihren Zeilen als Satz', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    assert.match(zeilenText(w)[0], /PCI-Steckplätze\s*pci\s*1/)
    assert.match(zeilenText(w)[1], /cpustecklatz\s*1/, 'ohne Bezeichnung steht der Schlüssel')
    assert.equal(teile(w).length, 2)
    assert.match(teile(w)[0], /CPU 1.*cpustecklatz: verbraucht 1 · PCI-Steckplätze: stellt 2 bereit, wenn Mainboard XYZ gewählt/)
    assert.match(teile(w)[1], /Mainboard XYZ.*RAM: genau 2 Teile, Werte 8, 32/)
  } finally { w.unmount(); s.ende() }
})

test('eine Gruppe wählen zeigt nur die Teile, die in ihr Zeilen haben', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await gruppe(w, 'pci').trigger('click')
    assert.equal(teile(w).length, 1); assert.match(teile(w)[0], /CPU 1/)
    await gruppe(w, 'ram').trigger('click')
    assert.equal(teile(w).length, 1); assert.match(teile(w)[0], /Mainboard XYZ/)
  } finally { w.unmount(); s.ende() }
})

test('was der Server an Gruppen und Zeilen bemängelt, steht darüber', async () => {
  const s = welt({ errors: ['Teil cpu1, Zeile 2: „stellt bereit“ braucht eine Zahl ab 0.'] })
  const w = await oeffnen(s)
  try { assert.match(w.find('.fehler').text(), /Teil cpu1, Zeile 2/) } finally { w.unmount(); s.ende() }
})

test('eine Gruppe anlegen schreibt group:<key> und wählt sie', async () => {
  const s = welt({ groups: [], parts: [] })
  const w = await oeffnen(s)
  try {
    const eingabe = w.find('.neue-gruppe')
    await eingabe.setValue('Ram X')
    assert.ok(w.find('.gruppen .neu button').attributes('disabled') !== undefined, 'ein Schlüssel mit Grossbuchstaben und Leerzeichen gilt nicht')
    await eingabe.setValue('ram')
    await w.find('.gruppen .neu').trigger('submit'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT' && g.p.includes('group:'))
    assert.equal(put.p, '/api/plugins/configurator/data/group:ram'); assert.deepEqual(put.body, {})
    assert.match(zeilenText(w)[0], /ram/)
    assert.ok(w.find('.gruppen .bez').exists(), 'die neue Gruppe ist gewählt: ihre Bezeichnung steht zur Bearbeitung da')
    assert.equal(w.find('.neue-gruppe').element.value, '', 'das Feld ist wieder leer')
  } finally { w.unmount(); s.ende() }
})

test('Bezeichnung und „alle Werte gleich“ einer Gruppe speichern; Speichern geht erst nach einer Änderung', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await gruppe(w, 'ram').trigger('click')
    const speichern = () => w.find('.speichern-gruppe')
    assert.ok(speichern().attributes('disabled') !== undefined, 'nichts geändert')
    await w.find('.gruppen .bez').setValue('RAM-Kapazität')
    await w.find('.gleich input').setValue(true)
    assert.equal(speichern().attributes('disabled'), undefined)
    await speichern().trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT' && g.p.endsWith('group:ram'))
    assert.deepEqual(put.body, { label: 'RAM-Kapazität', equal: true })
    assert.match(zeilenText(w).find(z => z.includes('RAM-Kapazität')), /＝/, 'die Liste zeigt „alle Werte gleich“')
    assert.ok(s.toasts.some(t => t[0] === 'Gespeichert'))
    assert.ok(speichern().attributes('disabled') !== undefined, 'danach ist der Stand wieder gleich')
  } finally { w.unmount(); s.ende() }
})

test('eine Gruppe entfernen fragt nach und löscht group:<key>', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await gruppe(w, 'ram').trigger('click')
    await w.find('.entfernen-gruppe').trigger('click'); await flushPromises()
    assert.ok(s.gesendet.some(g => g.method === 'DELETE' && g.p.endsWith('group:ram')))
    assert.equal(w.find('.gruppen .bez').exists(), false)
  } finally { w.unmount(); s.ende() }
})

test('ein Teil wählen, eine Zeile als Mitglied eintragen und speichern schreibt member:<knoten>; die Gruppe ist die gewählte', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await gruppe(w, 'ram').trigger('click')
    await w.find('.neues-teil').trigger('click')
    globalThis.__gewaehlt = 'ram8'
    await w.find('.tp-stub').trigger('click'); await flushPromises()
    assert.equal(w.findAll('.teil .zeile').length, 1)
    assert.equal(w.find('.teil .grp').element.value, 'ram', 'die gewählte Gruppe ist vorbelegt')
    await w.find('.teil .wert').setValue('8')
    await w.find('.teil .speichern').trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT' && g.p.includes('member:'))
    assert.equal(put.p, '/api/plugins/configurator/data/member:ram8')
    assert.deepEqual(put.body, { rows: [{ group: 'ram', value: '8' }] })
    assert.match(teile(w).join('|'), /RAM 8 GB.*RAM: Wert 8/, 'das Teil steht jetzt in der Liste')
  } finally { w.unmount(); s.ende() }
})

test('eine Zeile mit Bedingung: „wenn“ zeigt die Bedingung ohne Bilanz, gespeichert wird sie mit der Zeile', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await teil(w, 'CPU 1').trigger('click')
    assert.equal(w.findAll('.teil .zeile').length, 2)
    await w.find('.teil .neue-zeile').trigger('click')
    const neue = w.findAll('.teil .zeile')[2]
    await neue.find('.grp').setValue('cpucooler')
    await neue.find('.verbraucht').setValue('2')
    await neue.find('.wenn input').setValue(true)
    const arten = neue.findAll('select.kind option').map(o => o.attributes('value'))
    assert.deepEqual(arten, ['has', 'count', 'sum', 'and', 'or', 'not'], 'nach der Bilanz einer Gruppe darf eine Zeile nicht fragen')
    await w.find('.teil .speichern').trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT' && g.p.endsWith('member:cpu1'))
    assert.deepEqual(put.body.rows[2], { group: 'cpucooler', consumes: 2, when: { kind: 'has', selector: {}, value: 1 } })
    assert.deepEqual(put.body.rows[1].when, CPU1.rows[1].when, 'die vorhandenen Zeilen bleiben, wie sie waren')
  } finally { w.unmount(); s.ende() }
})

test('eine Vorgabe zeigt Mindest-, Höchstmenge und erlaubte Werte; die Werte werden als Liste gespeichert', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await teil(w, 'Mainboard XYZ').trigger('click')
    const z = w.find('.teil .zeile')
    assert.equal(z.find('select.art').element.value, 'limit')
    assert.equal(z.find('.min').element.value, '2'); assert.equal(z.find('.max').element.value, '2')
    assert.equal(z.find('.werte').element.value, '8, 32')
    assert.equal(z.find('.bereit').exists(), false, 'eine Vorgabe stellt nichts bereit')
    await z.find('.werte').setValue('8, 16 ,')
    assert.match(z.find('.satz').text(), /RAM: genau 2 Teile, Werte 8, 16/, 'der Satz folgt der Eingabe')
    await w.find('.teil .speichern').trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT' && g.p.endsWith('member:board'))
    assert.deepEqual(put.body, { rows: [{ group: 'ram', min: 2, max: 2, values: ['8', '16'] }] })
  } finally { w.unmount(); s.ende() }
})

test('die Art einer Zeile wechseln zeigt die Felder der anderen Art, und nur deren Felder werden gespeichert', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await teil(w, 'CPU 1').trigger('click')
    const z = w.findAll('.teil .zeile')[0]
    assert.equal(z.find('select.art').element.value, 'member')
    await z.find('select.art').setValue('limit')
    assert.ok(z.find('.min').exists()); assert.equal(z.find('.verbraucht').exists(), false)
    await z.find('.max').setValue('3')
    await w.find('.teil .speichern').trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT' && g.p.endsWith('member:cpu1'))
    assert.deepEqual(put.body.rows[0], { group: 'cpustecklatz', max: 3 }, 'das „verbraucht 1“ der anderen Art ist nicht dabei')
  } finally { w.unmount(); s.ende() }
})

test('eine Zeile ohne Gruppe lässt sich nicht speichern', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await w.find('.neues-teil').trigger('click')
    globalThis.__gewaehlt = 'ram8'
    await w.find('.tp-stub').trigger('click'); await flushPromises()
    await w.find('.teil .wert').setValue('8')
    assert.ok(w.find('.teil .speichern').attributes('disabled') !== undefined, 'die Gruppe fehlt')
    await w.find('.teil .grp').setValue('ram')
    assert.equal(w.find('.teil .speichern').attributes('disabled'), undefined)
    await w.find('.teil .grp').setValue('Ram X')
    assert.ok(w.find('.teil .speichern').attributes('disabled') !== undefined, 'ein Schlüssel mit Grossbuchstaben und Leerzeichen gilt nicht')
  } finally { w.unmount(); s.ende() }
})

test('alle Zeilen eines Teils entfernen und speichern löscht member:<knoten>', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await teil(w, 'Mainboard XYZ').trigger('click')
    await knopf(w, 'Zeile entfernen').trigger('click')
    await w.find('.teil .speichern').trigger('click'); await flushPromises()
    assert.ok(s.gesendet.some(g => g.method === 'DELETE' && g.p.endsWith('member:board')))
    assert.equal(w.find('.teil').exists(), false)
    assert.equal(teile(w).length, 1)
  } finally { w.unmount(); s.ende() }
})

test('ein Teil mit allen Zeilen entfernen fragt nach', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await teil(w, 'CPU 1').trigger('click')
    await w.find('.teil .entfernen').trigger('click'); await flushPromises()
    assert.ok(s.gesendet.some(g => g.method === 'DELETE' && g.p.endsWith('member:cpu1')))
    assert.equal(teile(w).length, 1)
  } finally { w.unmount(); s.ende() }
})

test('Grenzen am Konfigurator: eine Zeile je Gruppe, gespeichert mit dem Konfigurator (def:<key>)', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    assert.match(w.find('.grenzen .step-band').text(), /Grenzen dieses Konfigurators · 0/)
    await w.find('.neue-grenze').trigger('click')
    const z = w.find('.grenzen tbody tr')
    await z.find('.grp').setValue('ram')
    await z.findAll('input.zahl')[0].setValue('1'); await z.findAll('input.zahl')[1].setValue('2')
    await z.find('.werte').setValue('8, 16')
    assert.match(z.find('.satz').text(), /RAM: 1 bis 2 Teile, Werte 8, 16/)
    await w.find('.primary').trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT' && g.p.endsWith('def:server'))
    assert.deepEqual(put.body.limits, [{ group: 'ram', min: 1, max: 2, values: ['8', '16'] }])
    // und wieder geöffnet stehen sie da
    assert.equal(w.findAll('.grenzen tbody tr').length, 1)
    assert.equal(w.find('.grenzen .werte').element.value, '8, 16')
  } finally { w.unmount(); s.ende() }
})

test('eine leere Grenze wird nicht gespeichert: ohne Angaben ist die Definition unverändert', async () => {
  const s = welt()
  const w = await oeffnen(s)
  try {
    await w.find('.neue-grenze').trigger('click')
    assert.equal(w.find('.grenzen tbody tr').find('.satz').text(), '', 'ohne Angaben kein Satz')
    await w.find('.grenzen .grp').setValue('ram')
    assert.equal(w.find('.grenzen .satz').text(), '')
    await w.find('.primary').trigger('click'); await flushPromises()
    const put = s.gesendet.find(g => g.method === 'PUT' && g.p.endsWith('def:server'))
    assert.deepEqual(put.body.limits, [{ group: 'ram' }], 'der Server meldet sie als Fehler der Definition')
  } finally { w.unmount(); s.ende() }
})

test('Prüfen zeigt die Gruppen mit Vorgabe und an einem wählbaren Teil, welche Gruppe im Minus es anhebt', async () => {
  const ergebnis = {
    valid: false, complete: false, selection: [{ ref: 'cpu', id: 'cpu', name: 'CPU 1', amount: 1 }],
    violations: [{ kind: 'balance', text: 'Kühlpaste: 1 verbraucht, nur 0 bereit.', affects: ['cpu'], group: 'paste' }],
    missing: [{ kind: 'min', text: 'RAM: 1 Teile, mindestens 2.', affects: ['board'], group: 'ram' }],
    balance: { paste: { provided: 0, consumed: 1, free: -1 } },
    groups: { paste: { label: 'Kühlpaste', count: 1, min: null, max: null, allowed: null, values: [] }, ram: { label: 'RAM-Kapazität', count: 1, min: 2, max: 2, allowed: ['8', '32'], values: ['8'] } },
    selectable: [
      { id: 'p1', name: 'Paste 1', keys: {}, ok: true, reasons: [], lifts: ['paste'] },
      { id: 'k1', name: 'Kabel', keys: {}, ok: true, reasons: [], lifts: [] },
    ],
  }
  const s = welt({ check: () => ergebnis })
  const w = await oeffnen(s)
  try {
    await w.findAll('.tabs button').find(b => b.text().includes('Prüfen')).trigger('click'); await warte()
    const text = w.text().replace(/\s+/g, ' ')
    assert.match(text, /Kühlpaste.*0.*1.*-1/, 'die Bilanz nennt die Gruppe mit ihrer Bezeichnung')
    assert.match(w.find('.gruppentabelle').text().replace(/\s+/g, ' '), /RAM-Kapazität\s*1\s*2\s*8, 32\s*→ 8/, 'Teile, Vorgabe, erlaubte und vorkommende Werte')
    assert.equal(w.findAll('.hebt').length, 1, 'nur das Teil, das die Summe anhebt')
    assert.match(w.find('.hebt').text(), /↑ Kühlpaste/)
    assert.match(text, /◐ RAM: 1 Teile, mindestens 2\./, 'eine Mindestmenge, die fehlt, ist unvollständig')
  } finally { w.unmount(); s.ende() }
})
