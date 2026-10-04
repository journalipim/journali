// Dauerlast (04.10.2026): bei jedem neuen Stand irgendwo lud jeder Tab das ganze Modell und den ganzen Baum. Jetzt: das Modell nur, wenn modelAt sich
// ändert; der Baum bei fremden Ständen höchstens alle 10 s, eigene Aktionen laden ihn sofort.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { nextTick } from 'vue'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

test('das Modell kommt nur neu, wenn modelAt sich ändert', async () => {
  const gefragt = []; let health = { ok: true, head: 10, modelAt: 5 }
  const orig = api.get
  api.get = async p => { gefragt.push(p); if (p.startsWith('/api/health')) return health; if (p === '/api/model') return { attributes: [], locales: [] }; return [] }
  try {
    store.model = null; store.modelAt = null
    await store.poll()
    assert.equal(gefragt.filter(p => p === '/api/model').length, 1, 'beim ersten Mal')
    health = { ok: true, head: 11, modelAt: 5 }; await store.poll()
    health = { ok: true, head: 12, modelAt: 5 }; await store.poll()
    assert.equal(gefragt.filter(p => p === '/api/model').length, 1, 'Werte ändern sich, das Modell nicht')
    health = { ok: true, head: 13, modelAt: 13 }; await store.poll()
    assert.equal(gefragt.filter(p => p === '/api/model').length, 2, 'das Modell hat sich geändert')
  } finally { api.get = orig }
})

test('fremde Stände laden den Baum höchstens alle 10 s, eigene Aktionen sofort', async () => {
  let geladen = 0
  const orig = api.get
  api.get = async p => { if (p === '/api/tree') geladen++; return [] }
  try {
    await tree.load(); geladen = 0
    store.head = 100; await nextTick(); store.head = 101; await nextTick(); store.head = 102; await nextTick()
    await new Promise(r => setTimeout(r, 30))
    assert.equal(geladen, 0, 'innerhalb von 10 s nach dem letzten Laden: noch nicht')
    await tree.load()
    assert.equal(geladen, 1, 'eine eigene Aktion lädt sofort')
  } finally { api.get = orig }
})
