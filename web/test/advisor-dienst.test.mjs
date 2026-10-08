// Der Dienst des Produktberaters (plugins/advisor/dienst.mjs, mcp.mjs): das Stück, das eine Website und fremde KI-Agenten erreichen. journali ist
// hier vorgetäuscht (fetch); geprüft wird über echtes HTTP: Weiterleitung mit dem Token, Herkunft (CORS), Grenzen je Besucher und MCP in
// beiden Formen der Spezifikation — 2026-07-28 ohne Handshake und die ältere mit initialize.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { erstelle } from '../../plugins/advisor/dienst.mjs'
import { verarbeite, kopfwert, WERKZEUGE } from '../../plugins/advisor/mcp.mjs'

const TOKEN = 'ja_geheim'
const INFO = { key: 'shop', label: 'Werkzeugberater', locale: 'de', locales: ['de', 'en'], greeting: { de: 'Hallo' }, ki: false, mcp: true, origins: ['https://shop.example'], limits: { jeBesucherMinute: 50 }, channel: 'web', products: 3 }
const FRAGE = { locale: 'de', total: 1, hits: [{ id: 'p1', name: 'Bohrhammer Pro', keys: { sku: 'S1' }, image: 'm1', variants: 1, values: [{ key: 'leistung', label: 'Leistung', value: '800 W' }] }],
  facets: [{ key: 'color', label: 'Farbe', type: 'list', n: 1, values: [{ value: 'red', label: 'Rot', n: 1 }] }], filter: [], answer: null, warning: null }

