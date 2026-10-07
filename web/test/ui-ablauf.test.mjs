// Erinnerung vor dem Ablauf (07.10.2026): die Kopfzeile zeigt das Nächste, was endet; in der Startphase und in der Demo fragt sie gar nicht.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { ladeAblauf, ablaufText, ablaufTitel } from '../src/ablauf.js'

const LISTE = [{ was: 'abo', team: 'de', teamLabel: 'Deutschland', tarif: 'Pro', am: '2026-10-16', tage: 9 }, { was: 'test', team: null, teamLabel: null, tarif: 'Enterprise', am: '2026-10-19', tage: 12 }]

test('Startphase und Demo fragen nicht; sonst kommt die Liste vom Server', async () => {
  const get = api.get
  const gefragt = []
  api.get = async p => { gefragt.push(p); return LISTE }
  store.auth = { known: true, enabled: true, user: 'admin' }
  try {
    store.startphase = true; assert.deepEqual(await ladeAblauf(), [])
    store.startphase = false; store.demo = true; assert.deepEqual(await ladeAblauf(), [])
    assert.deepEqual(gefragt, [])
    store.demo = false
    assert.equal((await ladeAblauf()).length, 2)
    assert.deepEqual(gefragt, ['/api/licence/ablauf'])
  } finally { api.get = get; store.ablauf = []; store.startphase = false; store.demo = false }
})

test('Text und Tooltip', () => {
  assert.equal(ablaufText(LISTE[0]), '⏳ Abo Pro endet in 9 Tagen')
  assert.equal(ablaufText({ ...LISTE[0], tage: 1 }), '⏳ Abo Pro endet morgen')
  assert.equal(ablaufText({ ...LISTE[1], tage: 0 }), '⏳ Test Enterprise endet heute')
  const titel = ablaufTitel(LISTE)
  assert.match(titel, /Abo Pro endet in 9 Tagen · Deutschland \(2026-10-16\)/)
  assert.match(titel, /sorgt der Betreiber/)
})

test('die Kopfzeile verlinkt den Hinweis auf das Team', async () => {
  const fs = await import('node:fs')
  const app = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /<router-link v-if="!abgemeldet && store\.ablauf\?\.length" to="\/settings#teams" class="warn ablauf" :title="ablaufTitel\(store\.ablauf\)">\{\{ ablaufText\(store\.ablauf\[0\]\) \}\}<\/router-link>/)
})
