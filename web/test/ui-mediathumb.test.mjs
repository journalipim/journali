// Kachel eines Mediums (Taloan, 23.09.2026: „bau die pdf thumbs“). Bei einem Bild rechnet der Browser die Vorschau
// notfalls selbst aus dem Original; bei einem PDF geht das nicht — ein PDF lädt nicht in ein <img>, der Versuch würde
// in jeder Kachel scheitern. Dort wartet die Kachel auf den Job „Werkzeug: Vorschauen rechnen“ und zeigt solange ▤.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'

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

test('Bild ohne Vorschau: der Browser versucht es selbst', async () => {
  const w = mount(MediaThumb, { props: { id: 'm-jpg', self: true } })
  await w.find('img').trigger('error')
  await flushPromises()
  // make() läuft los (new Image() scheitert im Prüfstand) — entscheidend ist: es bleibt beim Bild-Weg, kein ▤
  assert.notEqual(w.text().trim(), '▤')
})
