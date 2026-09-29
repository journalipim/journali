// Der Runner von scriptum (docs/pflegestruktur.md 37): er liest den Kopf des Skripts, ruft seine Standardfunktion,
// bringt das Ergebnis in eine Form (Tabelle, Text, Datei) und fängt jeden Fehler — ein Skript stürzt nicht ab,
// es meldet. Die Grenzen gehören an den Runner, nicht an das Skript.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MARKE, melde, werte, ergebnis, kontext, lade } from '../../plugins/scriptum/runner.mjs'
import { beispiele } from '../../plugins/scriptum/beispiele.mjs'

const META = { label: 'Preise', params: [{ key: 'root', label: 'Teilbaum', default: 'g1' }, { key: 'tief', default: '3' }] }

test('die Werte: Vorgaben aus dem Kopf, darüber JOURNALI_ARGS, darüber ein einzelnes Feld', () => {
  assert.deepEqual(werte(META, {}), { root: 'g1', tief: '3' })
  assert.deepEqual(werte(META, { JOURNALI_ARGS: '{"root":"g9"}' }), { root: 'g9', tief: '3' })
  assert.deepEqual(werte(META, { JOURNALI_ARGS: '{"root":"g9"}', JOURNALI_ARG_ROOT: 'g7' }), { root: 'g7', tief: '3' })
  // kaputtes JSON nimmt dem Lauf nicht die Vorgaben
  assert.deepEqual(werte(META, { JOURNALI_ARGS: '{' }), { root: 'g1', tief: '3' })
  assert.deepEqual(werte({}, {}), {})
})

test('das Ergebnis hat drei Formen — und eine Liste von Objekten wird eine Tabelle', () => {
  assert.deepEqual(ergebnis('fertig'), { text: 'fertig' })
  assert.deepEqual(ergebnis(undefined), { text: '' })
  assert.deepEqual(ergebnis({ text: 42 }), { text: '42' })
  assert.deepEqual(ergebnis({ file: 'liste.csv', bytes: 12 }), { file: 'liste.csv', bytes: 12 })
  assert.deepEqual(ergebnis({ table: { columns: ['a', 'b'], rows: [[1, null]] } }), { table: { columns: ['a', 'b'], rows: [['1', '']] } })
  assert.deepEqual(ergebnis([{ id: 'p1', name: 'Bohrer' }, { id: 'p2', extra: 'x' }]),
    { table: { columns: ['id', 'name', 'extra'], rows: [['p1', 'Bohrer', ''], ['p2', '', 'x']] } })
})

test('die Grenzen gehören an den Runner: zu viele Zeilen, zu lange Zellen, zu langer Text', () => {
  const viele = Array.from({ length: 30 }, (_, i) => [i, 'x'.repeat(20)])
  const r = ergebnis({ table: { columns: ['i', 's'], rows: viele } }, { zeilen: 10, zelle: 5, text: 8 })
  assert.equal(r.table.rows.length, 10)
  assert.equal(r.table.rows[0][1], 'xxxxx …')
  assert.equal(r.gekuerzt, 30, 'es steht da, dass gekürzt wurde')
  assert.equal(ergebnis('abcdefghij', { text: 8 }).text, 'abcdefgh …')
})

test('gemeldet wird eine Zeile mit der Marke — alles andere ist Protokoll', () => {
  let aus = ''
  melde({ text: 'ok' }, s => { aus += s })
  assert.equal(aus, MARKE + '{"text":"ok"}\n')
  assert.equal(aus.split('\n').length, 2, 'genau eine Zeile')
})

