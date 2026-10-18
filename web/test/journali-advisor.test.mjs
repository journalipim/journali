// journali advisor (18.10.2026, docs/todo-journali-advisor.md): „Wie mache ich …?“ aus der Hilfe — die Kapitel in Abschnitte zerlegt, eine
// Wortsuche gewichtet nach Seltenheit, Vorsilben und Nachbarwörter; mit KI eine Antwort aus den Abschnitten. Geprüft an den echten Kapiteln
// (web/public/help/de): die Fragen, die Anwender eines PIM stellen, führen ins richtige Kapitel.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import './ui.mjs'

const { abschnitte, suche, begriffe, stamm, frage, ladeHilfe, vorratLeeren, KI_SYSTEM } = await import('../src/journaliAdvisor.js')
const { ai } = await import('../src/ai.js')
const { store } = await import('../src/store.js')

const HILFE = new URL('../public/help/de/', import.meta.url)
const INDEX = JSON.parse(fs.readFileSync(new URL('index.json', HILFE), 'utf8'))
const html = slug => fs.readFileSync(new URL(slug + '.html', HILFE), 'utf8')
const ALLE = INDEX.flatMap(k => abschnitte(k.slug, k.title, html(k.slug), true))
const holen = async url => {
  const datei = String(url).split('/').pop()
  try { const text = fs.readFileSync(new URL(decodeURIComponent(datei), HILFE), 'utf8'); return { ok: true, json: async () => JSON.parse(text), text: async () => text } }
  catch { return { ok: false } }
}
const orte = (q, o) => suche(q, ALLE, o).map(a => `${a.slug} › ${a.titel}`)

test('ein Kapitel in Abschnitte: die Einleitung, dann je Überschrift einer — Text ohne Tags', () => {
  const b = abschnitte('baum', 'Der Baum', html('baum'))
  assert.equal(b[0].titel, 'Der Baum', 'die Einleitung trägt den Namen des Kapitels')
  assert.equal(b[0].ebene, 1)
  assert.ok(['Rollen', 'Anlegen', 'Der Name'].every(t => b.some(x => x.titel === t)), b.map(x => x.titel).join(' | '))
  assert.ok(b.every(x => !/[<>]/.test(x.text)), 'kein HTML im Text')
  // was nur mit Lizenz gilt, fällt in der Startphase weg — und umgekehrt
  const h = '<h1>K</h1><p>a</p><div class="nur-lizenz">\n<p>LIZENZ</p>\n</div>\n<div class="nur-startphase">\n<p>START</p>\n</div>\n'
  assert.match(abschnitte('k', 'K', h, true)[0].text, /START/); assert.doesNotMatch(abschnitte('k', 'K', h, true)[0].text, /LIZENZ/)
  assert.match(abschnitte('k', 'K', h, false)[0].text, /LIZENZ/); assert.doesNotMatch(abschnitte('k', 'K', h, false)[0].text, /START/)
})

test('Begriffe: Füllwörter fallen weg, Endungen auch — eine Vorsilbe verbindet sich mit dem Verb, Nachbarwörter kommen dazu', () => {
  assert.deepEqual(begriffe('Wie lege ich ein Attribut an?').map(b => b.s), ['leg', 'attribu'])
  assert.ok(begriffe('Wie lege ich ein Attribut an?')[0].mit.includes('anleg'))
  assert.equal(stamm('exportiert'), 'export')
  assert.equal(stamm('importiere'), 'import')
  assert.ok(begriffe('wie gebe ich ein Produkt frei')[0].mit.includes('freigabe'), '„freigeben“ → „Freigabe“')
  assert.ok(begriffe('wie lösche ich ein Produkt')[0].nachbarn.includes('zurückzieh'), 'journali löscht nicht, es zieht zurück')
  assert.deepEqual(begriffe('wie mache ich das?'), [])
})

test('die Fragen der Anwender führen ins richtige Kapitel', () => {
  const erster = q => orte(q)[0] ?? ''
  assert.equal(erster('Wie lege ich ein Attribut an?'), 'modell › Ein Attribut anlegen')   // seit 18.10.2026 steht es in der Hilfe
  assert.equal(erster('Wo finde ich die Rollen?'), 'anwender-rollen-und-teams › Rollen und Rechte')
  assert.equal(erster('wie importiere ich eine Excel-Datei'), 'import-und-export › Import')
  assert.match(erster('wie mache ich eine Sicherung'), /^sicherung-und-wiederherstellung › /)
  assert.equal(erster('wie gebe ich ein Produkt frei'), 'freigabe-und-publikation › Freigabe')
  assert.match(erster('Tastenkürzel'), /^tastatur › /)
  assert.match(erster('wie lade ich ein Bild hoch'), /^medien › /)
  assert.match(erster('was kostet journali'), /lizenz/)
  assert.ok(orte('was ist eine Variante').some(o => o.startsWith('baum › ')))
  assert.deepEqual(orte('Bananenbrot'), [], 'was nicht in der Hilfe steht, findet nichts')
  // höchstens vier, jeder mit Auszug
  const t = suche('Sicherung', ALLE)
  assert.ok(t.length <= 4 && t.every(a => a.auszug && a.auszug.length <= 250))
})

