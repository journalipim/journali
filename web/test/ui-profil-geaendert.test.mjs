// Profile (14.10.2026): ohne gewähltes Profil stand „Einstellungen geändert — noch kein Profil“ schon beim Öffnen des Exports da — der Ausgangsstand
// war leer, und jeder Stand der Ansicht galt als Änderung. Jetzt ist der Stand beim Öffnen der Ausgangsstand, bis der Anwender etwas eingibt oder anklickt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, win } from './ui.mjs'
import ProfileBar from '../src/components/ProfileBar.vue'

const takt = () => new Promise(r => setTimeout(r, 1100))   // die Leiste vergleicht jede Sekunde

test('ohne Profil: beim Öffnen keine Leiste, nach einer Eingabe schon', async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]' })
  let stand = { roots: ['g-1'], locales: ['de'] }   // so geht die Ansicht auf: letzte Wahl oder erste Wurzel
  const w = mount(ProfileBar, { props: { plugin: 'table', scope: 'export', get: () => stand, set: () => {} }, attachTo: document.body })
  try {
    await flushPromises(); await takt()
    assert.equal(!!document.querySelector('.savebar'), false, 'nichts geändert — keine Leiste')
    stand = { roots: ['g-1'], locales: ['de'] }; await takt()
    assert.equal(!!document.querySelector('.savebar'), false, 'derselbe Stand bleibt unverändert')
    // der Anwender wählt eine zweite Sprache
    document.body.dispatchEvent(new win.Event('input', { bubbles: true }))
    stand = { roots: ['g-1'], locales: ['de', 'en'] }; await takt(); await flushPromises()
    assert.ok(document.querySelector('.savebar')?.textContent.includes('noch kein Profil'), 'jetzt ist etwas geändert')
  } finally { w.unmount() }
})
