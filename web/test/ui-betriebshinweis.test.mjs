// Hinweise zum Betrieb (05.10.2026): gefragt wird einmal je Laden, nur wer die Instanz verwaltet, und nur solange die geltende Version nicht
// bestätigt ist. Bestätigt geht die Version an den Server; „später“ schickt nichts.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'
import { frageNachBetriebshinweis, zeigeTesthinweis, _wiederFragen } from '../src/betriebshinweis.js'

const HINWEIS = { version: '2026-10-05', title: { de: 'Hinweise zum Betrieb' }, points: [{ de: 'Sicherung liegt beim Betreiber.' }, { de: 'Für Unternehmen.' }] }

async function frage({ bestaetigt = null, rechte = ['users'], antwort = true } = {}) {
  _wiederFragen()
  store.auth.known = true; store.auth.enabled = true; store.auth.user = 'admin'; store.auth.rights = rechte
  const gefragt = [], gesendet = []
  const get = api.get, post = api.post, confirm = dialog.confirm
  api.get = async p => p === '/api/notice' ? { ...HINWEIS, acknowledged: bestaetigt } : {}
  api.post = async p => { gesendet.push(p); return {} }
  dialog.confirm = async o => { gefragt.push(o); return antwort }
  try { await frageNachBetriebshinweis(); return { gefragt, gesendet } }
  finally { api.get = get; api.post = post; dialog.confirm = confirm }
}

test('offen: die Frage nennt die Punkte; bestätigt geht die Version an den Server', async () => {
  const { gefragt, gesendet } = await frage()
  assert.equal(gefragt.length, 1)
  assert.equal(gefragt[0].title, 'Hinweise zum Betrieb')
  assert.deepEqual(gefragt[0].list, ['Sicherung liegt beim Betreiber.', 'Für Unternehmen.'])
  assert.deepEqual(gesendet, ['/api/notice/acknowledge?version=2026-10-05'])
})

test('„später“ schickt nichts', async () => {
  const { gesendet } = await frage({ antwort: false })
  assert.deepEqual(gesendet, [])
})

test('schon bestätigt oder ohne Recht users: keine Frage', async () => {
  assert.equal((await frage({ bestaetigt: '2026-10-05' })).gefragt.length, 0)
  assert.equal((await frage({ rechte: ['read'] })).gefragt.length, 0)
})
// Testversion (07.10.2026): das rote Feld oben zeigt den Hinweis des Servers — ohne Anmeldung, ohne Recht
test('Testversion: ein Klick zeigt den Hinweis des Servers als Punkte', async () => {
  store.auth.known = true; store.auth.enabled = true; store.auth.user = null; store.auth.rights = []
  const geholt = [], gezeigt = []
  const get = api.get, help = dialog.help
  api.get = async p => { geholt.push(p); return { test: true, title: { de: 'Testversion' }, points: [{ de: 'Nur zum Testen.' }, { de: 'Ohne Haftung.' }] } }
  dialog.help = async o => { gezeigt.push(o) }
  try { assert.equal(await zeigeTesthinweis(), true) }
  finally { api.get = get; dialog.help = help }
  assert.deepEqual(geholt, ['/api/testversion'])
  assert.equal(gezeigt[0].title, 'Testversion')
  assert.deepEqual(gezeigt[0].rows, [['•', 'Nur zum Testen.'], ['•', 'Ohne Haftung.']])
})

