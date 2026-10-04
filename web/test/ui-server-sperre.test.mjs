// Ein Server ohne Lizenz oder ein gesperrter Server beantwortet nur /api/health (04.10.2026). Die Oberfläche zeigt dann nur diesen Zustand: kein
// Anmelden, keine Ansicht, keine Meldung je abgewiesener Anfrage. Wird er wieder frei, geht es ohne Neuladen weiter, und die Anmeldung wird neu gefragt.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { store } from '../src/store.js'
import ServerSperre from '../src/components/ServerSperre.vue'

function server(health) {
  const rufe = []
  globalThis.fetch = async url => {
    const pfad = String(url).replace(/^https?:\/\/[^/]+/, '')
    rufe.push(pfad)
    const antwort = pfad.startsWith('/api/health') ? health() : pfad.startsWith('/api/auth/state') ? { enabled: true, user: 'admin', role: 'admin' } : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}

test('ohne Lizenz: poll merkt es, auch abgemeldet — und frei wieder: die Anmeldung wird neu gefragt', async () => {
  let h = { head: 5, nodes: 1, version: '0.9.0', server: { id: 's2', ohneLizenz: true, gesperrt: false, erlaubt: 1 } }
  const rufe = server(() => h)
  await store.poll()
  assert.equal(store.serverSperre, 'lizenz')
  h = { ok: true, abgemeldet: true, version: '0.9.0', ohneLizenz: true }
  await store.poll()
  assert.equal(store.serverSperre, 'lizenz', 'auch ohne Sitzung')
  h = { ok: true, abgemeldet: true, version: '0.9.0', gesperrt: true }
  await store.poll()
  assert.equal(store.serverSperre, 'gesperrt')
  h = { head: 6, nodes: 1, version: '0.9.0', server: { id: 's2', ohneLizenz: false, gesperrt: false, erlaubt: 10 } }
  rufe.length = 0
  await store.poll(); await new Promise(r => setTimeout(r, 10))
  assert.equal(store.serverSperre, null)
  assert.equal(store.erlaubteServer, 10)
  assert.ok(rufe.includes('/api/auth/state'), 'die Anmeldung wird neu gefragt')
})

test('die Sperrseite sagt in einem Satz, was ist — Version darunter', async () => {
  store.serverSperre = 'lizenz'; store.erlaubteServer = 1; store.version = '0.9.0'; store.build = '0410.1009'
  let w = mount(ServerSperre)
  assert.equal(w.find('.satz').text(), 'Für einen weiteren Server fehlt die Lizenz.')
  assert.match(w.find('.satz').attributes('title'), /dürfen 1 Server laufen/)
  assert.match(w.text(), /0\.9\.0 ·0410\.1009/)
  w.unmount()
  store.serverSperre = 'gesperrt'
  w = mount(ServerSperre)
  assert.equal(w.find('.satz').text(), 'Dieser Server ist gesperrt.')
  w.unmount()
  store.serverSperre = null
})

test('App.vue zeigt bei einer Sperre nur die Sperrseite — die ganze Oberfläche steht im v-else', () => {
  const q = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const vorlage = q.slice(q.indexOf('<template>'), q.lastIndexOf('</template>'))
  assert.match(vorlage, /<ServerSperre v-if="store\.serverSperre" \/>\n\s*<div v-else class="shell"/)
})
