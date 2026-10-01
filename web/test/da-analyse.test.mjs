// KI-Analyse in der Datenqualität: sie analysiert die GEWÄHLTEN Regelgruppen am gewählten Knoten. Hat das Plugin einer Gruppe eine Analyse beigesteuert (GEO),
// läuft diese; jede andere Gruppe (Werbeaussagen, Datenqualität, ETIM …) prüft die KI allgemein: ihre Kriterien gegen die Daten des Knotens und die Befunde.
import test from 'node:test'
import assert from 'node:assert/strict'
import { flushPromises } from './ui.mjs'

const geo = (await import('../../plugins/geo/entry.js')).default
const da = (await import('../../plugins/da/entry.js')).default
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

const GEO_ANALYSE = { bewertung: [{ kriterium: 'Faktenbasis', punkte: 8, begruendung: 'viele Werte' }], fragen: [{ cluster: 'problem', frage: 'Welche Masse für 10 mm?' }], entscheidung: 'Z 625 bis 20 mm.', empfehlungen: ['Fragen ergänzen'] }
const ALLGEMEIN = { kriterien: [{ gruppe: 'Werbeaussagen (EmpCo)', kriterium: 'Allgemeine Umweltaussage ohne Beleg', urteil: 'auffällig', begruendung: 'Text nennt „umweltfreundlich“ ohne Beleg', vorschlag: 'Beleg nennen' }, { gruppe: 'Werbeaussagen (EmpCo)', kriterium: 'Klimaneutral', urteil: 'erfüllt', begruendung: 'kommt nicht vor', vorschlag: '' }], empfehlungen: ['Umweltaussagen belegen'] }

const regel = (key, label) => ({ key: 'empco', check: key, quelle: { de: 'Werbeaussagen (EmpCo)' }, label, severity: 'warn', run: () => [{ attribute: 'beschreibung', message: 'Aussage ohne Beleg' }] })
const geoRegel = key => ({ key: 'geo', check: key, quelle: { de: 'GEO-Texte (KI)' }, label: 'GEO ' + key, severity: 'info', run: () => [] })

async function ansicht(gewaehlt) {
  const gefragt = [], toasts = []
  const rows = [{ id: 'p1', role: 'product', label: 'Z 625', parent: null }]
  const tabelle = { columns: [{ key: 'beschreibung', type: 'text', label: { de: 'Beschreibung' } }, { key: 'dicke', type: 'decimal', unit: 'mm', label: { de: 'Dicke' } }],
    rows: [{ row: { id: 'p1', role: 'product', label: 'Z 625', keys: {} }, values: { beschreibung: { value: 'umweltfreundlich' }, dicke: { value: '20' } }, inactive: [] }] }
  const ctx = {
    api: { get: async p => String(p).includes('/relations/tree') ? {} : String(p).includes('/table') ? tabelle : { role: 'product', name: 'Z 625', values: [{ attribute: 'dicke', value: '20' }], ancestors: [], computed: [], axisValues: {} } },
    store: { model: { masterLocale: 'de', locales: [{ code: 'de' }], lists: [], attributes: [{ key: 'dicke', type: 'decimal', label: { de: 'Dicke' }, perLocale: false }] }, toast: m => toasts.push(m) },
    tree: { loaded: true, rows, byId: new Map(rows.map(r => [r.id, r])), ancestors: () => [], load: async () => {} }, treePicker: () => {},
    checks: [regel('generic', 'Allgemeine Umweltaussage ohne Beleg'), regel('neutral', 'Klimaneutral'), ...['short', 'score'].map(geoRegel)],
    analyses: geo.analyses.map(a => ({ ...a, key: 'geo' })),
    data: { get: async () => ({ rules: gewaehlt }), set: async () => {} },
    ai: { available: () => true, label: () => 'KI', ask: async a => { gefragt.push(a); return a.system.includes('bewertest') ? GEO_ANALYSE : ALLGEMEIN } },
  }
  localStorage.setItem('journali.dq.root', 'p1')
  const root = document.createElement('div'); document.body.append(root)
  await da.views[0].mount(root, ctx); await ruhe()
  const knopf = [...root.querySelectorAll('button')].find(b => b.textContent.trim() === '✦ KI-Analyse')
  return { root, gefragt, toasts, knopf }
}

test('nur GEO gewählt: es läuft die GEO-Analyse, die allgemeine Prüfung nicht', async () => {
  const { root, gefragt, knopf } = await ansicht(['geo:score'])
  knopf.click(); await ruhe()
  assert.equal(gefragt.length, 1); assert.match(gefragt[0].system, /bewertest/)
  assert.match(root.textContent, /GEO-Analyse · Z 625/); assert.doesNotMatch(root.textContent, /KI-Analyse · Werbeaussagen/)
})

test('nur Werbeaussagen gewählt: die KI prüft deren Kriterien gegen die Daten und die Befunde — von GEO kommt nichts', async () => {
  const { root, gefragt, knopf } = await ansicht(['empco:generic', 'empco:neutral'])
  knopf.click(); await ruhe()
  assert.equal(gefragt.length, 1)
  const u = gefragt[0].user
  assert.match(u, /Produkt: Z 625/); assert.match(u, /- Beschreibung: umweltfreundlich/); assert.match(u, /- Dicke: 20 mm/)
  assert.match(u, /Gruppe Werbeaussagen \(EmpCo\):\n- Allgemeine Umweltaussage ohne Beleg\n- Klimaneutral/)
  assert.doesNotMatch(u, /GEO/, 'eine nicht gewählte Gruppe geht nicht mit')
  assert.match(u, /Befunde der Regelprüfung:\n- Allgemeine Umweltaussage ohne Beleg: Z 625 · beschreibung — Aussage ohne Beleg/, 'die Befunde der Prüfung gehen mit')
  assert.match(gefragt[0].system, /keine Websuche/)
  assert.match(root.textContent, /KI-Analyse · Werbeaussagen \(EmpCo\) · Z 625/)
  assert.match(root.textContent, /Allgemeine Umweltaussage ohne Beleg⚠ auffälligText nennt „umweltfreundlich“ ohne BelegBeleg nennen/)
  assert.match(root.textContent, /Klimaneutral✓ erfülltkommt nicht vor/)
  assert.doesNotMatch(root.textContent, /GEO-Analyse/)
})

test('beide gewählt: GEO mit seiner Analyse, die übrigen allgemein', async () => {
  const { root, gefragt, knopf } = await ansicht(['geo:score', 'empco:generic'])
  knopf.click(); await ruhe()
  assert.equal(gefragt.length, 2)
  assert.equal(gefragt.filter(a => /bewertest/.test(a.system)).length, 1); assert.equal(gefragt.filter(a => /Prüfkriterien/.test(a.system)).length, 1)
  assert.match(root.textContent, /GEO-Analyse · Z 625/); assert.match(root.textContent, /KI-Analyse · Werbeaussagen/)
})

test('ohne gewählte Regelgruppe fragt die KI nicht und der Knopf sagt es', async () => {
  const { gefragt, toasts, knopf } = await ansicht([])
  knopf.click(); await ruhe()
  assert.equal(gefragt.length, 0); assert.deepEqual(toasts, ['Keine Regelgruppe gewählt'])
})

test('ist noch nicht geprüft worden, läuft die Prüfung zuerst — ihre Befunde gehen in die Analyse', async () => {
  const { gefragt, knopf } = await ansicht(['empco:generic'])
  knopf.click(); await ruhe()
  assert.match(gefragt[0].user, /Aussage ohne Beleg/)
})
