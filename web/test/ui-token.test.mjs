// Einstellungen → API-Token (Taloan, 22.09.2026: „es gibt übrigens einen Absturz wenn ich auf den copy knopf klicke“).
// Ursache war ein Browser-Global im Template: Vue löst dort jeden Namen gegen die Komponente auf, „navigator“ wurde
// zu undefined. Hier wird der Knopf wirklich geklickt — einmal mit Zwischenablage, einmal ohne (http auf einem
// fremden Rechner hat keine): beides darf nicht abstürzen und muss etwas sagen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, button } from './ui.mjs'
import { store } from '../src/store.js'

const UsersSettings = (await import('../src/components/UsersSettings.vue')).default
const TOKEN = 'jt_probe_1234567890'

/// Server, der nur auf das Anlegen eines Tokens antwortet — alles andere bleibt leer
function fakeServer() {
  globalThis.fetch = async (url, opts) => {
    const body = String(url).endsWith('/api/auth/tokens') && opts?.method === 'POST'
      ? { token: TOKEN, label: 'Probe', hint: 'Nur jetzt sichtbar — als Authorization: Bearer <token> senden.' }
      : String(url).endsWith('/api/auth/me') ? { user: 'taloan', role: 'admin', rights: [], tokens: [] } : []
    return { ok: true, status: 200, text: async () => JSON.stringify(body) }
  }
}

/// Zwischenablage, die entweder annimmt oder verweigert (kein sicherer Kontext)
function clipboard({ fails = false } = {}) {
  const geschrieben = []
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async t => { if (fails) throw new Error('NotAllowedError'); geschrieben.push(t) } },
  })
  return geschrieben
}

async function offen() {
  fakeServer()
  store.toasts.length = 0
  const w = mount(UsersSettings)
  await flushPromises()
  await button(w, '＋ Token').trigger('click')
  await flushPromises()
  assert.ok(w.text().includes(TOKEN), 'das neue Token steht im Dialog')
  return w
}

test('Kopierknopf legt das Token in die Zwischenablage', async () => {
  const w = await offen()
  const geschrieben = clipboard()
  await button(w, '⧉').trigger('click')
  await flushPromises()
  assert.deepEqual(geschrieben, [TOKEN])
  assert.ok(store.toasts.some(t => t.text === 'kopiert'), 'sagt „kopiert“')
})

test('ohne Zwischenablage kein Absturz, sondern ein Hinweis', async () => {
  const w = await offen()
  clipboard({ fails: true })
  await button(w, '⧉').trigger('click')
  await flushPromises()
  assert.ok(store.toasts.some(t => /Strg\+C/.test(t.text)), `Hinweis fehlt — da steht: ${store.toasts.map(t => t.text).join(' | ')}`)
})

test('der Text bleibt markierbar, auch wenn das Kopieren nicht geht', async () => {
  const w = await offen()
  const span = w.findAll('span').find(s => s.text().includes(TOKEN))
  assert.ok(span, 'das Token steht als Text da')
  assert.match(span.attributes('style') ?? '', /user-select:\s*all/)
})
