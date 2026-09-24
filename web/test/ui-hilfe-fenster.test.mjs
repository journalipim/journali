// Die Hilfe liegt als Fenster über der Ansicht — kein Seitenwechsel: wer nachliest, bleibt, wo er war.
// Kapitel links, Text rechts, Suche über alle Kapitel; Esc, ✕ und ein Klick daneben schliessen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'

const HelpPanel = (await import('../src/components/HelpPanel.vue')).default
const { hilfe, openHelp, closeHelp, helpItems } = await import('../src/help.js')

const INDEX = [{ slug: 'was-journali-ist', title: 'Was journali ist', nr: '00' }, { slug: 'baum', title: 'Der Baum', nr: '04' }]
function server() {
  globalThis.fetch = async url => {
    const p = String(url)
    if (p.endsWith('index.json')) return { ok: true, json: async () => INDEX }
    const slug = p.split('/').pop().replace('.html', '')
    return { ok: true, text: async () => `<h1>${slug}</h1><p>Text zu ${slug}.</p>` }
  }
}
const auf = async () => { const w = mount(HelpPanel); await flushPromises(); await flushPromises(); return w }

test('geschlossen steht nichts im Dokument; öffnen zeigt Kapitel und Text', async () => {
  server(); closeHelp(); hilfe.chapter = ''
  const w = await auf()
  assert.equal(document.querySelector('.help-overlay'), null, 'zu und trotzdem da')
  openHelp('baum')
  await flushPromises(); await flushPromises()
  const kasten = document.querySelector('.help-overlay')
  assert.ok(kasten, 'das Fenster ging nicht auf')
  assert.deepEqual([...kasten.querySelectorAll('.help-chapter')].map(a => a.textContent.trim()), ['00 Was journali ist', '04 Der Baum'])
  assert.match(kasten.querySelector('.help-text').innerHTML, /Text zu baum/)
  assert.equal(kasten.querySelector('.help-chapter.on').textContent.trim(), '04 Der Baum')
  closeHelp(); await flushPromises()
  assert.equal(document.querySelector('.help-overlay'), null, 'es blieb offen')
  w.unmount()
})

test('ein Kapitel wählen wechselt den Text, ohne die Ansicht zu verlassen', async () => {
  server(); closeHelp(); hilfe.chapter = ''
  const w = await auf()
  openHelp('baum'); await flushPromises(); await flushPromises()
  const vorher = location.pathname
  document.querySelectorAll('.help-chapter')[0].click()
  await flushPromises(); await flushPromises()
  assert.match(document.querySelector('.help-text').innerHTML, /Text zu was-journali-ist/)
  assert.equal(location.pathname, vorher, 'die Hilfe hat die Ansicht gewechselt')
  closeHelp(); w.unmount()
})

test('der ✕ schliesst; das Menü öffnet das Fenster statt zu navigieren', async () => {
  server(); closeHelp(); hilfe.chapter = ''
  const w = await auf()
  openHelp('baum'); await flushPromises(); await flushPromises()
  document.querySelector('.help-overlay button.x').click()
  await flushPromises()
  assert.equal(hilfe.open, false)

  const gezeigt = []
  const items = helpItems(() => {}, '/tree/p-1', s => gezeigt.push(s))
  items[0].action(); items[1].action()
  assert.deepEqual(gezeigt, ['baum', ''], 'erst das Kapitel zur Ansicht, dann alle')
  w.unmount()
})
