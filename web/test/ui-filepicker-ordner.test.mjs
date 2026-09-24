// Dateibrowser: Ordner anlegen und umbenennen. Der Name wird vorher geprüft — ein Pfad wäre ein Weg an das
// gewählte Verzeichnis vorbei; der Server prüft ihn ebenso (FileApiTests).
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { ordnerName, filePicker } from '../src/filePicker.js'
import { dialog } from '../src/dialog.js'

test('ein Name ist kein Pfad und hat keine Sonderzeichen', () => {
  assert.equal(ordnerName(' Sicherung 2026 '), 'Sicherung 2026')
  for (const schlecht of ['', '   ', '.', '..', '../weg', String.raw`..\weg`, 'a/b', 'C:', 'was?', 'stern*', 'zoll"', null, 'a'.repeat(121)])
    assert.equal(ordnerName(schlecht), null, String(schlecht))
})

const warte = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 0)) }

function server(routen = {}) {
  const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    calls.push({ path, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    const a = routen[path] ?? { path: 'C:\daten', parent: null, roots: [], dirs: [{ name: 'alt', path: 'C:\daten\alt' }], files: [], blobs: 0 }
    return { ok: true, status: 200, statusText: 'x', text: async () => JSON.stringify(a) }
  }
  return calls
}

test('＋ legt einen Ordner im angezeigten Verzeichnis an und springt hinein', async () => {
  const calls = server({ '/api/files/dir': { path: 'C:\daten\neu' } })
  const orig = dialog.prompt; dialog.prompt = async () => 'neu'
  try {
    filePicker({ value: 'C:\daten', dirOnly: true })
    await warte()
    document.querySelector('button.neu').click()
    await warte()
    const an = calls.find(c => c.path === '/api/files/dir' && c.method === 'POST')
    assert.deepEqual(an.body, { path: 'C:\daten', name: 'neu' })
    assert.ok(calls.some(c => c.path === '/api/files' && c.method === 'GET'), 'danach nicht neu gelesen')
  } finally { dialog.prompt = orig; document.querySelector('button.neu')?.closest('div[style*="fixed"]')?.remove() }
})

test('✎ benennt den markierten Ordner um; ein ungültiger Name geht gar nicht erst hinaus', async () => {
  let calls = server({ '/api/files/dir': { path: 'C:\daten\anders' } })
  const orig = dialog.prompt
  dialog.prompt = async () => '../weg'
  try {
    filePicker({ value: 'C:\daten', dirOnly: true })
    await warte()
    document.querySelector('button.ren').click()
    await warte()
    assert.ok(!calls.some(c => c.path === '/api/files/dir'), 'ein Pfad als Name ging an den Server')

    dialog.prompt = async () => 'anders'
    document.querySelector('button.ren').click()
    await warte()
    const um = calls.find(c => c.path === '/api/files/dir' && c.method === 'PUT')
    assert.deepEqual(um.body, { path: 'C:\daten', name: 'anders' }, 'ohne Markierung gilt das angezeigte Verzeichnis')
  } finally { dialog.prompt = orig; document.querySelector('button.ren')?.closest('div[style*="fixed"]')?.remove() }
})
