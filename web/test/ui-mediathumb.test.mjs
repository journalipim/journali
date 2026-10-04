// Kachel eines Mediums. Bei einem Bild rechnet der Browser die Vorschau
// notfalls selbst aus dem Original; bei einem PDF geht das nicht — ein PDF lädt nicht in ein <img>, der Versuch würde
// in jeder Kachel scheitern. Dort wartet die Kachel auf den Job „Vorschauen rechnen“ und zeigt solange ▤.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { api } from '../src/api.js'

const MediaThumb = (await import('../src/components/MediaThumb.vue')).default

test('zeigt die Vorschau des Servers', () => {
  const w = mount(MediaThumb, { props: { id: 'm-1' } })
  assert.equal(w.find('img').attributes('src'), '/api/media/m-1/thumb')
})

test('PDF ohne Vorschau: Symbol statt Fehler, der Browser rechnet nichts', async () => {
  let geholt = 0
  globalThis.fetch = async () => { geholt++; return { ok: true, status: 200, text: async () => '{}' } }
  const w = mount(MediaThumb, { props: { id: 'm-pdf', self: false } })
  await w.find('img').trigger('error')          // 404: es gibt noch keine
  await flushPromises()
  assert.equal(w.find('img').exists(), false, 'kein zweiter Versuch')
  assert.equal(w.text().trim(), '▤')
  assert.match(w.find('div').attributes('title') ?? '', /Vorschauen rechnen/)
  assert.equal(geholt, 0, 'nichts hochgeladen — das Rechnen macht der Job')
})

test('kleines Bild ohne Vorschau: der Browser versucht es selbst', async () => {
  const orig = api.get
  api.get = async p => p === '/api/media/m-jpg' ? { mime: 'image/jpeg', bytes: 400_000 } : orig(p)
  try {
    const w = mount(MediaThumb, { props: { id: 'm-jpg', self: true } })
    await w.find('img').trigger('error')
    await flushPromises()
    // make() läuft los (new Image() scheitert im Prüfstand) — entscheidend ist: es bleibt beim Bild-Weg, kein ▤
    assert.notEqual(w.text().trim(), '▤')
  } finally { api.get = orig }
})

test('grosses Bild ohne Vorschau: der Browser rechnet nicht, die Kachel wartet auf den Job (04.10.2026)', async () => {
  const orig = api.get
  api.get = async p => p === '/api/media/m-tif' ? { mime: 'image/tiff', bytes: 60_000_000 } : orig(p)
  try {
    const w = mount(MediaThumb, { props: { id: 'm-tif', self: true } })
    await w.find('img').trigger('error')
    for (let i = 0; i < 4; i++) await flushPromises()
    assert.equal(w.text().trim(), '▤')
    assert.match(w.find('div').attributes('title') ?? '', /Vorschauen rechnen/)
  } finally { api.get = orig }
})