async function welt({ info = INFO, unten = false } = {}) {
  const rufe = []
  const fetch = async (url, o = {}) => {
    rufe.push({ url, method: o.method ?? 'GET', auth: o.headers?.authorization, body: o.body ? JSON.parse(o.body) : undefined })
    if (unten) throw new Error('ECONNREFUSED')
    const pfad = url.replace('http://journali:8080/api/advisor/shop/', '')
    const antwort = (status, json) => ({ status, text: async () => JSON.stringify(json), headers: new Headers({ 'content-type': 'application/json' }) })
    if (pfad === 'info') return antwort(200, info)
    if (pfad === 'ask') return antwort(200, FRAGE)
    if (pfad.startsWith('product/p1')) return antwort(200, { id: 'p1', name: 'Bohrhammer Pro', values: [], variants: [] })
    if (pfad.startsWith('product/')) return antwort(404, { error: 'Produkt x gibt es hier nicht.' })
    if (pfad === 'compare') return antwort(200, { products: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }], rows: [{ key: 'leistung', label: 'Leistung', values: ['800 W', '300 W'], same: false }] })
    if (pfad.startsWith('image/m1')) return { status: 200, headers: new Headers({ 'content-type': 'image/webp' }), arrayBuffer: async () => new Uint8Array([7, 8, 9]).buffer, text: async () => '' }
    if (pfad === 'doc/d1') return { status: 200, headers: new Headers({ 'content-type': 'application/pdf', 'content-disposition': "inline; filename*=UTF-8''Pflege.pdf" }), arrayBuffer: async () => new TextEncoder().encode('%PDF').buffer, text: async () => '' }
    return antwort(404, { error: 'nicht da' })
  }
  let t = Date.UTC(2026, 9, 8, 10, 0, 0)
  const handler = erstelle({ journali: 'http://journali:8080/', advisor: 'shop', token: TOKEN, widget: '/* widget */', fetch, jetzt: () => t })
  const server = http.createServer(handler)
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}`
  return { url, rufe, weiter: ms => { t += ms }, ende: () => new Promise(r => server.close(r)) }
}

const post = (url, body, headers = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const meta = (v = '2026-07-28') => ({ 'io.modelcontextprotocol/protocolVersion': v, 'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' }, 'io.modelcontextprotocol/clientCapabilities': {} })
const modern = (method, extra = {}) => ({ 'mcp-protocol-version': '2026-07-28', 'mcp-method': method, accept: 'application/json, text/event-stream', ...extra })

// ---- das Chat-Fenster

test('das Chat-Fenster kommt als Skript, für jede Website', async () => {
  const w = await welt()
  try {
    const r = await fetch(w.url + '/widget.js')
    assert.equal(r.status, 200)
    assert.match(r.headers.get('content-type'), /javascript/)
    assert.equal(await r.text(), '/* widget */')
    // der Browser fragt jedes Mal nach und bekommt 304, solange es dasselbe ist — nach einem Update sofort das neue
    assert.equal(r.headers.get('cache-control'), 'no-cache')
    const tag = r.headers.get('etag')
    assert.match(tag, /^"[0-9a-f]{16}"$/)
    assert.equal((await fetch(w.url + '/widget.js', { headers: { 'if-none-match': tag } })).status, 304)
    assert.equal((await fetch(w.url + '/widget.js', { headers: { 'if-none-match': '"alt"' } })).status, 200)
  } finally { await w.ende() }
})

test('eine Frage geht mit dem Token an journali, das Token kommt nie zurück', async () => {
  const w = await welt()
  try {
    const r = await post(w.url + '/api/ask', { q: 'x'.repeat(500), filter: [{ attribute: 'color', value: 'red' }], locale: 'de' }, { origin: 'https://shop.example' })
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('access-control-allow-origin'), 'https://shop.example')
    const text = await r.text()
    assert.ok(!text.includes(TOKEN))
    assert.equal(JSON.parse(text).hits[0].name, 'Bohrhammer Pro')
    const ruf = w.rufe.find(x => x.url.endsWith('/ask'))
    assert.equal(ruf.auth, 'Bearer ' + TOKEN)
    assert.equal(ruf.body.q.length, 300, 'die Frage wird gekürzt')
    assert.deepEqual(ruf.body.filter, [{ attribute: 'color', value: 'red' }])
    // Info ohne Grenzen und Websites
    const i = await (await fetch(w.url + '/api/info')).json()
    assert.equal(i.label, 'Werkzeugberater'); assert.equal(i.origins, undefined); assert.equal(i.limits, undefined)
  } finally { await w.ende() }
})

test('ein Gespräch: die gesammelten Wörter und der Verlauf gehen mit, gekürzt', async () => {
  const w = await welt()
  try {
    const woerter = Array.from({ length: 20 }, (_, i) => 'w' + i + 'x'.repeat(60))
    const verlauf = Array.from({ length: 9 }, (_, i) => 'eingabe ' + i)
    assert.equal((await post(w.url + '/api/ask', { q: 'rot', woerter, verlauf }, { origin: 'https://shop.example' })).status, 200)
    const ruf = w.rufe.find(x => x.url.endsWith('/ask'))
    assert.equal(ruf.body.woerter.length, 12, 'höchstens zwölf Wörter')
    assert.ok(ruf.body.woerter.every(x => x.length <= 40), 'je Wort höchstens 40 Zeichen')
    assert.deepEqual(ruf.body.verlauf, verlauf.slice(-6), 'die letzten sechs Eingaben')
  } finally { await w.ende() }
})

test('eine Website, die der Berater nicht nennt, bekommt 403 — eine genannte die Freigabe für den Browser', async () => {
  const w = await welt()
  try {
    assert.equal((await post(w.url + '/api/ask', { q: 'a' }, { origin: 'https://fremd.example' })).status, 403)
    const vor = await fetch(w.url + '/api/ask', { method: 'OPTIONS', headers: { origin: 'https://shop.example/', 'access-control-request-method': 'POST' } })
    assert.equal(vor.status, 204)
    assert.equal(vor.headers.get('access-control-allow-origin'), 'https://shop.example/')
    // ohne Origin (Server, Werkzeug) gilt die Anfrage
    assert.equal((await post(w.url + '/api/ask', { q: 'a' })).status, 200)
  } finally { await w.ende() }
})

test('je Besucher gilt eine Grenze je Minute, danach 429 mit Wartezeit', async () => {
  const w = await welt({ info: { ...INFO, limits: { jeBesucherMinute: 4 } } })
  try {
    for (let i = 0; i < 4; i++) assert.equal((await post(w.url + '/api/ask', { q: 'a' })).status, 200)
    const r = await post(w.url + '/api/ask', { q: 'a' })
    assert.equal(r.status, 429)
    assert.ok(Number(r.headers.get('retry-after')) > 0)
    w.weiter(61_000)
    assert.equal((await post(w.url + '/api/ask', { q: 'a' })).status, 200, 'in der nächsten Minute wieder')
  } finally { await w.ende() }
})

test('Produkt, Vergleich und Bild gehen durch, ein unbekannter Weg nicht', async () => {
  const w = await welt()
  try {
    assert.equal((await fetch(w.url + '/api/product/p1?locale=en')).status, 200)
    assert.ok(w.rufe.some(x => x.url.endsWith('product/p1?locale=en')))
    assert.equal((await fetch(w.url + '/api/product/x')).status, 404)
    const v = await (await post(w.url + '/api/compare', { ids: ['p1', 'p2', 'p3', 'p4', 'p5'] })).json()
    assert.equal(v.rows[0].label, 'Leistung')
    assert.equal(w.rufe.find(x => x.url.endsWith('/compare')).body.ids.length, 4, 'höchstens vier')
    const b = await fetch(w.url + '/api/image/m1')
    assert.equal(b.headers.get('content-type'), 'image/webp')
    assert.deepEqual([...new Uint8Array(await b.arrayBuffer())], [7, 8, 9])
    // ein Dokument der Unterlagen: durchgereicht, zum Ansehen, ohne Skripte
    const d = await fetch(w.url + '/api/doc/d1')
    assert.equal(d.headers.get('content-type'), 'application/pdf')
    assert.equal(d.headers.get('content-disposition'), "inline; filename*=UTF-8''Pflege.pdf")
    assert.equal(d.headers.get('content-security-policy'), 'sandbox')
    assert.equal(await d.text(), '%PDF')
    assert.equal((await fetch(w.url + '/api/doc/x')).status, 404)
    assert.equal((await fetch(w.url + '/api/tree')).status, 404)
    assert.equal((await fetch(w.url + '/api/ask')).status, 404, 'eine Frage ist ein POST')
  } finally { await w.ende() }
})

test('ist journali nicht erreichbar, sagt der Dienst das ohne Einzelheiten', async () => {
  const w = await welt({ unten: true })
  try {
    const r = await post(w.url + '/api/ask', { q: 'a' })
    assert.equal(r.status, 502)
    const j = await r.json()
    assert.equal(j.error, 'journali ist nicht erreichbar.')
    assert.equal((await fetch(w.url + '/health')).status, 503)
  } finally { await w.ende() }
})

// ---- MCP, 2026-07-28: ohne Handshake

test('MCP: server/discover und tools/list ohne Handshake', async () => {
  const w = await welt()
  try {
    const d = await (await post(w.url + '/mcp', { jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta() } }, modern('server/discover'))).json()
    assert.equal(d.result.resultType, 'complete')
    assert.ok(d.result.supportedVersions.includes('2026-07-28'))
    assert.ok(d.result.supportedVersions.includes('2025-11-25'))
    assert.equal(d.result._meta['io.modelcontextprotocol/serverInfo'].name, 'journali-advisor')
    const l = await (await post(w.url + '/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: meta() } }, modern('tools/list'))).json()
    assert.deepEqual(l.result.tools.map(x => x.name), ['search_products', 'get_product', 'compare_products'])
    assert.ok(l.result.tools.every(x => x.annotations.readOnlyHint), 'alle nur lesend')
  } finally { await w.ende() }
})

test('MCP: ein Werkzeug fragt journali und liefert Text und Struktur', async () => {
  const w = await welt()
  try {
    const r = await post(w.url + '/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_products', arguments: { query: 'Bohrhammer', filters: [{ attribute: 'color', value: 'red' }] }, _meta: meta() } }, modern('tools/call', { 'mcp-name': 'search_products' }))
    assert.equal(r.status, 200)
    const j = await r.json()
    assert.equal(j.result.isError, false)
    assert.equal(j.result.structuredContent.hits[0].id, 'p1')
    assert.match(j.result.content[0].text, /1\. Bohrhammer Pro \(S1\) \[id p1\] — Leistung: 800 W/)
    assert.match(j.result.content[0].text, /Farbe \[color\]: Rot = red \(1\)/)
    const ruf = w.rufe.find(x => x.url.endsWith('/ask'))
    assert.equal(ruf.body.ki, false, 'ein Agent bekommt keinen Text der KI')
    assert.deepEqual(ruf.body.filter, [{ attribute: 'color', value: 'red' }])
    // Name im Kopf als Base64
    const b = await post(w.url + '/mcp', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_product', arguments: { id: 'p1' }, _meta: meta() } },
      modern('tools/call', { 'mcp-name': '=?base64?' + Buffer.from('get_product').toString('base64') + '?=' }))
    assert.equal((await b.json()).result.structuredContent.name, 'Bohrhammer Pro')
    // ein Fehler aus journali ist ein Ergebnis mit isError, kein Protokollfehler
    const x = await (await post(w.url + '/mcp', { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_product', arguments: { id: 'x' }, _meta: meta() } }, modern('tools/call', { 'mcp-name': 'get_product' }))).json()
    assert.equal(x.result.isError, true)
    assert.match(x.result.content[0].text, /gibt es hier nicht/)
  } finally { await w.ende() }
})

test('MCP: Kopf und Rumpf müssen übereinstimmen, die Version muss bekannt sein', async () => {
  const w = await welt()
  try {
    const falscheMethode = await post(w.url + '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: meta() } }, modern('tools/call'))
    assert.equal(falscheMethode.status, 400); assert.equal((await falscheMethode.json()).error.code, -32020)
    const falscherName = await post(w.url + '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_product', arguments: { id: 'p1' }, _meta: meta() } }, modern('tools/call', { 'mcp-name': 'search_products' }))
    assert.equal((await falscherName.json()).error.code, -32020)
    const unbekannt = await post(w.url + '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: meta('1900-01-01') } }, { ...modern('tools/list'), 'mcp-protocol-version': '1900-01-01' })
    assert.equal(unbekannt.status, 400)
    const u = await unbekannt.json()
    assert.equal(u.error.code, -32022); assert.equal(u.error.data.requested, '1900-01-01'); assert.ok(u.error.data.supported.includes('2026-07-28'))
    const ohneFaehigkeiten = await post(w.url + '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } }, modern('tools/list'))
    assert.equal(ohneFaehigkeiten.status, 400); assert.equal((await ohneFaehigkeiten.json()).error.code, -32602)
    const methode = await post(w.url + '/mcp', { jsonrpc: '2.0', id: 1, method: 'resources/list', params: { _meta: meta() } }, modern('resources/list'))
    assert.equal(methode.status, 404); assert.equal((await methode.json()).error.code, -32601)
  } finally { await w.ende() }
})

// ---- MCP, ältere Form mit initialize

test('MCP: ein älterer Client handelt mit initialize aus und fragt dann ohne _meta', async () => {
  const w = await welt()
  try {
    const i = await (await post(w.url + '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'alt', version: '1' } } })).json()
    assert.equal(i.result.protocolVersion, '2025-06-18')
    assert.deepEqual(i.result.capabilities, { tools: { listChanged: false } })
    const n = await post(w.url + '/mcp', { jsonrpc: '2.0', method: 'notifications/initialized' }, { 'mcp-protocol-version': '2025-06-18' })
    assert.equal(n.status, 202)
    const l = await (await post(w.url + '/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { 'mcp-protocol-version': '2025-06-18' })).json()
    assert.equal(l.result.tools.length, 3)
    assert.equal(l.result.resultType, undefined, 'die ältere Form kennt resultType nicht')
    const c = await (await post(w.url + '/mcp', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'compare_products', arguments: { ids: ['p1', 'p2'] } } })).json()
    assert.match(c.result.content[0].text, /Leistung: 800 W \| 300 W/)
    // eine unbekannte ältere Version: initialize bietet die neueste ältere an
    const alt = await (await post(w.url + '/mcp', { jsonrpc: '2.0', id: 4, method: 'initialize', params: { protocolVersion: '2024-11-05' } })).json()
    assert.equal(alt.result.protocolVersion, '2025-11-25')
  } finally { await w.ende() }
})

test('MCP: GET ist nicht erlaubt, ein fremder Origin auch nicht, und ohne MCP am Berater gibt es den Endpunkt nicht', async () => {
  const w = await welt()
  try {
    assert.equal((await fetch(w.url + '/mcp')).status, 405)
    assert.equal((await post(w.url + '/mcp', { jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://boese.example' })).status, 403)
    assert.equal((await post(w.url + '/mcp', '[{"jsonrpc":"2.0","id":1,"method":"ping"}]')).status, 400, 'kein Stapel')
  } finally { await w.ende() }
  const ohne = await welt({ info: { ...INFO, mcp: false } })
  try { assert.equal((await post(ohne.url + '/mcp', { jsonrpc: '2.0', id: 1, method: 'ping' })).status, 404) } finally { await ohne.ende() }
})

test('MCP: Bausteine — Base64 im Kopf, Werkzeuge mit Schema', async () => {
  assert.equal(kopfwert('=?base64?SGVsbG8sIOS4lueVjA==?='), 'Hello, 世界')
  assert.equal(kopfwert('plain'), 'plain')
  for (const w of WERKZEUGE) { assert.equal(w.inputSchema.type, 'object'); assert.ok(w.description.length > 20) }
  const r = await verarbeite({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'loeschen', arguments: {} } }, () => undefined, async () => ({ status: 200, json: {} }))
  assert.equal(r.json.error.code, -32602)
})

test('eine Variante geht durch wie ein Produkt', async () => {
  const w = await welt()
  try {
    await fetch(w.url + '/api/variant/v1?locale=de')
    assert.ok(w.rufe.some(x => x.url.endsWith('/variant/v1?locale=de')), 'an journali als variant/<id>')
    assert.equal((await fetch(w.url + '/api/variant/v1/mehr')).status, 404, 'nur genau eine Kennung')
  } finally { await w.ende() }
})
