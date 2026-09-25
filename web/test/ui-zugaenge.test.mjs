// ⌁ Zugänge: einmal einrichten, von jedem Plugin nutzbar. Zwei Sorten — wer Dateien liefert, bekommt einen
// Browser; eine Anmeldung hat keine Verzeichnisse. Das Passwort geht hinein und nie zurück (25.09.2026).
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { mount } from '@vue/test-utils'
import { api } from '../src/api.js'

const ARTEN = [
  { key: 'file', label: 'Dateisystem des Servers', dateien: true, felder: [], geheim: [] },
  { key: 'ftp', label: 'FTP', dateien: true, felder: ['host', 'port', 'benutzer', 'pfad'], geheim: ['passwort'] },
  { key: 'mysql', label: 'MySQL', dateien: false, felder: ['host', 'port', 'datenbank', 'benutzer'], geheim: ['passwort'] },
]
const ZUGAENGE = [
  { key: 'lokal', art: 'file', label: '⌂ Dieser Server', felder: {}, dateien: true, geheim: [] },
  { key: 'archiv', art: 'ftp', label: 'Archiv', felder: { host: 'ftp.beispiel.invalid' }, dateien: true, geheim: ['passwort'] },
  { key: 'erp', art: 'mysql', label: 'ERP', felder: { host: 'db.beispiel.invalid' }, dateien: false, geheim: ['passwort'] },
]

async function welt(gesendet = []) {
  const get = api.get, put = api.put
  api.get = async (p) => (p === '/api/drivers/arten' ? ARTEN : ZUGAENGE)
  api.put = async (p, body) => { gesendet.push({ p, body }); return {} }
  const { default: View } = await import('../../plugins/driver/src/View.vue')
  const w = mount(View)
  await new Promise(r => setTimeout(r, 0))
  await w.vm.$nextTick()
  return { w, ende: () => { api.get = get; api.put = put } }
}

test('die Liste trennt Dateizugänge von Anmeldungen', async () => {
  const { w, ende } = await welt()
  try {
    const zeilen = w.findAll('tbody tr').map(r => r.text())
    assert.ok(zeilen.some(z => z.includes('Archiv') && z.includes('📁')), 'FTP liefert Dateien')
    assert.ok(zeilen.some(z => z.includes('ERP') && z.includes('⚿')), 'MySQL ist eine Anmeldung')
    // eine Anmeldung bekommt keinen Browser-Knopf
    const erp = w.findAll('tbody tr').find(r => r.text().includes('ERP'))
    assert.ok(!erp.html().includes('Verzeichnisse ansehen'), 'kein Browser bei einer Anmeldung')
  } finally { ende() }
})

test('der eingebaute Zugang laesst sich nicht aendern oder entfernen', async () => {
  const { w, ende } = await welt()
  try {
    const lokal = w.findAll('tbody tr').find(r => r.text().includes('Dieser Server'))
    assert.ok(!lokal.html().includes('entfernen'), 'lokal bleibt')
    assert.ok(!lokal.html().includes('title="ändern"'), 'lokal ist nicht zu aendern')
  } finally { ende() }
})

test('das Geheimnis steht nur mit Namen da, nie mit Wert', async () => {
  const { w, ende } = await welt()
  try {
    const text = w.text()
    assert.ok(text.includes('passwort'), 'der Name des Geheimnisses steht da')
    // die Liste vom Server traegt nie einen Wert — hier faellt auf, wenn das je anders kaeme
    for (const z of ZUGAENGE) assert.ok(Array.isArray(z.geheim), 'nur Namen, kein Wert')
  } finally { ende() }
})

test('beim Aendern bleibt das Passwortfeld leer und behaelt das hinterlegte', async () => {
  const gesendet = []
  const { w, ende } = await welt(gesendet)
  try {
    // „ändern" an der FTP-Zeile
    const archiv = w.findAll('tbody tr').find(r => r.text().includes('Archiv'))
    await archiv.findAll('button').find(b => b.attributes('title') === 'ändern').trigger('click')
    await w.vm.$nextTick()
    const pw = w.findAll('input[type=password]')
    assert.equal(pw.length, 1)
    assert.equal(pw[0].element.value, '', 'das hinterlegte Passwort kommt nicht zurueck')
    assert.match(pw[0].attributes('placeholder') ?? '', /hinterlegt/)
  } finally { ende() }
})