test('ein Skript ist ein ES-Modul: Kopf und Standardfunktion werden wirklich geladen', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptum-test-'))
  try {
    const modul = await lade(`export const meta = { label: 'Zwei', params: [{ key: 'n', default: '2' }] }
export default async ({ params, out }) => out.text('n=' + params.n)`, dir)
    assert.equal(modul.meta.label, 'Zwei')
    const ctx = kontext({ server: 'http://localhost:0', token: 't', actor: 'job:x', params: werte(modul.meta, {}) })
    assert.deepEqual(ergebnis(await modul.default(ctx)), { text: 'n=2' })
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('out.file schreibt ins Fach out/ — ohne Fach sagt es das', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptum-out-'))
  try {
    const ctx = kontext({ server: 'http://localhost:0', token: '', actor: 'job:x', params: {}, outDir: dir })
    const r = ctx.out.file('liste 1.csv', 'a;b\n1;2\n')
    assert.equal(r.file, 'liste_1.csv', 'der Name wird sicher gemacht')
    assert.equal(fs.readFileSync(path.join(dir, 'liste_1.csv'), 'utf8'), 'a;b\n1;2\n')
    const ohne = kontext({ server: 'http://localhost:0', token: '', actor: 'job:x', params: {} })
    assert.throws(() => ohne.out.file('x.csv', 'x'), /out\//)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('die API des Skripts spricht journali mit dem Token des Laufs', async () => {
  const rufe = []
  const alt = globalThis.fetch
  globalThis.fetch = async (url, opt = {}) => { rufe.push({ url: String(url), opt }); return { ok: true, status: 200, text: async () => JSON.stringify({ ok: 1 }) } }
  try {
    const ctx = kontext({ server: 'http://localhost:5000', token: 'svc_1', actor: 'job:scriptum_x', params: {} })
    assert.deepEqual(await ctx.api.get('/api/tree'), { ok: 1 })
    assert.equal(rufe[0].url, 'http://localhost:5000/api/tree')
    assert.equal(rufe[0].opt.headers.Authorization, 'Bearer svc_1')
    assert.equal(rufe[0].opt.headers['X-Actor'], 'job:scriptum_x')
    await ctx.api.post('/api/batch', { commands: [] })
    assert.equal(rufe[1].opt.method, 'POST')
    assert.equal(rufe[1].opt.headers['Content-Type'], 'application/json')
  } finally { globalThis.fetch = alt }
})

test('ctx.zugang spricht ein Fremdsystem über die Weiterleitung — mit dem Pfad hinter der Adresse', async () => {
  const rufe = []
  const alt = globalThis.fetch
  globalThis.fetch = async (url, opt = {}) => { rufe.push({ url: String(url), opt }); return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 'a' }]) } }
  try {
    const ctx = kontext({ server: 'http://localhost:5000', token: 'svc_1', actor: 'job:scriptum_x', params: { sys: 'sap' } })
    const z = ctx.zugang(ctx.params.sys)
    assert.deepEqual(await z.get('/odata/Products?$top=2'), [{ id: 'a' }])
    assert.equal(rufe[0].url, 'http://localhost:5000/api/drivers/sap/relay?path=' + encodeURIComponent('/odata/Products?$top=2'))
    assert.equal(rufe[0].opt.headers.Authorization, 'Bearer svc_1', 'das Token des Laufs, nie das des Fremdsystems')
    await z.post('/items', { id: 'x' })
    assert.equal(rufe[1].opt.method, 'POST')
    assert.equal(rufe[1].url, 'http://localhost:5000/api/drivers/sap/relay?path=' + encodeURIComponent('/items'))
    assert.equal(JSON.parse(rufe[1].opt.body).id, 'x')
    assert.throws(() => ctx.zugang(''), /kein Zugang/)
  } finally { globalThis.fetch = alt }
})

test('ctx.zugang.roh gibt Status und Kopfzeilen zurück und reicht eigene Kopfzeilen durch — der SAP-CSRF-Weg', async () => {
  const rufe = []
  const alt = globalThis.fetch
  globalThis.fetch = async (url, opt = {}) => {
    rufe.push({ url: String(url), opt })
    // die Weiterleitung im raw-Modus antwortet mit einem Umschlag { status, headers, body }
    const umschlag = rufe.length === 1
      ? { status: 200, headers: { 'x-csrf-token': 'ABC', 'set-cookie': ['SAP_SESSIONID=xy; path=/; HttpOnly'] }, body: '' }
      : { status: 201, headers: {}, body: '{"d":{"Name":"Beispiel"}}' }
    return { ok: true, status: 200, text: async () => JSON.stringify(umschlag) }
  }
  try {
    const ctx = kontext({ server: 'http://localhost:5000', token: 'svc_1', actor: 'job:x', params: {} })
    const z = ctx.zugang('sap')
    // 1. Token holen
    const hol = await z.roh('GET', '/srv?$format=json&$top=0', { headers: { 'x-csrf-token': 'Fetch' } })
    assert.equal(hol.headers['x-csrf-token'], 'ABC', 'der Token kommt aus der Kopfzeile der Antwort')
    assert.ok(rufe[0].url.endsWith('&raw=1'), 'roh geht mit raw=1 an die Weiterleitung')
    assert.equal(rufe[0].opt.headers['x-csrf-token'], 'Fetch', 'die eigene Kopfzeile geht mit')
    assert.equal(rufe[0].opt.headers.Authorization, 'Bearer svc_1', 'dazu das Token des Laufs')
    // 2. schreiben mit Token und Keks
    const keks = hol.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
    const res = await z.roh('POST', '/srv', { body: { Name: 'Beispiel' }, headers: { 'x-csrf-token': hol.headers['x-csrf-token'], 'x-relay-cookie': keks } })
    assert.equal(res.status, 201, 'der Status des Fremdsystems steht im Umschlag')
    assert.equal(rufe[1].opt.method, 'POST')
    assert.equal(rufe[1].opt.headers['x-relay-cookie'], 'SAP_SESSIONID=xy')
    assert.equal(rufe[1].opt.headers['x-csrf-token'], 'ABC')
    assert.equal(JSON.parse(rufe[1].opt.body).Name, 'Beispiel')
  } finally { globalThis.fetch = alt }
})

test('jedes Beispiel der Bibliothek ist ein gültiges Skript — Kopf und Standardfunktion', async () => {
  assert.ok(beispiele.length >= 4, 'die Bibliothek hat Beispiele')
  for (const b of beispiele) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptum-bsp-'))
    try {
      const modul = await lade(b.source, dir)
      assert.ok(modul.meta && typeof modul.meta.label === 'string', b.key + ': ein Kopf mit label')
      assert.equal(typeof (modul.default ?? modul.run), 'function', b.key + ': eine Standardfunktion')
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  }
})

test('ein Fehler des Skripts ist eine Meldung, kein Absturz', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptum-fehler-'))
  try {
    const modul = await lade('export default () => { throw new Error("Quelle nicht erreichbar") }', dir)
    let gemeldet = null
    try { modul.default({}) } catch (e) { gemeldet = ergebnis({ fehler: e.message }) }
    assert.deepEqual(gemeldet, { text: '{\n "fehler": "Quelle nicht erreichbar"\n}' })
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