test('Testversion: das Feld steht in der Statusleiste und ruft den Hinweis', async () => {
  const fs = await import('node:fs')
  const app = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /<button v-if="store\.testversion" class="testversion"[^>]*@click="zeigeTesthinweis">\{\{ \$t\("Testversion"\) \}\}<\/button>/)
})
// Demo (07.10.2026): /api/health sagt demo; dann gibt es weder Abmelden noch Passwort und Token
test('Demo: der Stand kommt aus /api/health, Abmelden und das eigene Konto entfallen', async () => {
  const get = api.get
  api.get = async p => p.startsWith('/api/health') ? { ok: true, demo: true, testversion: true, version: '0.9.0', head: 1, nodes: 1 } : {}
  try { await store.poll(true) } finally { api.get = get }
  assert.equal(store.demo, true)
  assert.equal(store.testversion, true)
  const fs = await import('node:fs')
  const app = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /<button v-if="!store\.demo"[^>]*@click="logout"/)
  const einstellungen = fs.readFileSync(new URL('../src/views/SettingsView.vue', import.meta.url), 'utf8')
  assert.match(einstellungen, /<AccountSettings v-if="store\.auth\.enabled && !store\.demo" \/>/)
})
// Demo (07.10.2026): ansehen ja, speichern und neu anlegen nein — die Oberfläche blendet aus, was data-demo="aus" trägt
test('Demo: Hochladen, Profile, Workflows, Presets, Modell und Plugins tragen data-demo', async () => {
  const fs = await import('node:fs')
  const lies = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8')
  assert.match(lies('../src/style.css'), /html\.demo \[data-demo="aus"\] \{ display: none !important; \}/)
  assert.match(lies('../src/App.vue'), /classList\.toggle\('demo', !!d\)/)
  const erwartet = {
    '../src/views/MediaView.vue': [/<button class="primary" data-demo="aus" @click="fileInput\.click\(\)"/, /if \(store\.demo\) return; upload\(/],
    '../src/components/WorkflowSettings.vue': [/data-demo="aus" :disabled="!dirty" @click="save"/],
    '../src/components/StorageSettings.vue': [/data-demo="aus" style="gap:8px;margin-top:6px"><button @click="newPreset"/],
    '../src/components/ProfileBar.vue': [/<input data-demo="aus" v-model="name"/, /class="savebar" data-demo="aus"/],
    '../src/views/ModelView.vue': [/<input data-demo="aus" v-model="newKey"/],
    '../../plugins/xliff/entry.js': [/const keyIn = el\('input', \{ 'data-demo': 'aus'/, /const writeBtn = el\('button', \{ 'data-demo': 'aus'/],
    '../../plugins/datasheet/designer.js': [/const nameIn = el\('input', \{ 'data-demo': 'aus'/],
  }
  for (const [datei, muster] of Object.entries(erwartet)) for (const m of muster) assert.match(lies(datei), m, datei)
})
// Demo: Kontextmenüs ohne Zurückziehen, Import und Massenbearbeitung — Einträge mit demo: 'aus' fallen weg, auch in Untermenüs
test('Demo: das Kontextmenü lässt Einträge mit demo aus weg, leere Untermenüs und Trennlinien am Rand ebenso', async () => {
  const { menu } = await import('../src/menu.js')
  const items = [{ label: 'Umbenennen' }, { sep: true }, { label: 'Import', items: [{ label: 'CSV', demo: 'aus' }] }, { label: 'Status', items: [{ label: 'aktiv' }, { label: 'weg', demo: 'aus' }] }, { sep: true }, { label: 'Zurückziehen', demo: 'aus' }]
  const e = { preventDefault() {}, clientX: 0, clientY: 0 }
  store.demo = true
  try {
    menu.open(e, items)
    assert.deepEqual(menu.items.map(x => x.sep ? '—' : x.label), ['Umbenennen', '—', 'Status'])
    assert.deepEqual(menu.items[2].items.map(x => x.label), ['aktiv'])
  } finally { store.demo = false }
  menu.open(e, items)
  assert.equal(menu.items.length, items.length)   // ausserhalb der Demo alles
  const fs = await import('node:fs')
  const baum = fs.readFileSync(new URL('../src/views/TreeView.vue', import.meta.url), 'utf8')
  assert.match(baum, /\{ demo: 'aus', label: kids \? t_\('Mit \{0\} darunter zurückziehen'/)
  assert.match(baum, /k === 'import' \? \{ demo: 'aus' \}/)
  assert.match(fs.readFileSync(new URL('../src/views/MediaView.vue', import.meta.url), 'utf8'), /\{ demo: 'aus', label: n > 1 \? t_\('\{0\} Assets zurückziehen'/)
})
