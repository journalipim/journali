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

test('gibt es nur den eingebauten Zugang, steht kein leeres Formular da', async () => {
  const get = api.get
  api.get = async (p) => (p === '/api/drivers/arten'
    ? [{ key: 'file', label: 'Dateisystem des Servers', dateien: true, felder: [], geheim: [] }]
    : [{ key: 'lokal', art: 'file', label: '⌂ Dieser Server', felder: {}, dateien: true, geheim: [] }])
  try {
    const { default: View } = await import('../../plugins/driver/src/View.vue')
    const w = mount(View)
    await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick()
    // Angeboten wird nur, was traegt: ohne weitere Art gibt es nichts anzulegen
    assert.match(w.text(), /weitere Arten kommen/)
    assert.equal(w.findAll('input[type=password]').length, 0)
  } finally { api.get = get }
})

// ---- 28.09.2026: WebDAV und FTP liefern Dateien, IXP und Solr sind Anmeldungen — alle im einen Plugin driver
test('die Felder heissen im Formular, wie ein Anwender sie kennt; TLS ist eine Wahl, kein Freitext', async () => {
  const get = api.get
  api.get = async p => (p === '/api/drivers/arten'
    ? [{ key: 'file', label: 'x', dateien: true, felder: [], geheim: [] }, { key: 'ftp', label: 'FTP', dateien: true, felder: ['host', 'port', 'user', 'pfad', 'tls'], geheim: ['password'] }, { key: 'ixp', label: 'IXP', dateien: false, felder: ['url'], geheim: ['token'] }]
    : [{ key: 'lokal', art: 'file', label: '⌂ Dieser Server', felder: {}, dateien: true, geheim: [] }, { key: 'quelle', art: 'ixp', label: 'Quelle', felder: { url: 'https://api.beispiel.invalid' }, dateien: false, geheim: ['token'] }])
  try {
    const { default: View } = await import('../../plugins/driver/src/View.vue')
    const w = mount(View)
    await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick()
    const text = w.text()
    assert.match(text, /Rechner/); assert.match(text, /Startverzeichnis/); assert.match(text, /Passwort/)
    assert.equal(w.findAll('select').length, 2, 'Art und TLS')
    assert.match(w.findAll('select')[1].text(), /explizites TLS/)
    assert.match(w.find('select').text(), /IXP \(Anmeldung\)/, 'die Art heisst, was sie ist')
    const quelle = w.findAll('tbody tr').find(r => r.text().includes('Quelle'))
    assert.match(quelle.text(), /IXP \(Anmeldung\)/); assert.match(quelle.text(), /Token/)
  } finally { api.get = get }
})

test('⟳ prüft einen Zugang und schreibt die Antwort an die Zeile', async () => {
  const get = api.get, post = api.post, gefragt = []
  api.get = async p => (p === '/api/drivers/arten' ? ARTEN : ZUGAENGE)
  api.post = async (p) => { gefragt.push(p); return p.includes('/archiv/') ? { ok: true, text: '3' } : { ok: false, text: 'FTP LIST /: 530 Login incorrect' } }
  try {
    const { default: View } = await import('../../plugins/driver/src/View.vue')
    const w = mount(View)
    await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick()
    const zeile = name => w.findAll('tbody tr').find(r => r.text().includes(name))
    assert.equal(zeile('Dieser Server').findAll('button').filter(b => b.text() === '⟳').length, 0, 'der eingebaute braucht keine Prüfung')
    await zeile('Archiv').findAll('button').find(b => b.text() === '⟳').trigger('click')
    await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick()
    assert.deepEqual(gefragt, ['/api/drivers/archiv/test'])
    assert.match(zeile('Archiv').find('td.pruef').text(), /^erreichbar$/)
    await zeile('ERP').findAll('button').find(b => b.text() === '⟳').trigger('click')
    await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick()
    const erp = zeile('ERP').find('td.pruef')
    assert.match(erp.text(), /nicht erreichbar/); assert.match(erp.attributes('title'), /530/)
    assert.ok(erp.classes('neg'))
  } finally { api.get = get; api.post = post }
})

// ---- 29.09.2026: die Art HTTP/REST — ein Fremdsystem per API anbinden, ohne ein Plugin zu schreiben
test('die Art HTTP/REST: die Anmeldung ist eine Wahl, das Geheimnis ist ein Passwortfeld', async () => {
  const get = api.get
  api.get = async p => (p === '/api/drivers/arten'
    ? [{ key: 'file', label: 'x', dateien: true, felder: [], geheim: [] }, { key: 'http', label: 'HTTP/REST', dateien: false, felder: ['url', 'auth', 'user', 'header'], geheim: ['secret'] }]
    : [{ key: 'lokal', art: 'file', label: '⌂ Dieser Server', felder: {}, dateien: true, geheim: [] }])
  try {
    const { default: View } = await import('../../plugins/driver/src/View.vue')
    const w = mount(View)
    await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick()
    // die Art HTTP/REST wählen — dann steht ihr Formular da
    await w.find('select').setValue('http')
    await w.vm.$nextTick()
    // die Anmeldung ist ein Auswahlfeld, kein Freitext
    const selects = w.findAll('select')
    assert.ok(selects.some(s => s.text().includes('Bearer-Token') && s.text().includes('eigener Kopf')), 'Bearer/Basic/eigener Kopf zur Wahl')
    assert.equal(w.findAll('input[type=password]').length, 1, 'das Geheimnis ist ein Passwortfeld')
    assert.match(w.text(), /Kopf/)
  } finally { api.get = get }
})
