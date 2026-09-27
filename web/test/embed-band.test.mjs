// Plugin embed, das Band „≈ Ähnliche Knoten“ (27.09.2026, 35): echtes DOM, gefälschte /api — was im Band steht,
// wird gelesen, nicht vermutet.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'

const plugin = (await import('../../plugins/embed/entry.js')).default

const band = () => { const head = document.createElement('span'); const body = document.createElement('div'); return { head, body } }
const ctx = (antwort, gegangen = []) => ({ api: { get: async p => { gegangen.push(p); return antwort } }, go: p => gegangen.push('go:' + p) })

test('das Band ist ein nodeBand für Pflegeknoten', () => {
  const b = plugin.nodeBands[0]
  assert.equal(b.key, 'similar'); assert.deepEqual(b.roles, ['group', 'product', 'variant']); assert.equal(typeof b.mount, 'function')
})

test('die ähnlichen Knoten stehen als Chips mit Ähnlichkeit, ein Klick springt hin', async () => {
  const { head, body } = band(); const gegangen = []
  const hits = [{ id: 'p2', role: 'product', label: 'Klebstoff B', path: ['Mastertree', 'Klebstoffe'], score: 0.91 }, { id: 'p3', role: 'product', label: 'Klebstoff C', path: [], score: 0.8 }]
  await plugin.nodeBands[0].mount({ head, body }, 'p1', ctx({ ready: true, known: true, hits }, gegangen))
  assert.match(gegangen[0], /\/api\/nodes\/p1\/similar/)
  assert.equal(head.textContent, '· 2')
  const chips = body.querySelectorAll('a.chip')
  assert.equal(chips.length, 2)
  assert.match(chips[0].textContent, /Klebstoff B/); assert.match(chips[0].textContent, /91 %/)
  assert.match(chips[0].getAttribute('title'), /Mastertree › Klebstoffe/)
  chips[0].dispatchEvent(new win.Event('click'))
  assert.equal(gegangen.at(-1), 'go:/tree/p2')
})

test('ohne Erweiterung sagt das Band „kein Index“, der Grund steht im Tooltip', async () => {
  const { head, body } = band()
  await plugin.nodeBands[0].mount({ head, body }, 'p1', ctx({ ready: false, reason: 'Erweiterung vector fehlt in dieser Datenbank.', hits: [] }))
  assert.equal(head.textContent, '· kein Index')
  assert.match(head.title, /vector fehlt/)
  assert.equal(body.children.length, 0)
})

test('ein Knoten ohne Vektor ist noch nicht eingebettet — kein Ratschlag, nur der Stand', async () => {
  const { head, body } = band()
  await plugin.nodeBands[0].mount({ head, body }, 'p1', ctx({ ready: true, known: false, hits: [] }))
  assert.equal(head.textContent, '· noch nicht eingebettet')
  assert.equal(body.children.length, 0)
})
