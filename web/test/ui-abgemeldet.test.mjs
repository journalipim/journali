// Abgemeldet (01.10.2026): auf der Anmeldeseite zeigt die Oberfläche nichts von der Instanz — keine Leiste mit den Plugins, keine Kennzahlen, keine Lesezeichen,
// keinen Namen. Ohne Benutzer in der Instanz bleibt alles offen wie bisher.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { istAbgemeldet } from '../src/abgemeldet.js'
import { readFileSync } from 'node:fs'

test('die Anmeldeseite gilt immer als abgemeldet', () => {
  assert.equal(istAbgemeldet('/login', { enabled: true, user: 'taloan' }), true, 'auch mit einem alten Benutzer im Zustand')
  assert.equal(istAbgemeldet('/login', { enabled: false }), true)
})

test('mit Benutzern in der Instanz, aber ohne Sitzung, ist man abgemeldet — wohin man auch schaut', () => {
  assert.equal(istAbgemeldet('/tree', { enabled: true, user: null }), true)
  assert.equal(istAbgemeldet('/tree', { enabled: true }), true)
})

test('angemeldet, oder eine Instanz ohne Benutzer: nichts ist ausgeblendet', () => {
  assert.equal(istAbgemeldet('/tree', { enabled: true, user: 'taloan' }), false)
  assert.equal(istAbgemeldet('/tree', { enabled: false, user: null }), false, 'ohne Benutzer bleibt alles offen')
  assert.equal(istAbgemeldet('/tree', undefined), false)
})

test('App.vue blendet Leiste, Kennzahlen, Lesezeichen und Namen aus, wenn man abgemeldet ist — Marke, Version und Hilfe bleiben', async () => {
  const App = (await import('../src/App.vue')).default
  assert.ok(App, 'App.vue übersetzt')
  const q = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const nav = q.slice(q.indexOf('<nav class="rail"'), q.indexOf('</nav>'))
  assert.match(nav, /v-for="n in \(abgemeldet \? \[\] : railItems\)"/, 'die Einträge der Leiste erscheinen nur angemeldet')
  assert.ok(nav.includes('rail-logo') && nav.includes('rail-status') && !/rail-status[^>]*v-if/.test(nav), 'Logo und Punkt (Server und Datenbank erreichbar) bleiben auch abgemeldet')
  const kopf = q.slice(q.indexOf('<header class="status"'), q.indexOf('</header>'))
  const geschuetzt = ['#{{ store.head }}', '▣ {{ store.nodes }}', '<UsageMini', 'lesezeichen-knopf', 'store.auth.name || store.auth.user', '✧ KI {0}']
  // alles, was zu einer angemeldeten Person gehört, steht in einem Block v-if="!abgemeldet"
  const bloecke = [...kopf.matchAll(/<template v-if="!abgemeldet">([\s\S]*?)\n      <\/template>\n/g)].map(m => m[1])
  assert.ok(bloecke.length >= 2, 'zwei Blöcke: Kennzahlen und Person')
  for (const z of geschuetzt) assert.ok(bloecke.some(b => b.includes(z)), `${z} steht nur im angemeldeten Zustand`)
  // Marke, Version und Hilfe stehen ausserhalb
  const aussen = bloecke.reduce((k, b) => k.replace(b, ''), kopf)
  for (const z of ['class="brand"', 'store.version', '<HelpButton']) assert.ok(aussen.includes(z), `${z} bleibt sichtbar`)
})
