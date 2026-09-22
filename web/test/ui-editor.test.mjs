// Der grosse Texteditor und seine KI-Leiste (Taloan, 22.09.2026). Geprüft wird, was schiefging: die Leiste klappte nach jedem
// Lauf zu, sie legte sich über den Text, Esc warf den Knoten raus, das Ergebnis ersetzte immer alles.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, textOf, button, floats, press, domButton } from './ui.mjs'

// die KI antwortet im Test sofort und ohne Netz
const answers = []
const aiText = await import('../src/aiText.js')
const { ai } = await import('../src/ai.js')
ai.accounts.anthropic.key = 'test'; ai.provider = 'anthropic'
const origAsk = ai.ask
ai.ask = async () => { answers.push('ask'); return 'NEUER TEXT' }

const HtmlCell = (await import('../src/components/HtmlCell.vue')).default

async function openEditor(value = '<p>Alter Text</p>') {
  const w = mount(HtmlCell, { props: { value, title: 'Beschreibung', label: 'Beschreibung', locale: 'de', node: 'p-1' }, attachTo: document.body })
  await w.find('.cell-box').trigger('click'); await flushPromises()
  return w
}

test('KI-Leiste: öffnet, bleibt nach einem Lauf offen und steht im Fluss (verdeckt den Text nicht)', async () => {
  const w = await openEditor()
  assert.ok(!document.querySelector('.aibar'), 'die Leiste ist zu, bis man sie öffnet')
  await domButton('✦ KI').trigger(); await flushPromises()
  const bar = document.querySelector('.aibar')
  assert.ok(bar, 'nach dem Klick ist die Leiste da')
  assert.ok(!floats(bar), 'die Leiste steht im Fluss — sie schiebt den Text, statt ihn zu verdecken')
  // Reihenfolge der Gruppen und die Beschriftungen als Überschrift
  const t = bar.textContent.replace(/\s+/g, ' ')
  for (const s of ['überarbeiten', 'Verbessern', 'Kürzen', 'Ausführlicher', 'erzeugen', '@ Liste aus Produktdaten', '@ Marketingtext sachlich', '@ Marketingtext emotional', '@ Marketingtext vergleichend', 'Ergebnis', 'Text ersetzen', 'Am Cursor ergänzen'])
    assert.ok(t.includes(s), `„${s}“ fehlt in der Leiste: ${t}`)
  await domButton('Verbessern').trigger(); await flushPromises()
  assert.ok(document.querySelector('.aibar'), 'nach dem Lauf bleibt die Leiste offen (Taloan, 22.09.)')
  w.unmount()
})

test('KI-Ergebnis: ersetzt den Entwurf — oder ergänzt an der Schreibmarke', async () => {
  const w = await openEditor('<p>Alter Text</p>')
  await domButton('✦ KI').trigger(); await flushPromises()
  await domButton('Verbessern').trigger(); await flushPromises()
  const rich = () => document.querySelector('.rich').innerHTML
  assert.match(rich(), /NEUER TEXT/, 'im Modus „Text ersetzen“ steht das Ergebnis im Editor')
  assert.ok(!rich().includes('Alter Text'), 'und der alte Text ist ersetzt')
  document.querySelector('.rich').innerHTML = '<p>Alter Text</p>'
  await domButton('Am Cursor ergänzen').trigger()
  await domButton('Kürzen').trigger(); await flushPromises()
  assert.match(rich(), /Alter Text/, 'im Modus „Am Cursor ergänzen“ bleibt der bisherige Text')
  assert.match(rich(), /NEUER TEXT/, 'und das Ergebnis kommt dazu')
  w.unmount()
})

test('Esc schliesst den Editor, auch wenn der Fokus nicht darin steht', async () => {
  const w = await openEditor()
  assert.ok(document.querySelector('.overlay'), 'Editor offen')
  document.body.focus?.()
  press('Escape')                     // Fokus irgendwo — der Editor muss trotzdem zugehen
  await flushPromises()
  assert.ok(!document.querySelector('.overlay'), 'nach Esc ist der Editor zu (Taloan, 22.09.: sonst verlässt Esc den Knoten)')
  w.unmount()
})

test('Strg+Enter speichert den geänderten Text und schliesst', async () => {
  const w = await openEditor('<p>Alter Text</p>')
  await domButton('✦ KI').trigger(); await flushPromises()
  await domButton('Verbessern').trigger(); await flushPromises()
  press('Enter', { ctrl: true }); await flushPromises()
  assert.ok(!document.querySelector('.overlay'), 'Editor zu')
  const saved = w.emitted('save')?.at(-1)?.[0] ?? ''
  assert.match(saved, /NEUER TEXT/, 'gespeichert wird, was im Editor steht')
  w.unmount()
})

test('Listenwerte gehen als Wort an die KI, nicht als Code', async () => {
  const { store } = await import('../src/store.js')
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], groups: [], lists: [{ key: 'os', values: [{ value: 'EV007944', label: { en: 'Windows 11 Pro' } }] }],
    attributes: [{ key: 'os', type: 'enum', list: 'os', label: { de: 'Betriebssystem' } }, { key: 'wlan', type: 'boolean', label: { de: 'Wi-Fi' } }] }
  const { api } = await import('../src/api.js')
  const orig = api.get
  api.get = async () => ({ id: 'p-1', values: [{ attribute: 'os', value: 'EV007944' }, { attribute: 'wlan', value: 'true' }], ancestors: [], computed: [] })
  try {
    const f = await aiText.facts('p-1', 'de')
    assert.ok(f.rows.some(r => r.includes('Windows 11 Pro')), `Listenwert nicht aufgelöst: ${f.rows.join(' | ')}`)
    assert.ok(!f.rows.some(r => /EV\d{6}/.test(r)), 'kein roher EV-Code in den Produktdaten')
    assert.ok(f.rows.some(r => r.includes('Wi-Fi: ja')), 'Ja/Nein statt true/false')
  } finally { api.get = orig; ai.ask = origAsk }
})
