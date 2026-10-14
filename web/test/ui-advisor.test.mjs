// ⇪ Export → Produktberatung (plugins/advisor/src/View.vue): Berater anlegen, einrichten, speichern; ein Token für den Dienst; die Vorschau stellt
// dieselbe Frage wie ein Besucher. Der Server ist vorgetäuscht (api.get/post/del).
import test from 'node:test'
import assert from 'node:assert/strict'
import { win, button } from './ui.mjs'
import { mount } from '@vue/test-utils'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'

const warte = async w => { for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick() } }

async function welt({ daten = {}, fehler = [], antwort = null } = {}) {
  const get = api.get, post = api.post, del = api.del, confirm = dialog.confirm
  const gesendet = []
  const gespeichert = { 'def:shop': { label: 'Shop', pub: 'r1', role: 'reader', view: 'sellable', locales: ['de'], greeting: { de: 'Hallo' }, ki: false, mcp: true, origins: ['https://shop.example'], limits: { jeTag: 500 } }, ...daten }
  let tokens = [{ id: 'abcdef123456', label: 'Dienst', at: '2026-10-08T10:00:00Z' }]
  api.get = async p => {
    if (p === '/api/advisor') return Object.keys(gespeichert).map(k => ({ key: k.slice(4), label: gespeichert[k].label, pub: gespeichert[k].pub, errors: k === 'def:shop' ? fehler : [] }))
    if (p === '/api/pub') return [{ id: 'r1', label: 'Online-Shop', channel: 'web', market: null }, { id: 'r2', label: 'Katalog', channel: 'print', market: 'de' }]
    if (p === '/api/auth/roles') return [{ key: 'admin', label: 'Administrator' }, { key: 'reader', label: 'Leser' }]
    if (p === '/api/teams') return [{ key: 'init', label: 'Init Team' }]
    if (p.startsWith('/api/plugins/advisor/data/')) return gespeichert[decodeURIComponent(p.split('/').pop())] ?? null
    if (p === '/api/advisor/shop/tokens') return tokens
    return []
  }
  api.post = async (p, body, m = 'POST') => {
    gesendet.push([m, p, body])
    if (m === 'PUT' && p.startsWith('/api/plugins/advisor/data/')) { gespeichert[decodeURIComponent(p.split('/').pop())] = body; return {} }
    if (p === '/api/advisor/shop/tokens') { tokens = [...tokens, { id: '999999aaaaaa', label: body.label, at: '2026-10-08T11:00:00Z' }]; return { token: 'ja_neu', label: body.label } }
    if (p === '/api/advisor/shop/preview' && antwort) return antwort
    if (p === '/api/advisor/shop/preview') return { total: 2, hits: [{ id: 'p1', name: 'Bohrhammer Pro', values: [{ label: 'Leistung', value: '800 W' }] }, { id: 'p2', name: 'Akkuschrauber', values: [] }], facets: [{ key: 'color', label: 'Farbe' }], warning: 'Plugin embed ist aus.',
      words: ['bohrhammer'], filter: [{ attribute: 'color', op: 'eq', value: 'red', label: 'Farbe', valueLabel: 'Rot' }], texte: { satz: '2 Produkte passen zu „bohrhammer“.', hinweise: [] } }
    return {}
  }
  api.del = async p => { gesendet.push(['DELETE', p]); if (p.startsWith('/api/plugins/advisor/data/')) delete gespeichert[decodeURIComponent(p.split('/').pop())]; return {} }
  dialog.confirm = async () => true
  store.model = { ...(store.model ?? {}), masterLocale: 'de', locales: [{ code: 'de' }, { code: 'en' }], views: [{ key: 'sellable', label: { de: 'Verkaufbares' } }, { key: 'beratung', label: { de: 'Beratung' } }], attributes: store.model?.attributes ?? [] }
  const { default: View } = await import('../../plugins/advisor/src/View.vue')
  const w = mount(View, { attachTo: win.document.body })
  await warte(w)
  return { w, gesendet, gespeichert, ende: () => { w.unmount(); api.get = get; api.post = post; api.del = del; dialog.confirm = confirm } }
}

test('genau ein Berater ist gleich offen; in der Demo nur ansehen und fragen (14.10.2026)', async () => {
  const { w, ende } = await welt()
  try {
    assert.equal(w.find('select.pub').element.value, 'r1', 'ohne Klick offen')
    assert.equal(w.find('fieldset.felder').element.disabled, false)
    store.demo = true; await warte(w)
    assert.equal(w.find('fieldset.felder').element.disabled, true, 'in der Demo sind die Felder gesperrt')
    for (const sel of ['form.neu', 'button.speichern', 'button.entfernen', 'button.token-neu', 'div.einbinden'])
      assert.ok(w.find(sel).element.closest('[data-demo="aus"]'), sel + ' steht in der Demo nicht da')
    assert.equal(w.find('button.vorschau-los').element.closest('[data-demo="aus"]'), null, 'fragen geht auch in der Demo')
  } finally { store.demo = null; ende() }
})