test('das Kapitel der Ansicht, in der man steht, geht bei gleicher Lage vor', () => {
  const ohne = suche('Rollen', ALLE).map(a => a.slug), mit = suche('Rollen', ALLE, { kapitel: 'baum' }).map(a => a.slug)
  assert.ok(mit.indexOf('baum') <= ohne.indexOf('baum'), `${ohne} / ${mit}`)
})

test('frage: ohne KI nur die Abschnitte — mit KI eine Antwort aus ihnen, mit Verweisen', async () => {
  vorratLeeren(); store.startphase = true
  const verfuegbar = ai.available, ask = ai.ask
  try {
    ai.available = () => false
    let gefragt = 0; ai.ask = async () => { gefragt++; return 'x' }
    const ohne = await frage('Wie lege ich ein Attribut an?', { holen })
    assert.equal(ohne.treffer[0].titel, 'Ein Attribut anlegen')
    assert.deepEqual([ohne.antwort, gefragt], [null, 0], 'ohne KI wird sie nicht gefragt')

    ai.available = () => true
    let bitte = null; ai.ask = async a => { bitte = a; return '1. Unter Modell … [H1]' }
    const mit = await frage('Wie lege ich ein Attribut an?', { holen })
    assert.equal(mit.antwort, '1. Unter Modell … [H1]')
    assert.equal(bitte.system, KI_SYSTEM)
    assert.match(bitte.user, /^Frage: Wie lege ich ein Attribut an\?\n\nOrte in der Oberfläche:\n- ⊞ Modell\n\nAbschnitte der Hilfe:\n\[H1\] Das Modell › Ein Attribut anlegen\n/)
    assert.deepEqual(mit.orte.map(o => o.to), ['/model'], 'Wo: das Modell — nicht der Baum, wo man auch anlegt')
    assert.match(KI_SYSTEM, /ausschliesslich aus den nummerierten Abschnitten/)
    assert.match(KI_SYSTEM, /Erfinde keine Menüs, Knöpfe oder Funktionen/)

    // nichts gefunden: die KI wird nicht gefragt; ein Fehler der KI steht als Warnung da, die Abschnitte bleiben
    gefragt = 0; ai.ask = async () => { gefragt++; return 'x' }
    assert.deepEqual([(await frage('Bananenbrot', { holen })).treffer, gefragt], [[], 0])
    ai.ask = async () => { throw new Error('KI nicht verfügbar') }
    const fehler = await frage('Sicherung', { holen })
    assert.ok(fehler.treffer.length); assert.equal(fehler.warnung, 'KI nicht verfügbar')
  } finally { ai.available = verfuegbar; ai.ask = ask; vorratLeeren() }
})

test('Wo: die Orte der Oberfläche, die diese Rolle sieht — ein Link statt eines Satzes', async () => {
  const { findeOrte, orte } = await import('../src/journaliOrte.js')
  const auth = store.auth, demo = store.demo
  try {
    store.auth = { enabled: true, user: 'a', rights: ['read', 'write', 'users', 'model'] }
    const ziel = q => findeOrte(q).map(o => o.to)
    assert.deepEqual(ziel('Wo finde ich die Rollen?'), ['/settings#users'])
    assert.deepEqual(ziel('wie ändere ich mein Passwort'), ['/settings'])
    assert.equal(ziel('wo kann ich Bilder hochladen')[0], '/media')
    assert.deepEqual(ziel('wo stelle ich den Mailserver ein'), ['/settings#mail'])
    assert.deepEqual(ziel('Wie lege ich ein Attribut an?'), ['/model'])
    assert.deepEqual(ziel('Bananenbrot'), [])
    assert.ok(orte().some(o => o.titel.endsWith('◈ IAM')))
    // ohne das Recht: der Ort ist nicht da — und wird nicht genannt
    store.auth = { enabled: true, user: 'b', rights: ['read', 'write'] }
    assert.ok(!orte().some(o => o.to === '/settings#users' || o.to === '/settings#mail'))
    assert.ok(!ziel('Wo finde ich die Rollen?').includes('/settings#users'))
    // ⬡ Plugins nicht in der Demo
    store.auth = { enabled: true, user: 'demo', rights: ['read', 'write', 'plugins'] }; store.demo = true
    assert.ok(!orte().some(o => o.to === '/plugins'))
  } finally { store.auth = auth; store.demo = demo }
})

test('die Hilfe wird einmal je Sprache und Startphase geladen', async () => {
  vorratLeeren()
  let n = 0; const zaehlend = async u => { n++; return holen(u) }
  await ladeHilfe(zaehlend); const erst = n
  await ladeHilfe(zaehlend)
  assert.equal(n - erst, 1, 'beim zweiten Mal nur das Verzeichnis')
  vorratLeeren()
})
