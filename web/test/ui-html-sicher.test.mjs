// Sicherheit (07.10.2026): gespeichertes HTML führt im Browser nichts aus — der Editor (HtmlCell) und das Datenblatt setzen Werte nur bereinigt
// ein; in der Demo schreiben Plugins keine Daten und die Oberfläche keine Einstellungen der Person.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { sicheresHtml } from '../src/html-sicher.js'
import { store } from '../src/store.js'
import { api } from '../src/api.js'

const BOESE = '<p>Text</p><img src="x" onerror="window.__boese = 1"><script>window.__boese = 2</script><a href="javascript:void(0)">a</a><iframe src="/"></iframe>'

test('sicheresHtml: Text und Auszeichnung bleiben, Skript, Ereignisse, Rahmen und javascript: fallen weg', () => {
  const s = sicheresHtml(BOESE)
  assert.match(s, /<p>Text<\/p>/)
  assert.doesNotMatch(s, /onerror|<script|javascript:|<iframe/i)
  assert.match(sicheresHtml('<a href="https://beispiel.example" target="_blank">x</a>'), /href="https:\/\/beispiel\.example"[^>]*rel="noopener noreferrer"/)
  assert.equal(sicheresHtml('<ul><li><b>a</b></li></ul>'), '<ul><li><b>a</b></li></ul>')
  assert.equal(sicheresHtml(null), '')
})

test('HtmlCell: der Editor öffnet einen gespeicherten Wert bereinigt', async () => {
  const HtmlCell = (await import('../src/components/HtmlCell.vue')).default
  globalThis.window.__boese = 0
  const w = mount(HtmlCell, { props: { value: BOESE, title: 'Beschreibung', label: 'Beschreibung', locale: 'de', node: 'p-1' }, attachTo: document.body })
  try {
    await w.find('.cell-box').trigger('click'); await flushPromises()
    const rich = document.querySelector('[contenteditable]')
    assert.ok(rich, 'der Editor ist offen')
    assert.doesNotMatch(rich.innerHTML, /onerror|<script|javascript:|<iframe/i)
    assert.match(rich.innerHTML, /Text/)
    assert.equal(globalThis.window.__boese, 0, 'nichts ausgeführt')
  } finally { w.unmount() }
})

test('Datenblatt: Platzhalter setzen Text maskiert und HTML bereinigt ein — im Browser und ohne DOM', async () => {
  const { sicheresHtml: imBlatt, esc } = await import('../../plugins/datasheet/sicher.js')
  assert.doesNotMatch(imBlatt(BOESE), /onerror|<script|javascript:|<iframe/i)
  assert.equal(esc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;')
  const dom = globalThis.DOMParser
  try {
    delete globalThis.DOMParser
    const ohne = imBlatt(BOESE)
    assert.doesNotMatch(ohne, /onerror|<script|javascript:|<iframe/i)
    assert.match(ohne, /<p>Text<\/p>/)
  } finally { globalThis.DOMParser = dom }
  const fs = await import('node:fs')
  const designer = fs.readFileSync(new URL('../../plugins/datasheet/designer.js', import.meta.url), 'utf8')
  assert.match(designer, /el\('span', \{ html: sicheresHtml\(v\) \}\)/)
  assert.match(designer, /d\.types\?\.\[k\] === 'html' \? sicheresHtml\(v\) : maskiere\(v\)/)
})

test('Demo: Plugins schreiben keine Daten, die Oberfläche keine Einstellungen der Person', async () => {
  const { plugins } = await import('../src/plugins.js')
  const gesendet = []
  const post = api.post
  api.post = async (p, body, m) => { gesendet.push([p, m]); return {} }
  plugins.list = [{ key: 'etim', enabled: true, manifest: {} }]
  store.demo = true
  try {
    await plugins.ctx('etim').data.set('settings', { a: 1 })
    assert.deepEqual(gesendet, [], 'keine Anfrage')
    const fs = await import('node:fs')
    assert.match(fs.readFileSync(new URL('../src/store.js', import.meta.url), 'utf8'), /if \(this\.demo\) return   \/\/ Demo: Ansicht und Sprache/)
  } finally { store.demo = false }
  try {
    await plugins.ctx('etim').data.set('settings', { a: 1 })
    assert.equal(gesendet.length, 1, 'ausserhalb der Demo wie bisher')
  } finally { api.post = post }
})