test('die Liste zeigt die Berater mit ihrem Zustand; ein Klick öffnet einen mit seinen Feldern', async () => {
  const { w, ende } = await welt({ fehler: ['keine Sicht'] })
  try {
    const zeile = w.find('tr.berater')
    assert.match(zeile.text(), /Shop/)
    assert.equal(zeile.find('td.neg').text(), '✗')
    assert.equal(zeile.find('td.neg').attributes('title'), 'keine Sicht')
    await zeile.trigger('click'); await warte(w)
    assert.equal(w.find('select.pub').element.value, 'r1')
    assert.equal(w.find('select.rolle').element.value, 'reader')
    assert.equal(w.find('select.sicht').element.value, 'sellable')
    assert.equal(w.find('textarea.websites').element.value, 'https://shop.example')
    assert.equal(w.find('input.je-tag').element.value, '500')
    assert.deepEqual(w.findAll('ul.fehler li').map(l => l.text()), ['✗ keine Sicht'])
    assert.match(w.find('.token').text(), /abcdef123456/)
    assert.ok(w.find('pre.code').text().includes('widget.js'))
    assert.ok(w.text().includes('JOURNALI_ADVISOR: shop'))
    assert.ok(w.text().includes('advisor-shop-daten:/daten'), 'das Lernen bekommt ein Volume')
  } finally { ende() }
})

test('speichern schreibt die aufgeräumte Definition als Plugin-Daten', async () => {
  const { w, gesendet, ende } = await welt()
  try {
    await w.find('tr.berater').trigger('click'); await warte(w)
    assert.equal(w.find('button.speichern').attributes('disabled') !== undefined, true, 'unverändert: nichts zu speichern')
    await w.find('select.sicht').setValue('beratung')
    await w.findAll('.sprache').find(s => s.text() === 'en').trigger('click')
    await w.find('input.ki').setValue(true)
    await w.find('select.team').setValue('init')
    const t = w.find('textarea.websites'); t.element.value = 'https://shop.example/\nhttps://www.shop.example'; await t.trigger('change')
    await w.find('input.je-tag').setValue('')
    await w.find('button.speichern').trigger('click'); await warte(w)
    const [m, p, body] = gesendet.find(g => g[0] === 'PUT')
    assert.equal(m, 'PUT'); assert.equal(p, '/api/plugins/advisor/data/' + encodeURIComponent('def:shop'))
    assert.equal(body.view, 'beratung')
    assert.deepEqual(body.locales, ['de', 'en'])
    assert.equal(body.ki, true); assert.equal(body.team, 'init')
    assert.deepEqual(body.origins, ['https://shop.example', 'https://www.shop.example'], 'ohne Schrägstrich am Ende')
    assert.deepEqual(body.limits, {}, 'eine leere Grenze fällt weg')
    assert.deepEqual(body.greeting, { de: 'Hallo' })
  } finally { ende() }
})

test('anlegen nur mit gültigem, neuem Schlüssel — mit Vorschlägen für Baum, Rolle und Sicht', async () => {
  const { w, gesendet, ende } = await welt()
  try {
    const knopf = w.find('form.neu button')
    await w.find('input.neu-key').setValue('Shop!'); assert.ok(knopf.attributes('disabled') !== undefined)
    await w.find('input.neu-key').setValue('shop'); assert.ok(knopf.attributes('disabled') !== undefined, 'den gibt es schon')
    await w.find('input.neu-key').setValue('katalog'); assert.equal(knopf.attributes('disabled'), undefined)
    await w.find('form.neu').trigger('submit'); await warte(w)
    const [, p, body] = gesendet.find(g => g[0] === 'PUT')
    assert.equal(p, '/api/plugins/advisor/data/' + encodeURIComponent('def:katalog'))
    assert.deepEqual([body.pub, body.role, body.view], ['r1', 'reader', 'sellable'])
    assert.equal(w.findAll('tr.berater').length, 2)
  } finally { ende() }
})

test('ein Token für den Dienst ist nur einmal sichtbar; widerrufen fragt nach', async () => {
  const { w, gesendet, ende } = await welt()
  try {
    await w.find('tr.berater').trigger('click'); await warte(w)
    await button(w, '＋ Token').trigger('click'); await warte(w)
    assert.equal(w.find('code.neues-token').text(), 'ja_neu')
    assert.equal(w.findAll('tr.token').length, 2)
    await w.find('button.widerrufen').trigger('click'); await warte(w)
    assert.ok(gesendet.some(g => g[0] === 'DELETE' && g[1] === '/api/advisor/shop/tokens/abcdef123456'))
  } finally { ende() }
})

