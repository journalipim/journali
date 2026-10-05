// Plugin docs, die Ansicht ⌕ Dokumente mit Sinn (27.09.2026, 35): drei Arten zu suchen, die Frage an die Dokumente mit
// ihren Quellen, die Ähnlichkeit am Treffer. Echtes DOM, gefälschte /api.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'

const plugin = (await import('../../plugins/docs/entry.js')).default
const mountView = plugin.views[0].mount

function welt(antworten = {}) {
  localStorage.clear()
  const rufe = []
  const api = {
    get: async p => { rufe.push({ methode: 'GET', p }); for (const [re, a] of Object.entries(antworten)) if (new RegExp(re).test(p)) return typeof a === 'function' ? a(p) : a; return {} },
    post: async (p, body) => { rufe.push({ methode: 'POST', p, body }); for (const [re, a] of Object.entries(antworten)) if (new RegExp(re).test(p)) return typeof a === 'function' ? a(p, body) : a; return {} },
  }
  const ctx = { api, store: {}, tree: { loaded: true, byId: new Map(), load: async () => {} }, go: p => rufe.push({ methode: 'GO', p }) }
  const root = document.createElement('div'); document.body.append(root)
  return { root, ctx, rufe }
}
const tick = () => new Promise(r => setTimeout(r, 0))
const chip = (root, text) => [...root.querySelectorAll('.view-chip')].find(c => c.textContent.trim() === text)

test('drei Arten zu suchen — die Wahl geht als mode mit, die Warnung steht bei der Zahl', async () => {
  const { root, ctx, rufe } = welt({
    '/api/docs/status': { ready: true, media: 3, chunks: 40, scans: 0, errors: 0 },
    '/api/docs/embed': { ready: true, plugin: true, chunks: 40, embedded: 12 },
    '/api/docs/search': p => /mode=semantic/.test(p) ? { ready: true, hits: [{ media: 'm1', name: 'blatt.pdf', page: 2, snippet: 'Viskosität 3500', score: 0.87, nodes: [] }], warning: null } : { ready: true, hits: [], warning: 'Plugin embed fehlt.' },
  })
  await mountView(root, ctx); await tick()
  assert.ok(chip(root, 'Wörter').classList.contains('on'), 'Wörter ist die Vorgabe')
  assert.match(root.textContent, /12 von 40 Abschnitten mit Vektor/)

  root.querySelector('input[type=search]').value = 'zäh'
  root.querySelector('input[type=search]').dispatchEvent(new win.Event('input'))
  chip(root, 'Sinn').dispatchEvent(new win.Event('click')); await tick(); await tick()
  const suche = rufe.filter(r => /\/api\/docs\/search/.test(r.p)).at(-1)
  assert.match(suche.p, /mode=semantic/); assert.match(suche.p, /q=z%C3%A4h/)
  assert.equal(localStorage.getItem('journali.docs.mode'), 'semantic')
  assert.match(root.querySelector('.hit').textContent, /87 %/, 'die Ähnlichkeit steht am Treffer')
  assert.match(root.querySelector('.hit').textContent, /blatt\.pdf/)

  chip(root, 'Beides').dispatchEvent(new win.Event('click')); await tick(); await tick()
  assert.match(rufe.filter(r => /\/api\/docs\/search/.test(r.p)).at(-1).p, /mode=hybrid/)
  assert.match(root.textContent, /Plugin embed fehlt\./, 'die Warnung des Servers steht da — die Wörter kamen trotzdem')
})

test('die Frage an die Dokumente: Antwort mit nummerierten Quellen, Dokument, Seite und Knoten', async () => {
  const { root, ctx, rufe } = welt({
    '/api/docs/status': { ready: true, media: 1, chunks: 4 },
    '/api/docs/embed': { ready: false, reason: 'Erweiterung vector fehlt' },
    '/api/docs/ask': (p, body) => ({ ready: true, empty: false, answer: `Etwa 3500 mPas [1]. Frage war: ${body.q}`, sources: [{ n: 1, media: 'm1', name: 'blatt.pdf', page: 4, heading: 'Technische Daten', nodes: [{ id: 'p1', role: 'product', label: 'Klebstoff A' }] }], warning: 'nur Wörter' }),
  })
  await mountView(root, ctx); await tick()
  assert.match(root.textContent, /ohne Vektoren/)
  const frage = root.querySelector('.ask input')
  frage.value = 'Wie zäh?'; frage.dispatchEvent(new win.Event('input'))
  frage.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter' })); await tick(); await tick()
  const post = rufe.find(r => r.methode === 'POST' && /\/api\/docs\/ask/.test(r.p))
  assert.ok(post, 'gefragt wurde der Server'); assert.equal(post.body.q, 'Wie zäh?')
  assert.match(root.querySelector('.answer-text').textContent, /3500 mPas \[1\]/)
  assert.match(root.querySelector('.ki-label')?.textContent ?? '', /^✧ Antwort der KI/, 'die Antwort ist sichtbar als KI-Antwort gekennzeichnet (Art. 50)')
  const quelle = root.querySelector('.source')
  assert.match(quelle.textContent, /\[1\]/); assert.match(quelle.textContent, /blatt\.pdf/); assert.match(quelle.textContent, /Seite 4/); assert.match(quelle.textContent, /Klebstoff A/)
  assert.match(root.querySelector('.answer').textContent, /nur Wörter/, 'die Warnung steht bei der Antwort')
  quelle.querySelectorAll('a')[1].dispatchEvent(new win.Event('click'))
  assert.equal(rufe.at(-1).p, '/tree/p1')
  // schliessen
  root.querySelector('.ask button.x').dispatchEvent(new win.Event('click')); await tick()
  assert.equal(root.querySelector('.answer'), null)
})

test('nichts in den Dokumenten: die Antwort sagt das, ohne Ratschlag', async () => {
  const { root, ctx } = welt({ '/api/docs/status': { ready: true }, '/api/docs/ask': { ready: true, empty: true, answer: null, sources: [] } })
  await mountView(root, ctx); await tick()
  const frage = root.querySelector('.ask input'); frage.value = 'x'; frage.dispatchEvent(new win.Event('input'))
  ;[...root.querySelectorAll('.ask button')].find(b => b.textContent === 'Fragen').dispatchEvent(new win.Event('click')); await tick(); await tick()
  assert.match(root.querySelector('.answer-text').textContent, /^Nichts in den Dokumenten dazu$/)
  assert.equal(root.querySelector('.ki-label'), null, 'ohne Antwort der KI kein Hinweis')
})
