// Anmeldung gesperrt (zu viele Fehlversuche): der Server antwortet 429 mit Retry-After. Die Seite zählt die Sekunden herunter, der Knopf wartet —
// ein Versuch in der Sperre setzt sie am Server wieder auf eine ganze Minute, darum geht keiner hinaus, bevor sie abgelaufen ist.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'

const LoginView = (await import('../src/views/LoginView.vue')).default

function server(antworten) {
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url).replace(/^https?:\/\/[^/]+/, '')
    rufe.push({ pfad, methode: opt.method ?? 'GET' })
    const a = typeof antworten === 'function' ? antworten(pfad, rufe) : antworten
    const kopf = new Headers(a.kopf ?? {})
    return { ok: (a.status ?? 200) < 400, status: a.status ?? 200, statusText: '', headers: kopf, text: async () => JSON.stringify(a.body ?? {}), json: async () => a.body ?? {} }
  }
  return rufe
}
const router = { path: '/login', push() {}, replace(p) { this.path = p } }
async function seite() {
  store.auth = { known: true, enabled: true, setup: false, user: null }
  const w = mount(LoginView, { global: { provide: { [routerKey]: router } } })
  await flushPromises()
  await w.find('input[type=text]').setValue('taloan'); await w.find('input[type=password]').setValue('falsch')
  return w
}

test('429: die Sekunden laufen herunter, der Knopf wartet, danach geht es wieder', async () => {
  mock.timers.enable({ apis: ['setInterval'] })
  const rufe = server((pfad) => pfad === '/api/auth/login'
    ? { status: 429, kopf: { 'Retry-After': '60' }, body: { error: 'Zu viele Anmeldeversuche — gesperrt für 60 Sekunden.', template: 'Zu viele Anmeldeversuche — gesperrt für {0} Sekunden.', args: ['60'] } }
    : { body: {} })
  const w = await seite()
  await w.find('form').trigger('submit'); await flushPromises()
  assert.match(w.find('.sperre').text(), /gesperrt für 60 Sekunden/)
  assert.equal(w.find('button[type=submit]').attributes('disabled') !== undefined, true, 'der Knopf wartet')
  mock.timers.tick(22000); await flushPromises()
  assert.match(w.find('.sperre').text(), /gesperrt für 38 Sekunden/, 'der Zähler läuft')
  const vorher = rufe.filter(r => r.pfad === '/api/auth/login').length
  await w.find('form').trigger('submit'); await flushPromises()
  assert.equal(rufe.filter(r => r.pfad === '/api/auth/login').length, vorher, 'in der Sperre geht kein Versuch hinaus (Enter im Feld)')
  mock.timers.tick(38000); await flushPromises()
  assert.equal(w.find('.sperre').exists(), false, 'abgelaufen: die Meldung ist weg')
  assert.equal(w.find('button[type=submit]').attributes('disabled'), undefined, 'der Knopf ist frei')
  w.unmount(); mock.timers.reset()
})

test('ein falsches Passwort ohne Sperre zeigt die Meldung des Servers und keinen Zähler', async () => {
  server((pfad) => ({ status: 401, body: { error: 'Anwender oder Passwort falsch.' } }))
  const w = await seite()
  await w.find('form').trigger('submit'); await flushPromises()
  assert.equal(w.find('.sperre').exists(), false)
  assert.match(w.text(), /Anwender oder Passwort falsch/)
  assert.equal(w.find('button[type=submit]').attributes('disabled'), undefined)
  w.unmount()
})

// Demo (07.10.2026): die Anmeldeseite nennt den Zugang demo / demo — sonst nicht
test('Demo: die Anmeldeseite nennt Anmeldename und Passwort', async () => {
  server({ body: {} })
  store.demo = true
  try {
    const w = await seite()
    assert.match(w.find('.demo-zugang').text(), /Anmeldename demo, Passwort demo/)
    w.unmount()
  } finally { store.demo = false }
  const w = await seite()
  assert.equal(w.find('.demo-zugang').exists(), false)
  w.unmount()
})

// Demo (07.10.2026): unter dem Zugang stehen Impressum und Datenschutz — auf journali.de
test('Demo: die Anmeldeseite verlinkt Impressum und Datenschutz', async () => {
  server({ body: {} })
  store.demo = true
  try {
    const w = await seite()
    const links = w.findAll('.rechtliches a').map(a => [a.text(), a.attributes('href')])
    assert.deepEqual(links, [['Impressum', 'https://journali.de/impressum/'], ['Datenschutz', 'https://journali.de/datenschutz/']])
    w.unmount()
  } finally { store.demo = false }
})