test('die Vorschau stellt die Frage eines Besuchers ohne KI und zeigt Treffer und Facetten', async () => {
  const { w, gesendet, ende } = await welt()
  try {
    await w.find('tr.berater').trigger('click'); await warte(w)
    await w.find('input.vorschau-frage').setValue('Bohrhammer')
    await w.find('form.row').trigger('submit'); await warte(w)
    // die Vorschau fragt den Kern (Kindprozess) mit einer Kennung des Gesprächs — er merkt sich, was schon gefragt wurde
    const [, p, body] = gesendet.find(g => g[1] === '/api/advisor/shop/preview')
    assert.equal(p, '/api/advisor/shop/preview')
    assert.match(body.gespraech, /^[0-9a-f]{32}$/)
    assert.deepEqual({ ...body, gespraech: 'x' }, { gespraech: 'x', q: 'Bohrhammer', locale: 'de', ki: false })
    assert.deepEqual(w.findAll('ol.treffer li').map(l => l.text().split(' ')[0]), ['Bohrhammer', 'Akkuschrauber'])
    assert.match(w.find('.vorschau').text(), /2 Treffer · nur Wortsuche/)
    assert.match(w.find('.facetten').text(), /Farbe/)
    assert.equal(w.find('.vorschau .satz').text(), '2 Produkte passen zu „bohrhammer“.')
    assert.equal(w.find('.vorschau .gesammelt').text(), 'bohrhammer · Farbe: Rot')
    // eine zweite Frage gehört zum selben Gespräch, ↺ fängt ein neues an
    await w.find('form.row').trigger('submit'); await warte(w)
    const zwei = gesendet.filter(g => g[1] === '/api/advisor/shop/preview')
    assert.equal(zwei[1][2].gespraech, body.gespraech)
    await w.find('button.vorschau-neu').trigger('click'); await warte(w)
    assert.ok(!w.find('.vorschau').exists())
    await w.find('input.vorschau-frage').setValue('Zelt')
    await w.find('form.row').trigger('submit'); await warte(w)
    assert.notEqual(gesendet.filter(g => g[1] === '/api/advisor/shop/preview').at(-1)[2].gespraech, body.gespraech)
  } finally { ende() }
})

// Vorschau mit KI (09.10.2026): nutzt der Berater sie, fragt die Vorschau wie ein Besucher mit KI — und zeigt, warum sie nicht antwortet
test('nutzt der Berater KI, fragt die Vorschau mit KI und zeigt Text, Unterlagen und den Grund, wenn sie nicht antwortet', async () => {
  const def = { label: 'Shop', pub: 'r1', role: 'reader', view: 'sellable', locales: ['de'], greeting: { de: 'Hallo' }, ki: true, team: 'init', mcp: true, origins: [], limits: {} }
  let { w, gesendet, ende } = await welt({ daten: { 'def:shop': def }, antwort: { total: 1, hits: [{ id: 'p1', name: 'Kilden Hose', values: [] }], facets: [],
    answer: 'Den Schieber vorsichtig zusammendrücken [U1].', docs: [{ n: 1, media: 'm1', name: 'Pflege – Hosen.pdf', heading: 'Reparatur: Reißverschluss', text: 'Schieber …' }] } })
  try {
    await w.find('tr.berater').trigger('click'); await warte(w)
    await w.find('input.vorschau-frage').setValue('reissverschluss kaputt')
    await w.find('form.row').trigger('submit'); await warte(w)
    assert.equal(gesendet.find(g => g[1] === '/api/advisor/shop/preview')[2].ki, true)
    assert.equal(w.find('.ki-text').text(), '✧ Den Schieber vorsichtig zusammendrücken [U1].')
    assert.equal(w.find('.unterlage').text(), '⎘ U1 Reparatur: Reißverschluss · Pflege – Hosen.pdf')
    assert.ok(!w.find('.ki-fehler').exists())
  } finally { ende() }
  ;({ w, ende } = await welt({ daten: { 'def:shop': def }, antwort: { total: 1, hits: [], facets: [], warning: 'KI nicht verfügbar: Für „Init Team“ ist kein KI-Schlüssel hinterlegt.' } }))
  try {
    await w.find('tr.berater').trigger('click'); await warte(w)
    await w.find('input.vorschau-frage').setValue('zelt')
    await w.find('form.row').trigger('submit'); await warte(w)
    assert.equal(w.find('.ki-fehler').text(), '✗ KI nicht verfügbar: Für „Init Team“ ist kein KI-Schlüssel hinterlegt.')
    assert.doesNotMatch(w.find('.vorschau').text(), /nur Wortsuche/, 'ein KI-Fehler ist kein Fehler der Suche')
  } finally { ende() }
})

test('entfernen nimmt die Token und die Definition weg', async () => {
  const { w, gesendet, ende } = await welt()
  try {
    await w.find('tr.berater').trigger('click'); await warte(w)
    await w.find('button.entfernen').trigger('click'); await warte(w)
    assert.deepEqual(gesendet.filter(g => g[0] === 'DELETE').map(g => g[1]), ['/api/advisor/shop/tokens/abcdef123456', '/api/plugins/advisor/data/' + encodeURIComponent('def:shop')])
    assert.equal(w.findAll('tr.berater').length, 0)
  } finally { ende() }
})
