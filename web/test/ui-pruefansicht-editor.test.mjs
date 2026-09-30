// Prüfansicht: für Vorlage- und Formel-Attribute öffnet ein Knopf den vorhandenen Editor (ScriptEditor) am Knoten.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'
import { api } from '../src/api.js'
import { editorOeffnen } from '../src/compliance.js'

const warte = (ms = 0) => new Promise(r => setTimeout(r, ms))
const knopf = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(text))

test('editorOeffnen: der Editor steht im Dokument mit Titel, Übernehmen ruft onSave mit dem Text und schliesst', async () => {
  const post = api.post
  api.post = async () => ({ ok: true, error: null, keys: ['name'] })
  const gespeichert = [], zu = []
  try {
    editorOeffnen({ title: 'Handelsname · Kleber', draftKey: 'p1.dpp_trade_name.test', type: 'template', node: 'p1', attributes: [{ key: 'name', label: { de: 'Name' }, type: 'text' }],
      modelValue: '{name}', onSave: v => gespeichert.push(v), onClose: () => zu.push(true) })
    await warte(20)
    assert.ok(document.querySelector('.overlay'), 'der Editor steht im Dokument')
    assert.match(document.body.textContent, /Handelsname · Kleber/)
    const uebernehmen = knopf('Übernehmen'); assert.ok(uebernehmen, 'Knopf Übernehmen')
    uebernehmen.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await warte(20)
    assert.deepEqual(gespeichert, ['{name}'])
    assert.deepEqual(zu, [true])
    assert.equal(document.querySelector('.overlay'), null, 'der Editor ist wieder weg')
  } finally { api.post = post }
})

test('editorOeffnen: Schliessen ruft nur onClose, nichts wird gespeichert', async () => {
  const post = api.post
  api.post = async () => ({ ok: true, error: null, keys: [] })
  const gespeichert = [], zu = []
  try {
    editorOeffnen({ title: 'Modell', draftKey: 'p1.x.test2', type: 'template', node: 'p1', attributes: [], modelValue: '', onSave: v => gespeichert.push(v), onClose: () => zu.push(true) })
    await warte(20)
    knopf('Schliessen').dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await warte(20)
    assert.deepEqual(gespeichert, [])
    assert.deepEqual(zu, [true])
  } finally { api.post = post }
})
